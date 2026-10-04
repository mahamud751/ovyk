# OVYK

Premium private transport for a stay. Two projects:

- `app` — React Native CLI customer and driver app
- `server` — NestJS, Prisma, PostgreSQL, Swagger

The customer screens follow the charcoal, ivory and champagne concept: Welcome, Home, Plan your stay, Choose your vehicle, Vehicle detail and Booking review.

## Server

PostgreSQL database `ovyk` on localhost.

```bash
cd server
npm install
npx prisma migrate dev --name init
npm run seed
npm run start
```

- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/docs
- Operations: http://localhost:3000/ops.html
- Family tracking: http://localhost:3000/track.html

Local OTP code: `123456`.

| Who | Sign in |
| --- | --- |
| Ahad, customer | `+8801711111111` and code `123456` |
| Imran, driver | `driver@ovyk.com` / `driver123` or `+8801811111111` |
| Admin | `admin@ovyk.com` / `admin123`, then code `123456` |
| Responder | `respond@ovyk.com` / `respond123`, then code `123456` |
| Finance | `finance@ovyk.com` / `finance123`, then code `123456` |
| Fleet partner | `partner@ovyk.com` / `partner123` |

The 14-day Sylhet example, 21 Oct 2025 to 4 Nov 2025, prices the Family Hiace at BDT 84,000 with BDT 21,000 due now. Payments are simulated. Card numbers are never sent or stored.

## App

```bash
cd app
npm install
npm start
npm run android
```

iOS also needs CocoaPods: `cd ios && bundle install && bundle exec pod install`, then `npm run ios`.

Android emulator uses `http://10.0.2.2:3000`. iOS simulator uses `http://localhost:3000`. The Android build needs JDK 17. If Metro port 8081 is already taken, start with `npm start -- --port 8082` and `npm run android -- --port 8082`.
