import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Language, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_LIMIT = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private codesMatch(code: string, hash: string) {
    const next = Buffer.from(this.hash(code));
    const prev = Buffer.from(hash);
    return next.length === prev.length && timingSafeEqual(next, prev);
  }

  private debugCode() {
    return this.config.get<string>('OTP_DEBUG') === 'true' ? this.config.get<string>('OTP_DEV_CODE') || '123456' : null;
  }

  private tokenFor(user: User) {
    return this.jwt.sign({ sub: user.id, role: user.role });
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
      photoUrl: user.photoUrl,
      preferredLanguage: user.preferredLanguage,
      marketingConsent: user.marketingConsent,
      notifications: {
        push: user.notifyPush,
        email: user.notifyEmail,
        sms: user.notifySms,
        whatsapp: user.notifyWhatsapp,
      },
      safeContactMethod: user.safeContactMethod,
      emergencyName: user.emergencyName,
      emergencyPhone: user.emergencyPhone,
      mfaEnabled: user.mfaEnabled,
      partnerId: user.partnerId,
    };
  }

  async requestOtp(phone: string, purpose = 'login') {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const recent = await this.prisma.otpChallenge.count({
      where: { phone, purpose, createdAt: { gt: since } },
    });
    if (recent >= OTP_LIMIT) {
      throw new BadRequestException('Too many codes were requested. Wait a few minutes and try again.');
    }
    const code = this.debugCode() || String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, '0');
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_WINDOW_MS),
      },
    });
    return {
      sent: true,
      phone,
      purpose,
      expiresInSeconds: OTP_WINDOW_MS / 1000,
      debugCode: this.debugCode(),
    };
  }

  private async consumeOtp(phone: string, code: string, purpose: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || !this.codesMatch(code, challenge.codeHash)) {
      throw new UnauthorizedException('That code is not valid or it has expired');
    }
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  async verifyOtp(phone: string, code: string, name?: string, language?: Language) {
    await this.consumeOtp(phone, code, 'login');
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (user?.deletedAt) throw new UnauthorizedException('This account has been deleted');
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          name: name?.trim() || 'OVYK guest',
          role: Role.CUSTOMER,
          preferredLanguage: language || Language.EN,
          passengers: {
            create: { name: name?.trim() || 'OVYK guest', phone, relationship: 'self' },
          },
        },
      });
    } else if (name?.trim() && user.name === 'OVYK guest') {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { name: name.trim() } });
    }
    return { accessToken: this.tokenFor(user), user: this.publicUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash || user.deletedAt) throw new UnauthorizedException('Email or password is incorrect');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email or password is incorrect');
    if (user.mfaEnabled) {
      if (!user.phone) throw new BadRequestException('This staff account has no phone for the second check');
      await this.requestOtp(user.phone, 'mfa');
      const mfaToken = this.jwt.sign({ sub: user.id, mfa: true }, { expiresIn: '10m' });
      return { mfaRequired: true, mfaToken, debugCode: this.debugCode() };
    }
    return { accessToken: this.tokenFor(user), user: this.publicUser(user) };
  }

  async confirmMfa(mfaToken: string, code: string) {
    let payload: { sub: string; mfa?: boolean };
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('The sign-in check expired. Start again.');
    }
    if (!payload.mfa) throw new UnauthorizedException('This token cannot confirm a second check');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.phone || user.deletedAt) throw new UnauthorizedException('Account not available');
    await this.consumeOtp(user.phone, code, 'mfa');
    return { accessToken: this.tokenFor(user), user: this.publicUser(user) };
  }

  async me(user: User) {
    return this.publicUser(user);
  }

  async updateMe(
    user: User,
    input: {
      name?: string;
      email?: string;
      preferredLanguage?: Language;
      marketingConsent?: boolean;
      notifications?: { push?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean };
      safeContactMethod?: string;
      emergencyName?: string;
      emergencyPhone?: string;
      photoUrl?: string;
    },
  ) {
    if (input.email && input.email !== user.email) {
      throw new BadRequestException('Changing email needs a fresh code. Request one for purpose email.');
    }
    const next = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name?.trim() || undefined,
        preferredLanguage: input.preferredLanguage,
        marketingConsent: input.marketingConsent,
        notifyPush: input.notifications?.push,
        notifyEmail: input.notifications?.email,
        notifySms: input.notifications?.sms,
        notifyWhatsapp: input.notifications?.whatsapp,
        safeContactMethod: input.safeContactMethod,
        emergencyName: input.emergencyName,
        emergencyPhone: input.emergencyPhone,
        photoUrl: input.photoUrl,
      },
    });
    return this.publicUser(next);
  }

  async changeEmail(user: User, email: string, code: string) {
    if (!user.phone) throw new BadRequestException('Add a phone before changing email');
    await this.consumeOtp(user.phone, code, 'email');
    const next = await this.prisma.user.update({
      where: { id: user.id },
      data: { email: email.toLowerCase() },
    });
    return this.publicUser(next);
  }

  async deleteAccount(user: User, code: string) {
    if (!user.phone) throw new BadRequestException('This account has no phone to confirm deletion');
    await this.consumeOtp(user.phone, code, 'delete');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        name: 'Deleted customer',
        phone: `deleted-${user.id}`,
        email: user.email ? `deleted-${user.id}@ovyk.local` : null,
        photoUrl: null,
        emergencyName: null,
        emergencyPhone: null,
        marketingConsent: false,
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'account.delete', entityType: 'User', entityId: user.id },
    });
    return { deleted: true, retained: 'Bookings, payments and incident records stay for the retention window.' };
  }
}
