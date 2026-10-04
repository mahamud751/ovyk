import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocStatus, DriverStatus, EmergencyStatus, PartnerStatus, Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NotifyService } from '../notify/notify.service';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from './safety.service';

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notify: NotifyService,
  ) {}

  private partnerOf(user: User) {
    if (user.role === Role.PARTNER && !user.partnerId) throw new ForbiddenException('Partner account is not linked');
    return user.role === Role.PARTNER ? user.partnerId : undefined;
  }

  async summary() {
    const [bookings, emergencies, drivers, vehicles] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['status'], _count: true }),
      this.prisma.emergency.count({ where: { status: { notIn: ['RESOLVED'] } } }),
      this.prisma.driver.count({ where: { status: 'APPROVED' } }),
      this.prisma.vehicle.count({ where: { active: true, approved: true } }),
    ]);
    return { bookings, openEmergencies: emergencies, approvedDrivers: drivers, bookableVehicles: vehicles };
  }

  async bookings(user: User) {
    const partnerId = this.partnerOf(user);
    return this.prisma.booking.findMany({
      where: partnerId ? { vehicle: { partnerId } } : {},
      include: { city: true, vehicle: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async customers() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER', deletedAt: null },
      select: { id: true, name: true, phone: true, email: true, preferredLanguage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async fleet(user: User) {
    const partnerId = this.partnerOf(user);
    const [vehicles, drivers, partners] = await Promise.all([
      this.prisma.vehicle.findMany({ where: partnerId ? { partnerId } : {}, include: { city: true, blocks: true } }),
      this.prisma.driver.findMany({
        where: partnerId ? { partnerId } : {},
        include: { user: { select: { name: true, phone: true, email: true } }, city: true },
      }),
      partnerId ? this.prisma.partner.findMany({ where: { id: partnerId } }) : this.prisma.partner.findMany(),
    ]);
    return { vehicles, drivers, partners };
  }

  async setDriverStatus(actor: User, driverId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.update({ where: { id: driverId }, data: { status }, include: { user: true } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'driver.status', entityType: 'Driver', entityId: driverId, payload: { status } },
    });
    await this.notify.send(driver.userId, 'Driver status', `Your OVYK driver status is now ${status}.`, undefined);
    return driver;
  }

  async approveVehicle(actor: User, vehicleId: string, approved: boolean) {
    const vehicle = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { approved, active: approved } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'vehicle.approval', entityType: 'Vehicle', entityId: vehicleId, payload: { approved } },
    });
    return vehicle;
  }

  async blockVehicle(vehicleId: string, startAt: string, endAt: string, reason: 'MAINTENANCE' | 'DOCUMENT', note?: string) {
    return this.prisma.vehicleBlock.create({
      data: { vehicleId, startAt: new Date(startAt), endAt: new Date(endAt), reason, note },
    });
  }

  async emergencies() {
    const rows = await this.prisma.emergency.findMany({
      where: { status: { not: 'RESOLVED' } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, phone: true } }, events: true },
    });
    return Promise.all(rows.map(async (row) => ({ ...(await this.safety.presentEmergency(row.id)) })));
  }

  async emergencyAct(actor: User, id: string, action: 'acknowledge' | 'dispatch' | 'resolve' | 'confirm-cancel', note?: string) {
    const row = await this.prisma.emergency.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Alert not found');
    const next: Record<typeof action, EmergencyStatus> = {
      acknowledge: EmergencyStatus.ACKNOWLEDGED,
      dispatch: EmergencyStatus.ASSISTANCE_DISPATCHED,
      resolve: EmergencyStatus.RESOLVED,
      'confirm-cancel': EmergencyStatus.RESOLVED,
    };
    if (action === 'confirm-cancel' && row.status !== EmergencyStatus.CANCEL_REQUESTED) {
      throw new BadRequestException('The passenger has not asked to cancel this alert');
    }
    await this.prisma.emergency.update({ where: { id }, data: { status: next[action] } });
    await this.prisma.emergencyEvent.create({
      data: { emergencyId: id, actorId: actor.id, kind: action.toUpperCase(), note },
    });
    if (action === 'dispatch') {
      await this.notify.send(row.userId, 'Help is on the way', 'A responder has confirmed that assistance has been dispatched.', row.bookingId || undefined);
    }
    return this.safety.presentEmergency(id);
  }

  async refunds() {
    return this.prisma.refund.findMany({ include: { booking: true, payment: true }, orderBy: { createdAt: 'desc' } });
  }

  async decideRefund(actor: User, id: string, approve: boolean) {
    const refund = await this.prisma.refund.findUnique({ where: { id }, include: { booking: true } });
    if (!refund) throw new NotFoundException('Refund not found');
    const status = approve ? 'PAID' : 'REJECTED';
    const updated = await this.prisma.refund.update({
      where: { id },
      data: { status, approvedBy: actor.id },
    });
    if (approve) {
      await this.prisma.booking.update({ where: { id: refund.bookingId }, data: { paymentStatus: 'REFUNDED' } });
      await this.notify.send(refund.booking.customerId, 'Refund paid', `BDT ${refund.amountBdt} was refunded for ${refund.booking.reference}.`, refund.bookingId);
    }
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'refund.decide', entityType: 'Refund', entityId: id, payload: { approve } },
    });
    return updated;
  }

  async paymentsCsv() {
    const rows = await this.prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    const header = 'id,bookingId,kind,method,status,amountBdt,createdAt';
    const body = rows.map((row) => [row.id, row.bookingId, row.kind, row.method, row.status, row.amountBdt, row.createdAt.toISOString()].join(','));
    return [header, ...body].join('\n');
  }

  async moderateReview(actor: User, id: string, hidden: boolean) {
    const review = await this.prisma.review.update({ where: { id }, data: { hidden } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'review.moderate', entityType: 'Review', entityId: id, payload: { hidden, complaint: review.complaint } },
    });
    return review;
  }

  async complaints() {
    return this.prisma.review.findMany({ where: { complaint: true }, orderBy: { createdAt: 'desc' } });
  }

  async audit() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { name: true, role: true } } } });
  }

  async saveSetting(actor: User, key: string, value: unknown) {
    const json = value as Prisma.InputJsonValue;
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'setting.update', entityType: 'Setting', entityId: key, payload: { value: json } },
    });
    return row;
  }

  async registerPartner(actor: User, input: { name: string; email: string; phone: string; password: string; commissionPercent?: number }) {
    const partner = await this.prisma.partner.create({
      data: { name: input.name, status: PartnerStatus.PENDING, commissionPercent: input.commissionPercent ?? 80 },
    });
    const user = await this.prisma.user.create({
      data: {
        role: Role.PARTNER,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash: await bcrypt.hash(input.password, 10),
        partnerId: partner.id,
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'partner.create', entityType: 'Partner', entityId: partner.id },
    });
    return { partner, userId: user.id };
  }

  async approvePartner(actor: User, id: string) {
    const partner = await this.prisma.partner.update({ where: { id }, data: { status: PartnerStatus.APPROVED } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'partner.approve', entityType: 'Partner', entityId: id },
    });
    return partner;
  }

  async submitVehicle(user: User, input: { cityId: string; name: string; subtitle: string; category: 'EXECUTIVE' | 'FAMILY' | 'PREMIUM'; make: string; model: string; modelYear: number; seats: number; luggage: number; dailyRate: number; registrationNo: string }) {
    if (!user.partnerId) throw new ForbiddenException('Only a fleet partner can submit a vehicle');
    return this.prisma.vehicle.create({
      data: {
        partnerId: user.partnerId,
        cityId: input.cityId,
        slug: `${input.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: input.category,
        name: input.name,
        subtitle: input.subtitle,
        description: input.subtitle,
        descriptionBn: input.subtitle,
        make: input.make,
        model: input.model,
        modelYear: input.modelYear,
        seats: input.seats,
        luggage: input.luggage,
        dailyRate: input.dailyRate,
        registrationNo: input.registrationNo,
        photos: ['/media/sedan-lake.jpg'],
        features: ['Air conditioning'],
        approved: false,
        active: false,
        verified: false,
      },
    });
  }

  async submitDriver(user: User, input: { name: string; phone: string; email: string; password: string; licenceNumber: string; licenceExpiry: string; languages: string[]; experienceYears: number; cityId: string }) {
    if (!user.partnerId) throw new ForbiddenException('Only a fleet partner can submit a driver');
    const account = await this.prisma.user.create({
      data: {
        role: Role.DRIVER,
        name: input.name,
        phone: input.phone,
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 10),
        partnerId: user.partnerId,
      },
    });
    const driver = await this.prisma.driver.create({
      data: {
        userId: account.id,
        partnerId: user.partnerId,
        cityId: input.cityId,
        languages: input.languages,
        experienceYears: input.experienceYears,
        licenceNumber: input.licenceNumber,
        licenceExpiry: new Date(input.licenceExpiry),
        status: DriverStatus.PENDING,
        bio: 'Submitted by a fleet partner. Not bookable until OVYK approves.',
      },
    });
    await this.prisma.document.create({
      data: {
        ownerType: 'DRIVER',
        ownerId: driver.id,
        kind: 'LICENCE',
        fileName: `${input.licenceNumber}.pdf`,
        status: DocStatus.PENDING,
        expiresOn: new Date(input.licenceExpiry),
      },
    });
    return driver;
  }

  async settlements(user: User) {
    const partnerId = this.partnerOf(user);
    return this.prisma.settlement.findMany({
      where: partnerId ? { partnerId } : {},
      include: { booking: { select: { reference: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cities() {
    return this.prisma.city.findMany({ orderBy: { name: 'asc' } });
  }

  async setCity(id: string, active: boolean) {
    return this.prisma.city.update({ where: { id }, data: { active } });
  }

  async documents(ownerType: string, ownerId: string) {
    return this.prisma.document.findMany({ where: { ownerType, ownerId } });
  }

  async reviewDocument(actor: User, id: string, status: DocStatus) {
    const doc = await this.prisma.document.update({ where: { id }, data: { status } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'document.review', entityType: 'Document', entityId: id, payload: { status } },
    });
    return doc;
  }
}
