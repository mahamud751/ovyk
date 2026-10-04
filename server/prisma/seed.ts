import { DocStatus, DriverStatus, Language, PartnerStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const driverPassword = await bcrypt.hash('driver123', 10);
  const respondPassword = await bcrypt.hash('respond123', 10);
  const partnerPassword = await bcrypt.hash('partner123', 10);
  const financePassword = await bcrypt.hash('finance123', 10);

  const partner = await prisma.partner.upsert({
    where: { id: 'partner-ovyk-sylhet' },
    update: {},
    create: {
      id: 'partner-ovyk-sylhet',
      name: 'OVYK Sylhet Fleet',
      status: PartnerStatus.APPROVED,
      commissionPercent: 80,
      settlementNotes: 'Monthly settlement. Tips are excluded and paid in full to the driver.',
    },
  });

  const sylhet = await prisma.city.upsert({
    where: { slug: 'sylhet' },
    update: {},
    create: { slug: 'sylhet', name: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  });
  const dhaka = await prisma.city.upsert({
    where: { slug: 'dhaka' },
    update: {},
    create: { slug: 'dhaka', name: 'Dhaka', lat: 23.8103, lng: 90.4125, active: true },
  });
  await prisma.city.upsert({
    where: { slug: 'chattogram' },
    update: {},
    create: { slug: 'chattogram', name: 'Chattogram', lat: 22.3569, lng: 91.7832, active: true },
  });

  const airport = await prisma.place.findFirst({ where: { name: 'Sylhet International Airport' } });
  if (!airport) {
    await prisma.place.createMany({
      data: [
        { cityId: sylhet.id, kind: 'AIRPORT', name: 'Sylhet International Airport', line: 'Osmani International Airport, Sylhet', lat: 24.9639, lng: 91.8668 },
        { cityId: sylhet.id, kind: 'HOTEL', name: 'Rose Garden Hotel', line: 'Rose Garden Hotel, Sylhet', lat: 24.9042, lng: 91.8611 },
        { cityId: dhaka.id, kind: 'AIRPORT', name: 'Hazrat Shahjalal International Airport', line: 'Dhaka Airport', lat: 23.8433, lng: 90.3978 },
      ],
    });
  }

  const ahad = await prisma.user.upsert({
    where: { phone: '+8801711111111' },
    update: { name: 'Ahad', preferredLanguage: Language.EN },
    create: {
      role: Role.CUSTOMER,
      phone: '+8801711111111',
      email: 'ahad@example.com',
      name: 'Ahad',
      photoUrl: '/media/driver.jpg',
      preferredLanguage: Language.EN,
      safeContactMethod: 'phone',
      emergencyName: 'Family',
      emergencyPhone: '+8801711111199',
    },
  });
  const self = await prisma.passenger.findFirst({ where: { organiserId: ahad.id, relationship: 'self' } });
  if (!self) {
    await prisma.passenger.create({ data: { organiserId: ahad.id, name: 'Ahad', phone: ahad.phone, relationship: 'self' } });
  }
  const home = await prisma.address.findFirst({ where: { userId: ahad.id } });
  if (!home) {
    await prisma.address.create({
      data: { userId: ahad.id, label: 'Home', kind: 'HOME', line: 'Amberkhana, Sylhet', cityId: sylhet.id, lat: 24.907, lng: 91.87 },
    });
  }

  const nadia = await prisma.user.upsert({
    where: { phone: '+8801911111111' },
    update: {},
    create: { role: Role.CUSTOMER, phone: '+8801911111111', name: 'Nadia Rahman', preferredLanguage: Language.EN },
  });

  await prisma.user.upsert({
    where: { email: 'admin@ovyk.com' },
    update: {},
    create: {
      role: Role.ADMIN,
      email: 'admin@ovyk.com',
      phone: '+8801700000001',
      name: 'OVYK Admin',
      passwordHash: password,
      mfaEnabled: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'respond@ovyk.com' },
    update: {},
    create: {
      role: Role.EMERGENCY_RESPONDER,
      email: 'respond@ovyk.com',
      phone: '+8801700000002',
      name: 'Duty responder',
      passwordHash: respondPassword,
      mfaEnabled: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'finance@ovyk.com' },
    update: {},
    create: { role: Role.FINANCE, email: 'finance@ovyk.com', phone: '+8801700000003', name: 'OVYK Finance', passwordHash: financePassword, mfaEnabled: true },
  });
  await prisma.user.upsert({
    where: { email: 'dispatch@ovyk.com' },
    update: {},
    create: { role: Role.DISPATCHER, email: 'dispatch@ovyk.com', phone: '+8801700000004', name: 'OVYK Dispatch', passwordHash: password, mfaEnabled: true },
  });
  await prisma.user.upsert({
    where: { email: 'partner@ovyk.com' },
    update: {},
    create: {
      role: Role.PARTNER,
      email: 'partner@ovyk.com',
      phone: '+8801700000005',
      name: 'Sylhet Fleet Partner',
      passwordHash: partnerPassword,
      partnerId: partner.id,
    },
  });

  const imranUser = await prisma.user.upsert({
    where: { email: 'driver@ovyk.com' },
    update: {},
    create: {
      role: Role.DRIVER,
      email: 'driver@ovyk.com',
      phone: '+8801811111111',
      name: 'Imran Hossain',
      passwordHash: driverPassword,
      photoUrl: '/media/driver.jpg',
      partnerId: partner.id,
    },
  });
  const farhanUser = await prisma.user.upsert({
    where: { email: 'farhan@ovyk.com' },
    update: {},
    create: {
      role: Role.DRIVER,
      email: 'farhan@ovyk.com',
      phone: '+8801811111112',
      name: 'Farhan Ahmed',
      passwordHash: driverPassword,
      photoUrl: '/media/driver.jpg',
      partnerId: partner.id,
    },
  });
  const pendingUser = await prisma.user.upsert({
    where: { email: 'pending.driver@ovyk.com' },
    update: {},
    create: {
      role: Role.DRIVER,
      email: 'pending.driver@ovyk.com',
      phone: '+8801811111113',
      name: 'Karim Uddin',
      passwordHash: driverPassword,
      partnerId: partner.id,
    },
  });

  const imran = await prisma.driver.upsert({
    where: { userId: imranUser.id },
    update: {},
    create: {
      userId: imranUser.id,
      partnerId: partner.id,
      cityId: sylhet.id,
      languages: ['English', 'Bangla'],
      experienceYears: 8,
      rating: 4.9,
      reviewCount: 128,
      licenceNumber: 'SYL-DRV-20418',
      licenceExpiry: new Date('2027-12-31'),
      status: DriverStatus.APPROVED,
      photoUrl: '/media/driver.jpg',
      bio: 'A calm, uniformed chauffeur for family and executive stays.',
      uniformCheckedAt: new Date('2026-09-01'),
      trainingNote: 'Service standards and emergency procedure, September 2026',
    },
  });
  const farhan = await prisma.driver.upsert({
    where: { userId: farhanUser.id },
    update: {},
    create: {
      userId: farhanUser.id,
      partnerId: partner.id,
      cityId: sylhet.id,
      languages: ['Bangla', 'English'],
      experienceYears: 6,
      rating: 4.8,
      reviewCount: 86,
      licenceNumber: 'SYL-DRV-21802',
      licenceExpiry: new Date('2027-06-30'),
      status: DriverStatus.APPROVED,
      photoUrl: '/media/driver.jpg',
      bio: 'Relief and long-stay chauffeur.',
      uniformCheckedAt: new Date('2026-09-01'),
      trainingNote: 'Service standards, September 2026',
    },
  });
  const karim = await prisma.driver.upsert({
    where: { userId: pendingUser.id },
    update: {},
    create: {
      userId: pendingUser.id,
      partnerId: partner.id,
      cityId: sylhet.id,
      languages: ['Bangla'],
      experienceYears: 3,
      licenceNumber: 'SYL-DRV-30011',
      licenceExpiry: new Date('2027-01-31'),
      status: DriverStatus.PENDING,
      bio: 'Waiting for OVYK approval.',
    },
  });

  for (const driver of [imran, farhan]) {
    const existing = await prisma.document.findFirst({ where: { ownerType: 'DRIVER', ownerId: driver.id, kind: 'LICENCE' } });
    if (!existing) {
      await prisma.document.create({
        data: {
          ownerType: 'DRIVER',
          ownerId: driver.id,
          kind: 'LICENCE',
          fileName: `${driver.licenceNumber}.pdf`,
          status: DocStatus.APPROVED,
          expiresOn: driver.licenceExpiry,
        },
      });
    }
  }
  const pendingDoc = await prisma.document.findFirst({ where: { ownerId: karim.id } });
  if (!pendingDoc) {
    await prisma.document.create({
      data: { ownerType: 'DRIVER', ownerId: karim.id, kind: 'LICENCE', fileName: 'pending.pdf', status: DocStatus.PENDING, expiresOn: karim.licenceExpiry },
    });
  }

  const vehicles = [
    {
      slug: 'executive-sedan',
      category: 'EXECUTIVE' as const,
      name: 'Executive Sedan',
      subtitle: 'Toyota Camry or similar',
      description: 'A quiet executive sedan for smaller parties.',
      descriptionBn: 'ছোট দলের জন্য একটি শান্ত এক্সিকিউটিভ সেডান।',
      make: 'Toyota',
      model: 'Camry',
      modelYear: 2024,
      seats: 4,
      luggage: 2,
      dailyRate: 4000,
      photos: ['/media/sedan-lake.jpg', '/media/interior-bench.jpg', '/media/interior-front.jpg'],
      registrationNo: 'SYL-CAM-4401',
    },
    {
      slug: 'family-hiace',
      category: 'FAMILY' as const,
      name: 'Family Hiace',
      subtitle: 'Toyota Hiace or similar',
      description: 'Spacious, comfortable and ideal for families.',
      descriptionBn: 'পরিবারের জন্য প্রশস্ত ও আরামদায়ক।',
      make: 'Toyota',
      model: 'Hiace',
      modelYear: 2023,
      seats: 10,
      luggage: 6,
      dailyRate: 6000,
      photos: ['/media/van-hotel.jpg', '/media/interior-van.jpg', '/media/interior-bench.jpg', '/media/interior-front.jpg'],
      registrationNo: 'SYL-HIA-1006',
    },
    {
      slug: 'premium-suv',
      category: 'PREMIUM' as const,
      name: 'Premium SUV',
      subtitle: 'Toyota Land Cruiser Prado or similar',
      description: 'A premium SUV for longer roads out of the city.',
      descriptionBn: 'শহরের বাইরের দীর্ঘ পথের জন্য একটি প্রিমিয়াম এসইউভি।',
      make: 'Toyota',
      model: 'Land Cruiser Prado',
      modelYear: 2024,
      seats: 7,
      luggage: 4,
      dailyRate: 9000,
      photos: ['/media/suv-hills.jpg', '/media/interior-front.jpg', '/media/interior-bench.jpg'],
      registrationNo: 'SYL-PRD-7702',
    },
  ];

  for (const vehicle of vehicles) {
    const row = await prisma.vehicle.upsert({
      where: { slug: vehicle.slug },
      update: { dailyRate: vehicle.dailyRate, photos: vehicle.photos },
      create: {
        ...vehicle,
        partnerId: partner.id,
        cityId: sylhet.id,
        features: ['Air conditioning', 'Leather seats', 'Bottled water'],
        airConditioning: true,
        verified: true,
        approved: true,
        active: true,
        guaranteeType: 'CATEGORY',
        childSeat: true,
      },
    });
    const doc = await prisma.document.findFirst({ where: { ownerType: 'VEHICLE', ownerId: row.id, kind: 'FITNESS' } });
    if (!doc) {
      await prisma.document.create({
        data: { ownerType: 'VEHICLE', ownerId: row.id, kind: 'FITNESS', fileName: `${row.registrationNo}-fitness.pdf`, status: DocStatus.APPROVED, expiresOn: new Date('2027-12-31') },
      });
    }
  }

  const settings: Array<[string, number | string]> = [
    ['depositPercent', 25],
    ['turnaroundHours', 2],
    ['holdMinutes', 15],
    ['includedHoursPerDay', 10],
    ['includedKmPerDay', 100],
    ['extraHourRate', 800],
    ['extraKmRate', 40],
    ['escalationMinutes', 5],
    ['staleSeconds', 90],
    ['policyVersion', '2026-10-02'],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await prisma.promoCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: { code: 'WELCOME10', percentOff: 10, active: true },
  });
  if ((await prisma.exchangeRate.count()) === 0) {
    await prisma.exchangeRate.createMany({
      data: [
        { quote: 'USD', rate: 120, asOf: new Date('2026-10-02T08:00:00+06:00') },
        { quote: 'GBP', rate: 155, asOf: new Date('2026-10-02T08:00:00+06:00') },
      ],
    });
  }

  const sedan = await prisma.vehicle.findUnique({ where: { slug: 'executive-sedan' } });
  const existingStay = await prisma.booking.findFirst({ where: { customerId: nadia.id, reference: 'OVK-2026-NADIA' } });
  if (sedan && !existingStay) {
    const startAt = new Date('2026-10-01T14:00:00+06:00');
    const endAt = new Date('2026-10-08T14:00:00+06:00');
    const booking = await prisma.booking.create({
      data: {
        reference: 'OVK-2026-NADIA',
        customerId: nadia.id,
        organiserId: nadia.id,
        payerId: nadia.id,
        cityId: sylhet.id,
        vehicleId: sedan.id,
        driverId: imran.id,
        type: 'STAY',
        period: 'WEEKLY',
        status: 'ACTIVE',
        paymentStatus: 'DEPOSIT_PAID',
        startDate: '2026-10-01',
        endDate: '2026-10-08',
        pickupTime: '14:00',
        startAt,
        endAt,
        pickupLabel: 'Sylhet International Airport',
        pickupLat: 24.9639,
        pickupLng: 91.8668,
        passengers: 2,
        luggage: 2,
        totalBdt: 28000,
        depositBdt: 7000,
        balanceBdt: 21000,
        termsAccepted: true,
        termsAcceptedAt: new Date('2026-09-20'),
        policyVersion: '2026-10-02',
        priceSnapshot: { name: 'Executive Sedan', totalBdt: 28000, depositPercent: 25 },
      },
    });
    await prisma.allocation.create({
      data: { bookingId: booking.id, vehicleId: sedan.id, driverId: imran.id, startAt, endAt, kind: 'PRIMARY' },
    });
    await prisma.journey.create({
      data: { bookingId: booking.id, date: '2026-10-04', status: 'IN_PROGRESS', destination: 'Rose Garden Hotel', hoursUsed: 3, kmUsed: 42 },
    });
    await prisma.locationPing.create({
      data: { bookingId: booking.id, driverId: imran.id, vehicleId: sedan.id, lat: 24.904, lng: 91.868, heading: 40, source: 'DRIVER_APP' },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: nadia.id,
        kind: 'DEPOSIT',
        method: 'BKASH',
        status: 'SUCCEEDED',
        amountBdt: 7000,
        idempotencyKey: 'seed-nadia-deposit',
        displayLabel: 'bKash',
        providerRef: 'local_seed',
      },
    });
  }

  console.log('OVYK seed ready');
  console.log('Customer Ahad +8801711111111  OTP 123456');
  console.log('Driver driver@ovyk.com / driver123  or +8801811111111');
  console.log('Admin admin@ovyk.com / admin123 then OTP 123456');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
