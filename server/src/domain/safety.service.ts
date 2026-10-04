import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, EmergencyStatus, EmergencyType, LocationSource, ShareScope, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { NotifyService } from '../notify/notify.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingService } from './booking.service';

const CUSTOMER_LABEL: Record<EmergencyStatus, string> = {
  SENDING: 'Sending',
  DELIVERED: 'Delivered',
  ACKNOWLEDGED: 'Acknowledged',
  ASSISTANCE_DISPATCHED: 'Help is on the way',
  ESCALATED: 'Escalated to the duty lead',
  CANCEL_REQUESTED: 'Cancellation sent to the response team',
  RESOLVED: 'Resolved',
  FAILED: 'This alert could not be delivered',
};

@Injectable()
export class SafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingService,
    private readonly notify: NotifyService,
  ) {}

  private async bookingFor(user: User, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true, driver: { include: { user: true } }, city: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const allowed = booking.customerId === user.id || booking.organiserId === user.id || ['ADMIN', 'DISPATCHER', 'EMERGENCY_RESPONDER', 'SUPPORT'].includes(user.role);
    if (!allowed) throw new ForbiddenException('You cannot use this booking');
    return booking;
  }

  async ping(user: User, bookingId: string, input: { lat: number; lng: number; heading?: number; source?: LocationSource }) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.id } });
    if (!driver && user.role !== 'ADMIN') throw new ForbiddenException('Only the assigned driver sends a location');
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (driver && booking.driverId !== driver.id) throw new ForbiddenException('This stay is not assigned to you');
    return this.prisma.locationPing.create({
      data: {
        bookingId,
        driverId: driver?.id,
        vehicleId: booking.vehicleId,
        lat: input.lat,
        lng: input.lng,
        heading: input.heading,
        source: input.source || LocationSource.DRIVER_APP,
      },
    });
  }

  async track(user: User, bookingId: string) {
    const booking = await this.bookingFor(user, bookingId);
    return this.trackView(booking.id, booking.pickupLabel);
  }

  private async trackView(bookingId: string, destination: string) {
    const rules = await this.bookings.policy();
    const latest = await this.prisma.locationPing.findFirst({
      where: { bookingId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!latest) {
      return {
        available: false,
        stale: true,
        current: null,
        lastKnown: null,
        destination,
        message: 'Live tracking is not available yet',
      };
    }
    const ageSeconds = Math.round((Date.now() - latest.recordedAt.getTime()) / 1000);
    const stale = ageSeconds > rules.staleSeconds;
    const point = {
      lat: latest.lat,
      lng: latest.lng,
      heading: latest.heading,
      source: latest.source,
      recordedAt: latest.recordedAt,
      ageSeconds,
    };
    return {
      available: !stale,
      stale,
      current: stale ? null : point,
      lastKnown: point,
      destination,
      etaMinutes: stale ? null : 18,
      message: stale ? 'The last location is out of date and is not the current position' : 'Location is live',
    };
  }

  async share(user: User, bookingId: string, input: { name: string; phone?: string; scope: ShareScope; hours: number; notifyPickup?: boolean; notifyArrival?: boolean; notifyComplete?: boolean }) {
    const booking = await this.bookingFor(user, bookingId);
    if (user.role === 'DRIVER') throw new ForbiddenException('Drivers cannot manage family sharing');
    const ends = new Date(Date.now() + input.hours * 60 * 60 * 1000);
    const share = await this.prisma.nomineeShare.create({
      data: {
        bookingId,
        createdById: user.id,
        name: input.name,
        phone: input.phone,
        token: randomBytes(18).toString('hex'),
        scope: input.scope,
        startsAt: new Date(),
        endsAt: ends,
        notifyPickup: input.notifyPickup !== false,
        notifyArrival: input.notifyArrival !== false,
        notifyComplete: input.notifyComplete !== false,
      },
    });
    if (input.phone) {
      await this.notify.send(user.id, 'Family tracking invite', `A private tracking link for ${booking.reference} is ready for ${input.name}.`, bookingId);
    }
    return { ...share, url: `/track/${share.token}` };
  }

  async revokeShare(user: User, shareId: string) {
    const share = await this.prisma.nomineeShare.findUnique({ where: { id: shareId } });
    if (!share) throw new NotFoundException('Share not found');
    await this.bookingFor(user, share.bookingId);
    return this.prisma.nomineeShare.update({
      where: { id: shareId },
      data: { status: 'REVOKED' },
    });
  }

  async openShare(token: string) {
    const share = await this.prisma.nomineeShare.findUnique({
      where: { token },
      include: { booking: { include: { vehicle: true, city: true } } },
    });
    if (!share) throw new NotFoundException('This link is not valid');
    const expired = share.endsAt < new Date() || share.status !== 'ACTIVE';
    if (expired && share.status === 'ACTIVE') {
      await this.prisma.nomineeShare.update({ where: { id: share.id }, data: { status: 'EXPIRED' } });
    }
    await this.prisma.shareLog.create({ data: { shareId: share.id, action: expired ? 'denied' : 'view' } });
    if (expired) throw new ForbiddenException('This tracking link has ended');
    const track = await this.trackView(share.bookingId, share.booking.pickupLabel);
    return {
      passengerFirstName: share.name ? undefined : undefined,
      nominee: share.name,
      city: share.booking.city.name,
      vehicle: share.booking.vehicle?.name,
      reference: share.booking.reference,
      destination: share.booking.pickupLabel,
      endsAt: share.endsAt,
      track,
    };
  }

  async shareAction(token: string, action: 'check' | 'concern', note?: string) {
    const share = await this.prisma.nomineeShare.findUnique({ where: { token }, include: { booking: true } });
    if (!share || share.status !== 'ACTIVE' || share.endsAt < new Date()) {
      throw new ForbiddenException('This tracking link has ended');
    }
    await this.prisma.shareLog.create({ data: { shareId: share.id, action } });
    const responders = await this.prisma.user.findMany({
      where: { role: { in: ['EMERGENCY_RESPONDER', 'ADMIN'] }, deletedAt: null },
    });
    const title = action === 'check' ? 'Nominee asked OVYK to check' : 'Nominee reported an urgent concern';
    for (const responder of responders) {
      await this.notify.send(responder.id, title, `${share.booking.reference}: ${note || title}`, share.bookingId);
    }
    return { sent: true };
  }

  async sos(user: User, input: { bookingId?: string; silent?: boolean; lat?: number; lng?: number; type?: EmergencyType }) {
    let booking = null as null | { id: string; reference: string; pickupLabel: string; vehicleId: string | null; driverId: string | null };
    if (input.bookingId) {
      const row = await this.bookingFor(user, input.bookingId);
      booking = row;
    } else {
      const active = await this.prisma.booking.findFirst({
        where: { customerId: user.id, status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] } },
        orderBy: { startAt: 'desc' },
      });
      booking = active;
    }
    const latest = booking
      ? await this.prisma.locationPing.findFirst({ where: { bookingId: booking.id }, orderBy: { recordedAt: 'desc' } })
      : null;
    const emergency = await this.prisma.emergency.create({
      data: {
        bookingId: booking?.id,
        userId: user.id,
        silent: !!input.silent,
        type: input.type || EmergencyType.UNSPECIFIED,
        status: EmergencyStatus.DELIVERED,
        lat: input.lat ?? latest?.lat,
        lng: input.lng ?? latest?.lng,
        locationSource: latest ? latest.source : input.lat ? 'PASSENGER_PHONE' : null,
        locationAt: latest?.recordedAt || (input.lat ? new Date() : null),
        destination: booking?.pickupLabel,
        safeContact: user.safeContactMethod,
      },
    });
    await this.prisma.emergencyEvent.create({
      data: { emergencyId: emergency.id, actorId: user.id, kind: 'DELIVERED', note: input.silent ? 'Silent alert' : 'Alert sent' },
    });
    const responders = await this.prisma.user.findMany({
      where: { role: { in: ['EMERGENCY_RESPONDER', 'ADMIN', 'DISPATCHER'] }, deletedAt: null },
    });
    for (const responder of responders) {
      await this.notify.send(responder.id, 'Emergency / SOS', `${user.name} needs help${booking ? ` on ${booking.reference}` : ''}.`, booking?.id);
    }
    return this.presentEmergency(emergency.id);
  }

  async setSosType(user: User, id: string, type: EmergencyType) {
    const row = await this.prisma.emergency.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new NotFoundException('Alert not found');
    await this.prisma.emergency.update({ where: { id }, data: { type } });
    await this.prisma.emergencyEvent.create({ data: { emergencyId: id, actorId: user.id, kind: 'TYPE', note: type } });
    return this.presentEmergency(id);
  }

  async cancelSos(user: User, id: string) {
    const row = await this.prisma.emergency.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new NotFoundException('Alert not found');
    if (row.status === EmergencyStatus.RESOLVED) throw new BadRequestException('This alert is already closed');
    await this.prisma.emergency.update({ where: { id }, data: { status: EmergencyStatus.CANCEL_REQUESTED } });
    await this.prisma.emergencyEvent.create({
      data: { emergencyId: id, actorId: user.id, kind: 'CANCEL_REQUESTED', note: 'Passenger asked to cancel. A responder must review it.' },
    });
    return this.presentEmergency(id);
  }

  async presentEmergency(id: string) {
    const row = await this.prisma.emergency.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } }, user: true, booking: { include: { vehicle: true, driver: { include: { user: true } } } } },
    });
    if (!row) throw new NotFoundException('Alert not found');
    return {
      id: row.id,
      status: row.status,
      statusLabel: CUSTOMER_LABEL[row.status],
      helpOnTheWay: row.status === EmergencyStatus.ASSISTANCE_DISPATCHED,
      type: row.type,
      silent: row.silent,
      createdAt: row.createdAt,
      location: row.lat == null ? null : { lat: row.lat, lng: row.lng, source: row.locationSource, at: row.locationAt },
      passenger: { name: row.user.name, phone: row.user.phone, safeContact: row.safeContact },
      booking: row.booking
        ? {
            reference: row.booking.reference,
            pickup: row.booking.pickupLabel,
            vehicle: row.booking.vehicle?.name,
            registration: row.booking.vehicle?.registrationNo,
            driver: row.booking.driver?.user.name,
          }
        : null,
      timeline: row.events,
      callFallback: '+8801710000911',
    };
  }

  async myEmergencies(user: User) {
    const rows = await this.prisma.emergency.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map((row) => this.presentEmergency(row.id)));
  }

  async messages(user: User, bookingId: string) {
    const booking = await this.bookingFor(user, bookingId);
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.id } });
    const channel = driver && booking.driverId === driver.id ? 'DRIVER' : undefined;
    return this.prisma.message.findMany({
      where: { bookingId, ...(channel ? { channel: 'DRIVER' } : { channel: { in: ['CONCIERGE', 'DRIVER'] } }) },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  async postMessage(user: User, bookingId: string, body: string, channel: 'CONCIERGE' | 'DRIVER') {
    await this.bookingFor(user, bookingId);
    if (user.role === 'DRIVER' && channel !== 'DRIVER') throw new ForbiddenException('Drivers use the passenger channel only');
    return this.prisma.message.create({
      data: { bookingId, senderId: user.id, body, channel },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  async review(user: User, bookingId: string, input: { overall: number; comfort?: number; cleanliness?: number; punctuality?: number; professionalism?: number; comment?: string; complaint?: boolean }) {
    const booking = await this.bookingFor(user, bookingId);
    if (booking.status !== BookingStatus.COMPLETED) throw new BadRequestException('Reviews open after the stay is completed');
    if (booking.customerId !== user.id) throw new ForbiddenException('Only the customer can review this stay');
    const existing = await this.prisma.review.findUnique({ where: { bookingId_userId: { bookingId, userId: user.id } } });
    if (existing) throw new BadRequestException('This stay already has your review');
    const review = await this.prisma.review.create({
      data: { bookingId, userId: user.id, driverId: booking.driverId, ...input, complaint: !!input.complaint },
    });
    if (booking.driverId) await this.refreshRating(booking.driverId);
    return review;
  }

  async tip(user: User, bookingId: string, amountBdt: number, method: 'CARD' | 'BKASH' | 'NAGAD', idempotencyKey: string) {
    const booking = await this.bookingFor(user, bookingId);
    if (booking.status !== BookingStatus.COMPLETED && booking.status !== BookingStatus.ACTIVE) {
      throw new BadRequestException('A tip can be sent after a journey or at the end of the stay');
    }
    if (!booking.driverId) throw new BadRequestException('No driver is assigned');
    if (amountBdt < 1) throw new BadRequestException('Enter a tip amount');
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        userId: user.id,
        kind: 'TIP',
        method,
        status: 'SUCCEEDED',
        amountBdt,
        idempotencyKey,
        displayLabel: method === 'BKASH' ? 'bKash' : method === 'NAGAD' ? 'Nagad' : 'Card',
        providerRef: `tip_${randomBytes(3).toString('hex')}`,
      },
    });
    await this.prisma.tip.create({
      data: { bookingId, driverId: booking.driverId, paymentId: payment.id, amountBdt, status: 'SUCCEEDED' },
    });
    const driver = await this.prisma.driver.findUnique({ where: { id: booking.driverId } });
    if (driver) await this.notify.send(driver.userId, 'Tip received', `BDT ${amountBdt} is allocated entirely to you.`, bookingId);
    return payment;
  }

  private async refreshRating(driverId: string) {
    const reviews = await this.prisma.review.findMany({ where: { driverId, hidden: false } });
    if (!reviews.length) return;
    const rating = reviews.reduce((sum, review) => sum + review.overall, 0) / reviews.length;
    await this.prisma.driver.update({ where: { id: driverId }, data: { rating, reviewCount: reviews.length } });
  }

  async escalate() {
    const rules = await this.bookings.policy();
    const cutoff = new Date(Date.now() - rules.escalationMinutes * 60 * 1000);
    const due = await this.prisma.emergency.findMany({
      where: { status: { in: [EmergencyStatus.DELIVERED, EmergencyStatus.SENDING] }, createdAt: { lt: cutoff } },
    });
    for (const row of due) {
      await this.prisma.emergency.update({ where: { id: row.id }, data: { status: EmergencyStatus.ESCALATED } });
      await this.prisma.emergencyEvent.create({
        data: { emergencyId: row.id, kind: 'ESCALATED', note: `No acknowledgement within ${rules.escalationMinutes} minutes` },
      });
    }
    const shares = await this.prisma.nomineeShare.findMany({ where: { status: 'ACTIVE', endsAt: { lt: new Date() } } });
    for (const share of shares) {
      await this.prisma.nomineeShare.update({ where: { id: share.id }, data: { status: 'EXPIRED' } });
    }
    return { escalated: due.length, expiredShares: shares.length };
  }
}
