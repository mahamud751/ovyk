import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingStatus,
  BookingType,
  Driver,
  PaymentKind,
  PaymentMethod,
  PayState,
  Prisma,
  User,
  Vehicle,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  CANCELLATION_RULES,
  EXCLUDED_COSTS,
  INCLUDED_SERVICES,
  POLICY_VERSION,
  estimates,
  simplePdf,
} from '../common/money';
import { daysBetween, eachDate, formatLongDate, periodFor, stayWindow } from '../common/time';
import { NotifyService } from '../notify/notify.service';
import { PrismaService } from '../prisma/prisma.service';

type Policy = {
  depositPercent: number;
  turnaroundHours: number;
  holdMinutes: number;
  includedHoursPerDay: number;
  includedKmPerDay: number;
  extraHourRate: number;
  extraKmRate: number;
  escalationMinutes: number;
  staleSeconds: number;
  policyVersion: string;
};

type QuoteInput = {
  citySlug: string;
  startDate: string;
  endDate: string;
  pickupTime: string;
  type: BookingType;
  passengers: number;
  luggage: number;
  promoCode?: string;
};

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
    private readonly config: ConfigService,
  ) {}

  async policy(): Promise<Policy> {
    const rows = await this.prisma.setting.findMany();
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const num = (key: string, fallback: number) => {
      const value = map.get(key);
      return typeof value === 'number' ? value : fallback;
    };
    return {
      depositPercent: num('depositPercent', 25),
      turnaroundHours: num('turnaroundHours', 2),
      holdMinutes: num('holdMinutes', 15),
      includedHoursPerDay: num('includedHoursPerDay', 10),
      includedKmPerDay: num('includedKmPerDay', 100),
      extraHourRate: num('extraHourRate', 800),
      extraKmRate: num('extraKmRate', 40),
      escalationMinutes: num('escalationMinutes', 5),
      staleSeconds: num('staleSeconds', 90),
      policyVersion: typeof map.get('policyVersion') === 'string' ? String(map.get('policyVersion')) : POLICY_VERSION,
    };
  }

  private async rates() {
    const [usd, gbp] = await Promise.all([
      this.prisma.exchangeRate.findFirst({ where: { quote: 'USD' }, orderBy: { asOf: 'desc' } }),
      this.prisma.exchangeRate.findFirst({ where: { quote: 'GBP' }, orderBy: { asOf: 'desc' } }),
    ]);
    return {
      usd: usd?.rate || 120,
      gbp: gbp?.rate || 155,
      asOf: usd?.asOf || new Date(),
    };
  }

  private async promo(code?: string) {
    if (!code) return null;
    const row = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!row || !row.active || (row.expiresAt && row.expiresAt < new Date())) {
      throw new BadRequestException('That promotional code is not active');
    }
    return row;
  }

  private price(dailyRate: number, days: number, rules: Policy, code: { percentOff: number; amountOff: number } | null) {
    const list = dailyRate * days;
    let discount = 0;
    if (code?.percentOff) discount += Math.round((list * code.percentOff) / 100);
    if (code?.amountOff) discount += code.amountOff;
    discount = Math.min(discount, list);
    const totalBdt = list - discount;
    const depositBdt = Math.round((totalBdt * rules.depositPercent) / 100);
    return { list, discount, totalBdt, depositBdt, balanceBdt: totalBdt - depositBdt };
  }

  vehicleView(vehicle: Vehicle, priced: ReturnType<BookingService['price']> & { days: number; period: string }, rules: Policy, rate: { usd: number; gbp: number; asOf: Date }, fits: boolean) {
    return {
      id: vehicle.id,
      slug: vehicle.slug,
      category: vehicle.category,
      name: vehicle.name,
      subtitle: vehicle.subtitle,
      description: vehicle.description,
      descriptionBn: vehicle.descriptionBn,
      make: vehicle.make,
      model: vehicle.model,
      modelYear: vehicle.modelYear,
      seats: vehicle.seats,
      luggage: vehicle.luggage,
      airConditioning: vehicle.airConditioning,
      features: vehicle.features,
      photos: vehicle.photos,
      verified: vehicle.verified,
      guaranteeType: vehicle.guaranteeType,
      childSeat: vehicle.childSeat,
      dailyRate: vehicle.dailyRate,
      days: priced.days,
      period: priced.period,
      totalBdt: priced.totalBdt,
      depositBdt: priced.depositBdt,
      balanceBdt: priced.balanceBdt,
      discountBdt: priced.discount,
      depositPercent: rules.depositPercent,
      includedHours: rules.includedHoursPerDay * priced.days,
      includedKm: rules.includedKmPerDay * priced.days,
      extraHourRate: rules.extraHourRate,
      extraKmRate: rules.extraKmRate,
      fuelIncluded: true,
      fits,
      estimates: estimates(priced.totalBdt, rate.usd, rate.gbp, rate.asOf),
      included: INCLUDED_SERVICES,
      excluded: EXCLUDED_COSTS,
      cancellation: CANCELLATION_RULES,
      guaranteeLabel:
        vehicle.guaranteeType === 'SPECIFIC'
          ? 'This booking is for this specific vehicle.'
          : 'This booking guarantees this vehicle category. OVYK may send an equivalent vehicle if needed, and will tell you before pickup.',
    };
  }

  async quote(input: QuoteInput) {
    this.assertDates(input.startDate, input.endDate, input.type);
    const city = await this.prisma.city.findUnique({ where: { slug: input.citySlug } });
    if (!city?.active) throw new NotFoundException('That city is not open yet');
    const rules = await this.policy();
    const rate = await this.rates();
    const code = await this.promo(input.promoCode);
    const days = input.type === BookingType.DAY ? 1 : Math.max(daysBetween(input.startDate, input.endDate), 1);
    const period = periodFor(days, input.type);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { cityId: city.id, active: true, approved: true },
      orderBy: { dailyRate: 'asc' },
    });
    return {
      city: { id: city.id, slug: city.slug, name: city.name },
      startDate: input.startDate,
      endDate: input.type === BookingType.DAY ? input.startDate : input.endDate,
      pickupTime: input.pickupTime,
      type: input.type,
      days,
      period,
      passengers: input.passengers,
      luggage: input.luggage,
      depositPercent: rules.depositPercent,
      policyVersion: rules.policyVersion,
      included: INCLUDED_SERVICES,
      excluded: EXCLUDED_COSTS,
      cancellation: CANCELLATION_RULES,
      vehicles: vehicles.map((vehicle) => {
        const priced = { ...this.price(vehicle.dailyRate, days, rules, code), days, period };
        const fits = vehicle.seats >= input.passengers && vehicle.luggage >= input.luggage;
        return this.vehicleView(vehicle, priced, rules, rate, fits);
      }),
    };
  }

  private assertDates(startDate: string, endDate: string, type: BookingType) {
    const days = type === BookingType.DAY ? 1 : daysBetween(startDate, endDate);
    if (type === BookingType.STAY && days < 1) {
      throw new BadRequestException('The end date must be after the start date');
    }
    const allowPast = this.config.get<string>('ALLOW_PAST_BOOKINGS') === 'true';
    if (!allowPast && startDate < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('Choose a start date that is today or later');
    }
  }

  private async clash(
    tx: Prisma.TransactionClient | PrismaService,
    args: { vehicleId: string; driverId: string; startAt: Date; endAt: Date; ignoreBookingId?: string },
    turnaroundHours: number,
  ) {
    const pad = turnaroundHours * 60 * 60 * 1000;
    const windowStart = new Date(args.startAt.getTime() - pad);
    const windowEnd = new Date(args.endAt.getTime() + pad);
    const notThis = args.ignoreBookingId ? { not: args.ignoreBookingId } : undefined;
    const vehicleBusy = await tx.allocation.findFirst({
      where: {
        vehicleId: args.vehicleId,
        status: 'ACTIVE',
        bookingId: notThis,
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
    });
    if (vehicleBusy) return 'That vehicle is already allocated across these dates';
    const driverBusy = await tx.allocation.findFirst({
      where: {
        driverId: args.driverId,
        status: 'ACTIVE',
        bookingId: notThis,
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
    });
    if (driverBusy) return 'That driver is already allocated across these dates';
    const hold = await tx.checkoutHold.findFirst({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        bookingId: notThis,
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
        OR: [{ vehicleId: args.vehicleId }, { driverId: args.driverId }],
      },
    });
    if (hold) return 'Another checkout is holding that vehicle or driver';
    const block = await tx.vehicleBlock.findFirst({
      where: { vehicleId: args.vehicleId, startAt: { lt: args.endAt }, endAt: { gt: args.startAt } },
    });
    if (block) return 'That vehicle is blocked for maintenance or documents';
    const rest = await tx.driverSchedule.findFirst({
      where: { driverId: args.driverId, kind: 'REST', startAt: { lt: args.endAt }, endAt: { gt: args.startAt } },
    });
    if (rest) return 'That driver is on a required rest period';
    return null;
  }

  private async driverIsClear(driver: Driver, endAt: Date) {
    if (driver.status !== 'APPROVED' || driver.licenceExpiry < endAt) return false;
    const blocking = await this.prisma.document.findFirst({
      where: {
        ownerType: 'DRIVER',
        ownerId: driver.id,
        OR: [{ status: { not: 'APPROVED' } }, { expiresOn: { lt: endAt } }],
      },
    });
    return !blocking;
  }

  private async pickDriver(cityId: string, endAt: Date, preferredId?: string | null, busyCheck?: (driverId: string) => Promise<boolean>) {
    const drivers = await this.prisma.driver.findMany({
      where: { cityId, status: 'APPROVED' },
      orderBy: { rating: 'desc' },
    });
    const ordered = preferredId
      ? [...drivers.filter((driver) => driver.id === preferredId), ...drivers.filter((driver) => driver.id !== preferredId)]
      : drivers;
    for (const driver of ordered) {
      if (!(await this.driverIsClear(driver, endAt))) continue;
      if (busyCheck && (await busyCheck(driver.id))) continue;
      return { driver, preferredHonoured: !preferredId || driver.id === preferredId };
    }
    return null;
  }

  async create(
    user: User,
    input: QuoteInput & {
      vehicleId: string;
      pickupLabel: string;
      pickupLat?: number;
      pickupLng?: number;
      pickupKind?: string;
      flightNumber?: string;
      childSeat?: boolean;
      accessibility?: boolean;
      notes?: string;
      passengerId?: string;
      preferredDriverId?: string;
    },
  ) {
    const quoted = await this.quote(input);
    const vehicle = quoted.vehicles.find((item) => item.id === input.vehicleId);
    if (!vehicle) throw new NotFoundException('Choose a vehicle from this city');
    if (!vehicle.fits) {
      throw new BadRequestException('That vehicle does not have enough seats or luggage space for this stay');
    }
    if (input.childSeat && !vehicle.childSeat) {
      throw new BadRequestException('A child seat is not available on that vehicle');
    }
    const rules = await this.policy();
    const window = stayWindow(quoted.startDate, quoted.endDate, input.pickupTime, input.type);
    const reference = `OVK-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const booking = await this.prisma.booking.create({
      data: {
        reference,
        customerId: user.id,
        organiserId: user.id,
        payerId: user.id,
        passengerId: input.passengerId,
        cityId: quoted.city.id,
        vehicleId: vehicle.id,
        preferredDriverId: input.preferredDriverId,
        type: input.type,
        period: quoted.period,
        status: BookingStatus.DRAFT,
        startDate: quoted.startDate,
        endDate: quoted.endDate,
        pickupTime: input.pickupTime,
        startAt: window.startAt,
        endAt: window.endAt,
        pickupLabel: input.pickupLabel,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupKind: input.pickupKind || 'AIRPORT',
        passengers: input.passengers,
        luggage: input.luggage,
        flightNumber: input.flightNumber,
        childSeat: !!input.childSeat,
        accessibility: !!input.accessibility,
        notes: input.notes,
        promoCode: input.promoCode?.toUpperCase(),
        priceSnapshot: { ...vehicle, policyVersion: rules.policyVersion } as unknown as Prisma.InputJsonValue,
        policyVersion: rules.policyVersion,
        totalBdt: vehicle.totalBdt,
        depositBdt: vehicle.depositBdt,
        balanceBdt: vehicle.balanceBdt,
        discountBdt: vehicle.discountBdt,
      },
    });
    return this.present(booking.id, user);
  }

  private async owned(user: User, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const staff = ['ADMIN', 'DISPATCHER', 'SUPPORT', 'FLEET_MANAGER', 'FINANCE'].includes(user.role);
    if (!staff && booking.customerId !== user.id && booking.organiserId !== user.id && booking.payerId !== user.id) {
      throw new ForbiddenException('You cannot open this booking');
    }
    return booking;
  }

  async present(id: string, viewer?: User) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        city: true,
        vehicle: true,
        driver: { include: { user: true } },
        journeys: { orderBy: { date: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        invoices: true,
        expenses: true,
        shares: true,
        reviews: true,
        amendments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const paidBdt = booking.payments
      .filter((payment) => payment.status === 'SUCCEEDED' && payment.kind !== 'TIP')
      .reduce((sum, payment) => sum + payment.amountBdt, 0);
    const rules = await this.policy();
    const hoursUsed = booking.journeys.reduce((sum, journey) => sum + journey.hoursUsed, 0);
    const kmUsed = booking.journeys.reduce((sum, journey) => sum + journey.kmUsed, 0);
    const days = booking.type === 'DAY' ? 1 : Math.max(daysBetween(booking.startDate, booking.endDate), 1);
    const driverPrivate = viewer?.role === 'DRIVER';
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      type: booking.type,
      period: booking.period,
      city: { id: booking.city.id, name: booking.city.name, slug: booking.city.slug },
      datesLabel:
        booking.startDate === booking.endDate
          ? formatLongDate(booking.startDate)
          : `${formatLongDate(booking.startDate)} – ${formatLongDate(booking.endDate)}`,
      startDate: booking.startDate,
      endDate: booking.endDate,
      pickupTime: booking.pickupTime,
      pickupLabel: booking.pickupLabel,
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      passengers: booking.passengers,
      luggage: booking.luggage,
      flightNumber: booking.flightNumber,
      childSeat: booking.childSeat,
      accessibility: booking.accessibility,
      notes: booking.notes,
      termsAccepted: booking.termsAccepted,
      totalBdt: booking.totalBdt,
      depositBdt: booking.depositBdt,
      balanceBdt: booking.balanceBdt,
      discountBdt: booking.discountBdt,
      paidBdt,
      dueBdt: Math.max(booking.totalBdt - paidBdt, 0),
      priceSnapshot: booking.priceSnapshot,
      policyVersion: booking.policyVersion,
      currency: booking.currency,
      vehicle: booking.vehicle
        ? {
            id: booking.vehicle.id,
            name: booking.vehicle.name,
            subtitle: booking.vehicle.subtitle,
            category: booking.vehicle.category,
            seats: booking.vehicle.seats,
            luggage: booking.vehicle.luggage,
            photos: booking.vehicle.photos,
            airConditioning: booking.vehicle.airConditioning,
            description: booking.vehicle.description,
            guaranteeType: booking.vehicle.guaranteeType,
            registrationNo: driverPrivate ? undefined : booking.vehicle.registrationNo,
          }
        : null,
      driver: booking.driver
        ? {
            id: booking.driver.id,
            name: booking.driver.user.name,
            photoUrl: booking.driver.photoUrl || booking.driver.user.photoUrl,
            languages: booking.driver.languages,
            experienceYears: booking.driver.experienceYears,
            rating: booking.driver.rating,
            reviewCount: booking.driver.reviewCount,
            phone: booking.driver.user.phone,
            bio: booking.driver.bio,
          }
        : null,
      allowance: {
        includedHours: rules.includedHoursPerDay * days,
        includedKm: rules.includedKmPerDay * days,
        hoursUsed,
        kmUsed,
        hoursRemaining: rules.includedHoursPerDay * days - hoursUsed,
        kmRemaining: rules.includedKmPerDay * days - kmUsed,
      },
      journeys: booking.journeys,
      payments: booking.payments.map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        method: payment.method,
        status: payment.status,
        amountBdt: payment.amountBdt,
        displayLabel: payment.displayLabel,
        createdAt: payment.createdAt,
      })),
      invoices: booking.invoices,
      expenses: booking.expenses,
      amendments: booking.amendments,
      shares: driverPrivate
        ? []
        : booking.shares.map((share) => ({
            id: share.id,
            name: share.name,
            phone: share.phone,
            scope: share.scope,
            status: share.status,
            endsAt: share.endsAt,
            token: share.token,
          })),
      review: booking.reviews[0] || null,
      createdAt: booking.createdAt,
    };
  }

  async mine(user: User) {
    const rows = await this.prisma.booking.findMany({
      where: { customerId: user.id, status: { not: 'DRAFT' } },
      orderBy: { startAt: 'desc' },
    });
    return Promise.all(rows.map((row) => this.present(row.id, user)));
  }

  async open(user: User, id: string) {
    await this.owned(user, id);
    return this.present(id, user);
  }

  async hold(user: User, id: string) {
    const booking = await this.owned(user, id);
    if (booking.status !== BookingStatus.DRAFT && booking.status !== BookingStatus.RESERVED) {
      throw new BadRequestException('This booking can no longer be reserved');
    }
    if (!booking.vehicleId) throw new BadRequestException('Choose a vehicle first');
    const rules = await this.policy();
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: booking.vehicleId } });
    if (!vehicle?.active || !vehicle.approved) throw new BadRequestException('That vehicle is not bookable');
    const fitness = await this.prisma.document.findFirst({
      where: {
        ownerType: 'VEHICLE',
        ownerId: vehicle.id,
        kind: 'FITNESS',
        status: 'APPROVED',
        OR: [{ expiresOn: null }, { expiresOn: { gte: booking.endAt } }],
      },
    });
    if (!fitness) throw new ConflictException('That vehicle is blocked because a required document is not valid');
    const picked = await this.pickDriver(booking.cityId, booking.endAt, booking.preferredDriverId, async (driverId) => {
      const reason = await this.clash(
        this.prisma,
        {
          vehicleId: vehicle.id,
          driverId,
          startAt: booking.startAt,
          endAt: booking.endAt,
          ignoreBookingId: booking.id,
        },
        rules.turnaroundHours,
      );
      return !!reason;
    });
    if (!picked) throw new ConflictException('No vetted driver is free for the whole stay');

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicle.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${picked.driver.id} FOR UPDATE`;
        const reason = await this.clash(
          tx,
          {
            vehicleId: vehicle.id,
            driverId: picked.driver.id,
            startAt: booking.startAt,
            endAt: booking.endAt,
            ignoreBookingId: booking.id,
          },
          rules.turnaroundHours,
        );
        if (reason) throw new ConflictException(reason);
        await tx.checkoutHold.updateMany({
          where: { bookingId: booking.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });
        const hold = await tx.checkoutHold.create({
          data: {
            bookingId: booking.id,
            vehicleId: vehicle.id,
            driverId: picked.driver.id,
            startAt: booking.startAt,
            endAt: booking.endAt,
            expiresAt: new Date(Date.now() + rules.holdMinutes * 60 * 1000),
            status: 'ACTIVE',
          },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.RESERVED, driverId: picked.driver.id },
        });
        return hold;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
    );

    const view = await this.present(booking.id, user);
    return { ...view, holdExpiresAt: result.expiresAt, preferredDriverAvailable: picked.preferredHonoured };
  }

  async pay(
    user: User,
    id: string,
    input: { kind: PaymentKind; method: PaymentMethod; idempotencyKey: string; termsAccepted?: boolean; simulateFailure?: boolean },
  ) {
    if (input.kind === PaymentKind.TIP) throw new BadRequestException('Tips are taken from the tip endpoint');
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { payment: this.paymentView(existing), booking: await this.present(existing.bookingId || id, user), repeated: true };

    const booking = await this.owned(user, id);
    if (!input.termsAccepted && !booking.termsAccepted) {
      throw new BadRequestException('Agree to the terms and conditions before payment');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('This booking is cancelled');
    }
    if (booking.status === BookingStatus.DRAFT) {
      throw new BadRequestException('Reserve the vehicle before payment');
    }

    const paid = await this.paidAmount(booking.id);
    const outstanding = booking.totalBdt - paid;
    if (outstanding <= 0) throw new BadRequestException('This booking is already paid');
    let amount = outstanding;
    if (input.kind === PaymentKind.DEPOSIT) amount = Math.max(Math.min(booking.depositBdt - paid, outstanding), 0);
    if (input.kind === PaymentKind.BALANCE || input.kind === PaymentKind.FULL) amount = outstanding;
    if (amount <= 0) throw new BadRequestException('Nothing is due for that payment');

    const rules = await this.policy();
    try {
      const payment = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${booking.id} FOR UPDATE`;
          const again = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (again) return again;

          if (input.simulateFailure) {
            return tx.payment.create({
              data: {
                bookingId: booking.id,
                userId: user.id,
                kind: input.kind,
                method: input.method,
                status: PayState.FAILED,
                amountBdt: amount,
                idempotencyKey: input.idempotencyKey,
                displayLabel: this.methodLabel(input.method),
                failureReason: 'The payment provider declined this attempt',
              },
            });
          }

          const hold = await tx.checkoutHold.findFirst({
            where: { bookingId: booking.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
          });
          const vehicleId = hold?.vehicleId || booking.vehicleId;
          const driverId = hold?.driverId || booking.driverId;
          if (!vehicleId || !driverId) throw new ConflictException('Reserve a vehicle and driver before paying');

          if (!hold) {
            await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${driverId} FOR UPDATE`;
            const reason = await this.clash(
              tx,
              { vehicleId, driverId, startAt: booking.startAt, endAt: booking.endAt, ignoreBookingId: booking.id },
              rules.turnaroundHours,
            );
            if (reason) {
              throw new ConflictException('The reservation expired and those dates were taken. No charge was made.');
            }
          }

          const created = await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: user.id,
              kind: input.kind,
              method: input.method,
              status: PayState.SUCCEEDED,
              amountBdt: amount,
              idempotencyKey: input.idempotencyKey,
              providerRef: `local_${randomBytes(4).toString('hex')}`,
              displayLabel: this.methodLabel(input.method),
            },
          });

          const newPaid = paid + amount;
          const paymentStatus = newPaid >= booking.totalBdt ? 'PAID' : newPaid >= booking.depositBdt ? 'DEPOSIT_PAID' : 'PARTIAL';
          const now = new Date();
          let status: BookingStatus = BookingStatus.CONFIRMED;
          if (booking.startAt <= now && booking.endAt >= now) status = BookingStatus.ACTIVE;

          const alreadyAllocated = await tx.allocation.findFirst({
            where: { bookingId: booking.id, status: 'ACTIVE' },
          });
          if (!alreadyAllocated) {
            await tx.allocation.create({
              data: {
                bookingId: booking.id,
                vehicleId,
                driverId,
                startAt: booking.startAt,
                endAt: booking.endAt,
                kind: 'PRIMARY',
              },
            });
            const dates = booking.type === 'DAY' ? [booking.startDate] : eachDate(booking.startDate, booking.endDate);
            await tx.journey.createMany({
              data: dates.map((date) => ({ bookingId: booking.id, date, destination: booking.pickupLabel })),
            });
            const count = await tx.invoice.count();
            await tx.invoice.create({
              data: {
                bookingId: booking.id,
                number: `INV-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`,
                amountBdt: amount,
              },
            });
          }
          if (hold) await tx.checkoutHold.update({ where: { id: hold.id }, data: { status: 'CONVERTED' } });
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status,
              paymentStatus,
              vehicleId,
              driverId,
              termsAccepted: true,
              termsAcceptedAt: booking.termsAcceptedAt || now,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
      );

      if (payment.status === PayState.SUCCEEDED) {
        await this.notify.send(user.id, 'Booking confirmed', `${booking.reference} is confirmed. ${this.methodLabel(input.method)} ${amount} BDT.`, booking.id);
        if (booking.driverId) {
          const driver = await this.prisma.driver.findUnique({ where: { id: booking.driverId } });
          if (driver) await this.notify.send(driver.userId, 'New assignment', `${booking.reference} is assigned to you.`, booking.id);
        }
      }
      return { payment: this.paymentView(payment), booking: await this.present(booking.id, user), repeated: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (winner) return { payment: this.paymentView(winner), booking: await this.present(booking.id, user), repeated: true };
      }
      throw error;
    }
  }

  private methodLabel(method: PaymentMethod) {
    if (method === 'BKASH') return 'bKash';
    if (method === 'NAGAD') return 'Nagad';
    return 'Card';
  }

  private paymentView(payment: { id: string; status: PayState; amountBdt: number; kind: PaymentKind; method: PaymentMethod; displayLabel: string | null; failureReason: string | null }) {
    return payment;
  }

  private async paidAmount(bookingId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { bookingId, status: 'SUCCEEDED', kind: { not: 'TIP' } },
    });
    return rows.reduce((sum, row) => sum + row.amountBdt, 0);
  }

  async cancel(user: User, id: string, reason: string) {
    const booking = await this.owned(user, id);
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('This booking cannot be cancelled');
    }
    const daysUntil = (booking.startAt.getTime() - Date.now()) / 86_400_000;
    const percent = daysUntil > 7 ? 100 : daysUntil >= 2 ? 50 : 0;
    const paid = await this.paidAmount(id);
    const refundAmount = Math.round((paid * percent) / 100);
    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelReason: reason,
          paymentStatus: refundAmount > 0 ? 'REFUND_PENDING' : booking.paymentStatus,
        },
      });
      await tx.allocation.updateMany({ where: { bookingId: id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
      await tx.checkoutHold.updateMany({ where: { bookingId: id, status: 'ACTIVE' }, data: { status: 'RELEASED' } });
      if (refundAmount > 0) {
        const payment = await tx.payment.findFirst({
          where: { bookingId: id, status: 'SUCCEEDED', kind: { not: 'TIP' } },
          orderBy: { createdAt: 'desc' },
        });
        if (payment) {
          await tx.refund.create({
            data: { bookingId: id, paymentId: payment.id, amountBdt: refundAmount, reason, status: 'PENDING' },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'booking.cancel',
          entityType: 'Booking',
          entityId: id,
          payload: { reason, percent, refundAmount },
        },
      });
    });
    await this.notify.send(user.id, 'Cancellation received', `${booking.reference} is cancelled. Any refund waits for finance approval.`, id);
    return this.present(id, user);
  }

  async quoteChange(user: User, id: string, kind: string, payload: Prisma.InputJsonValue) {
    const booking = await this.owned(user, id);
    if (!['CONFIRMED', 'ACTIVE', 'RESERVED'].includes(booking.status)) {
      throw new BadRequestException('This booking cannot be changed');
    }
    const body = payload as { endDate?: string; hours?: number; km?: number };
    let priceDiff = 0;
    const rules = await this.policy();
    if (kind === 'EXTEND' && body.endDate) {
      if (body.endDate <= booking.endDate) throw new BadRequestException('Choose an end date after the current one');
      const extraDays = daysBetween(booking.endDate, body.endDate);
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: booking.vehicleId || '' } });
      if (!vehicle || !booking.driverId) throw new BadRequestException('Assign a vehicle before extending');
      const endAt = new Date(`${body.endDate}T${booking.pickupTime}:00+06:00`);
      const reason = await this.clash(
        this.prisma,
        { vehicleId: vehicle.id, driverId: booking.driverId, startAt: booking.endAt, endAt, ignoreBookingId: booking.id },
        rules.turnaroundHours,
      );
      if (reason) throw new ConflictException(reason);
      priceDiff = vehicle.dailyRate * extraDays;
    }
    if (kind === 'EXTRA_JOURNEY') {
      const view = await this.present(id, user);
      const extraHours = Math.max((body.hours || 0) - Math.max(view.allowance.hoursRemaining, 0), 0);
      const extraKm = Math.max((body.km || 0) - Math.max(view.allowance.kmRemaining, 0), 0);
      priceDiff = extraHours * rules.extraHourRate + extraKm * rules.extraKmRate;
    }
    const amendment = await this.prisma.amendment.create({
      data: { bookingId: id, kind, payload, priceDiffBdt: priceDiff, status: 'QUOTED' },
    });
    return amendment;
  }

  async acceptChange(user: User, id: string, amendmentId: string) {
    const booking = await this.owned(user, id);
    const amendment = await this.prisma.amendment.findFirst({ where: { id: amendmentId, bookingId: id } });
    if (!amendment || amendment.status !== 'QUOTED') throw new NotFoundException('That change is not waiting for acceptance');
    const payload = amendment.payload as { endDate?: string; pickupLabel?: string };
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.BookingUpdateInput = {};
      if (amendment.kind === 'EXTEND' && payload.endDate) {
        data.endDate = payload.endDate;
        data.endAt = new Date(`${payload.endDate}T${booking.pickupTime}:00+06:00`);
        data.totalBdt = booking.totalBdt + amendment.priceDiffBdt;
        data.balanceBdt = booking.balanceBdt + amendment.priceDiffBdt;
        if (booking.paymentStatus === 'PAID') data.paymentStatus = 'PARTIAL';
        await tx.allocation.updateMany({
          where: { bookingId: id, status: 'ACTIVE' },
          data: { endAt: new Date(`${payload.endDate}T${booking.pickupTime}:00+06:00`) },
        });
        const dates = eachDate(booking.endDate, payload.endDate);
        if (dates.length) {
          await tx.journey.createMany({ data: dates.map((date) => ({ bookingId: id, date })) });
        }
      }
      if (amendment.kind === 'PICKUP' && payload.pickupLabel) data.pickupLabel = payload.pickupLabel;
      if (amendment.priceDiffBdt && amendment.kind === 'EXTRA_JOURNEY') {
        data.totalBdt = booking.totalBdt + amendment.priceDiffBdt;
        data.balanceBdt = booking.balanceBdt + amendment.priceDiffBdt;
        if (booking.paymentStatus === 'PAID') data.paymentStatus = 'PARTIAL';
      }
      await tx.booking.update({ where: { id }, data });
      await tx.amendment.update({ where: { id: amendmentId }, data: { status: 'ACCEPTED' } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'booking.amend', entityType: 'Amendment', entityId: amendmentId, payload: amendment.payload as Prisma.InputJsonValue },
      });
    });
    return this.present(id, user);
  }

  async invoicePdf(user: User, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { booking: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.owned(user, invoice.bookingId);
    return simplePdf(`OVYK invoice ${invoice.number}`, [
      'The new word for Comfort',
      `Booking ${invoice.booking.reference}`,
      `Amount BDT ${invoice.amountBdt.toLocaleString('en-US')}`,
      `Stay ${invoice.booking.startDate} to ${invoice.booking.endDate}`,
      `Pickup ${invoice.booking.pickupLabel} at ${invoice.booking.pickupTime}`,
      'Settlement currency: BDT',
      'This local invoice is generated by the OVYK API.',
    ]);
  }

  async releaseExpiredHolds() {
    const expired = await this.prisma.checkoutHold.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    });
    for (const hold of expired) {
      await this.prisma.checkoutHold.update({ where: { id: hold.id }, data: { status: 'EXPIRED' } });
      const booking = await this.prisma.booking.findUnique({ where: { id: hold.bookingId } });
      if (booking?.status === 'RESERVED') {
        await this.prisma.booking.update({ where: { id: booking.id }, data: { status: 'DRAFT' } });
      }
    }
    return expired.length;
  }
}
