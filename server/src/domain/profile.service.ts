import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  addresses(user: User) {
    return this.prisma.address.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  }

  addAddress(user: User, input: { label: string; line: string; kind: string; cityId?: string; lat?: number; lng?: number }) {
    return this.prisma.address.create({ data: { userId: user.id, ...input } });
  }

  async removeAddress(user: User, id: string) {
    const row = await this.prisma.address.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException('Address not found');
    await this.prisma.address.delete({ where: { id } });
    return { deleted: true };
  }

  passengers(user: User) {
    return this.prisma.passenger.findMany({ where: { organiserId: user.id } });
  }

  addPassenger(user: User, input: { name: string; phone?: string; relationship?: string; notes?: string }) {
    return this.prisma.passenger.create({
      data: { organiserId: user.id, name: input.name, phone: input.phone, relationship: input.relationship || 'guest', notes: input.notes },
    });
  }

  notifications(user: User) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async readNotification(user: User, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  places(citySlug: string) {
    return this.prisma.place.findMany({ where: { city: { slug: citySlug } }, include: { city: true } });
  }

  cities() {
    return this.prisma.city.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }
}
