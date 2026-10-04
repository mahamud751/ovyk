import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JourneyStatus, User } from '@prisma/client';
import { NotifyService } from '../notify/notify.service';
import { PrismaService } from '../prisma/prisma.service';

const NEXT: Partial<Record<JourneyStatus, JourneyStatus>> = {
  PLANNED: JourneyStatus.ARRIVED,
  ARRIVED: JourneyStatus.COLLECTED,
  COLLECTED: JourneyStatus.IN_PROGRESS,
  IN_PROGRESS: JourneyStatus.COMPLETED,
};

@Injectable()
export class DriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
  ) {}

  private async driver(user: User) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.id }, include: { user: true } });
    if (!driver) throw new ForbiddenException('This account is not a driver');
    return driver;
  }

  async me(user: User) {
    const driver = await this.driver(user);
    const documents = await this.prisma.document.findMany({ where: { ownerType: 'DRIVER', ownerId: driver.id } });
    return {
      id: driver.id,
      name: driver.user.name,
      status: driver.status,
      languages: driver.languages,
      experienceYears: driver.experienceYears,
      rating: driver.rating,
      reviewCount: driver.reviewCount,
      licenceNumber: driver.licenceNumber,
      licenceExpiry: driver.licenceExpiry,
      photoUrl: driver.photoUrl,
      documents,
      trackingNote: 'OVYK records vehicle location during an assigned service so the passenger and operations can see the car. Family-sharing details and passenger SOS alerts are not shown in the driver app.',
    };
  }

  async assignments(user: User) {
    const driver = await this.driver(user);
    const rows = await this.prisma.booking.findMany({
      where: { driverId: driver.id, status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } },
      include: { city: true, vehicle: true, journeys: { orderBy: { date: 'asc' } }, customer: true },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      city: row.city.name,
      startDate: row.startDate,
      endDate: row.endDate,
      pickupTime: row.pickupTime,
      pickupLabel: row.pickupLabel,
      pickupLat: row.pickupLat,
      pickupLng: row.pickupLng,
      passengers: row.passengers,
      luggage: row.luggage,
      flightNumber: row.flightNumber,
      passengerName: row.customer.name,
      passengerPhone: row.customer.phone,
      vehicle: row.vehicle?.name,
      journeys: row.journeys.map((journey) => ({
        id: journey.id,
        date: journey.date,
        status: journey.status,
        hoursUsed: journey.hoursUsed,
        kmUsed: journey.kmUsed,
        destination: journey.destination,
      })),
    }));
  }

  async accept(user: User, bookingId: string) {
    const driver = await this.driver(user);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.driverId !== driver.id) throw new NotFoundException('Assignment not found');
    await this.notify.send(booking.customerId, 'Driver confirmed', `${driver.user.name} is confirmed for ${booking.reference}.`, bookingId);
    return { accepted: true, reference: booking.reference };
  }

  async advance(user: User, journeyId: string, hoursUsed?: number, kmUsed?: number) {
    const driver = await this.driver(user);
    const journey = await this.prisma.journey.findUnique({ where: { id: journeyId }, include: { booking: true } });
    if (!journey || journey.booking.driverId !== driver.id) throw new NotFoundException('Journey not found');
    const next = NEXT[journey.status];
    if (!next) throw new BadRequestException('This journey is already finished');
    const updated = await this.prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: next,
        hoursUsed: hoursUsed ?? journey.hoursUsed,
        kmUsed: kmUsed ?? journey.kmUsed,
      },
    });
    if (next === JourneyStatus.COMPLETED) {
      const open = await this.prisma.journey.count({
        where: { bookingId: journey.bookingId, status: { not: 'COMPLETED' } },
      });
      if (open === 0) {
        await this.prisma.booking.update({ where: { id: journey.bookingId }, data: { status: 'COMPLETED' } });
        await this.settle(journey.bookingId);
        await this.notify.send(journey.booking.customerId, 'Stay completed', `${journey.booking.reference} is complete. You can leave a review or a tip.`, journey.bookingId);
      }
    } else {
      await this.notify.send(journey.booking.customerId, 'Journey update', `${journey.booking.reference}: ${next.replaceAll('_', ' ').toLowerCase()}.`, journey.bookingId);
    }
    return updated;
  }

  private async settle(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true, tips: true },
    });
    if (!booking?.vehicle) return;
    const existing = await this.prisma.settlement.findUnique({ where: { bookingId } });
    if (existing) return;
    const partner = await this.prisma.partner.findUnique({ where: { id: booking.vehicle.partnerId } });
    const share = partner?.commissionPercent ?? 80;
    const tipBdt = booking.tips.filter((tip) => tip.status === 'SUCCEEDED').reduce((sum, tip) => sum + tip.amountBdt, 0);
    await this.prisma.settlement.create({
      data: {
        bookingId,
        partnerId: booking.vehicle.partnerId,
        grossBdt: booking.totalBdt,
        partnerShareBdt: Math.round((booking.totalBdt * share) / 100),
        ovykShareBdt: booking.totalBdt - Math.round((booking.totalBdt * share) / 100),
        tipBdt,
      },
    });
  }

  async expense(user: User, bookingId: string, input: { kind: string; amountBdt: number; note?: string; evidenceNote?: string }) {
    const driver = await this.driver(user);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.driverId !== driver.id) throw new NotFoundException('Assignment not found');
    return this.prisma.expense.create({ data: { bookingId, driverId: driver.id, ...input } });
  }

  async inspect(user: User, bookingId: string, input: { cleanliness: boolean; exteriorOk: boolean; interiorOk: boolean; notes?: string }) {
    const driver = await this.driver(user);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.driverId !== driver.id) throw new NotFoundException('Assignment not found');
    return this.prisma.inspection.create({ data: { bookingId, driverId: driver.id, ...input } });
  }

  async issue(user: User, bookingId: string, kind: string, note: string) {
    const driver = await this.driver(user);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.driverId !== driver.id) throw new NotFoundException('Assignment not found');
    const report = await this.prisma.issueReport.create({ data: { bookingId, driverId: driver.id, kind, note } });
    await this.notify.send(booking.customerId, 'Service update', `${booking.reference}: your driver reported ${kind.replaceAll('_', ' ')}.`, bookingId);
    return report;
  }

  async earnings(user: User) {
    const driver = await this.driver(user);
    const tips = await this.prisma.tip.findMany({ where: { driverId: driver.id }, orderBy: { createdAt: 'desc' } });
    const bookings = await this.prisma.booking.findMany({
      where: { driverId: driver.id, status: 'COMPLETED' },
      include: { settlement: true },
    });
    return {
      tips: tips.map((tip) => ({ amountBdt: tip.amountBdt, status: tip.status, bookingId: tip.bookingId, createdAt: tip.createdAt })),
      tipTotalBdt: tips.filter((tip) => tip.status === 'SUCCEEDED').reduce((sum, tip) => sum + tip.amountBdt, 0),
      completedStays: bookings.length,
      note: 'Tips are recorded separately from booking revenue. 100% of each stated tip is allocated to you.',
    };
  }

  async replace(actor: User, bookingId: string, input: { driverId?: string; vehicleId?: string; reason: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (input.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: input.driverId }, include: { user: true } });
      if (!driver || driver.status !== 'APPROVED') throw new BadRequestException('That driver is not approved');
      await this.prisma.booking.update({ where: { id: bookingId }, data: { driverId: driver.id } });
      await this.prisma.allocation.updateMany({
        where: { bookingId, status: 'ACTIVE' },
        data: { driverId: driver.id, note: input.reason },
      });
      await this.notify.send(booking.customerId, 'Driver change', `${booking.reference}: your driver is now ${driver.user.name}. ${input.reason}`, bookingId);
    }
    if (input.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle?.approved) throw new BadRequestException('That vehicle is not approved');
      await this.prisma.booking.update({ where: { id: bookingId }, data: { vehicleId: vehicle.id } });
      await this.prisma.allocation.updateMany({
        where: { bookingId, status: 'ACTIVE' },
        data: { vehicleId: vehicle.id, note: input.reason },
      });
      await this.notify.send(booking.customerId, 'Vehicle change', `${booking.reference}: your vehicle is now ${vehicle.name}. ${input.reason}`, bookingId);
    }
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'booking.replace', entityType: 'Booking', entityId: bookingId, payload: input },
    });
    return { updated: true };
  }
}
