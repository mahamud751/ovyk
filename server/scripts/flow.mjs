const base = process.env.OVYK_API || 'http://localhost:3000/api';

async function api(path, options = {}, token) {
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const error = new Error(`${res.status} ${path} ${JSON.stringify(data)}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const phone = '+8801711111111';
await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
const session = await api('/auth/otp/verify', {
  method: 'POST',
  body: JSON.stringify({ phone, code: '123456', name: 'Ahad' }),
});
const token = session.accessToken;
assert(session.user.name === 'Ahad', 'expected Ahad');

const quote = await api('/quotes', {
  method: 'POST',
  body: JSON.stringify({
    citySlug: 'sylhet',
    startDate: '2025-10-21',
    endDate: '2025-11-04',
    pickupTime: '14:00',
    type: 'STAY',
    passengers: 4,
    luggage: 3,
  }),
}, token);
const hiace = quote.vehicles.find((vehicle) => vehicle.slug === 'family-hiace');
const sedan = quote.vehicles.find((vehicle) => vehicle.slug === 'executive-sedan');
assert(hiace.totalBdt === 84000, `hiace total ${hiace.totalBdt}`);
assert(hiace.depositBdt === 21000, `hiace deposit ${hiace.depositBdt}`);
assert(hiace.balanceBdt === 63000, `hiace balance ${hiace.balanceBdt}`);
assert(sedan.totalBdt === 56000, `sedan total ${sedan.totalBdt}`);
assert(quote.days === 14, `days ${quote.days}`);
assert(hiace.fits === true, 'hiace should fit 4 passengers and 3 bags');
assert(sedan.fits === false, 'sedan luggage is 2');

const booking = await api('/bookings', {
  method: 'POST',
  body: JSON.stringify({
    citySlug: 'sylhet',
    startDate: '2025-10-21',
    endDate: '2025-11-04',
    pickupTime: '14:00',
    type: 'STAY',
    passengers: 4,
    luggage: 3,
    vehicleId: hiace.id,
    pickupLabel: 'Sylhet International Airport',
    pickupKind: 'AIRPORT',
  }),
}, token);
const held = await api(`/bookings/${booking.id}/hold`, { method: 'POST' }, token);
assert(held.status === 'RESERVED', held.status);

const key = `flow-${Date.now()}`;
const paid = await api(`/bookings/${booking.id}/pay`, {
  method: 'POST',
  body: JSON.stringify({ kind: 'DEPOSIT', method: 'BKASH', idempotencyKey: key, termsAccepted: true }),
}, token);
assert(paid.payment.amountBdt === 21000, 'deposit charge');
assert(paid.booking.paymentStatus === 'DEPOSIT_PAID', paid.booking.paymentStatus);
const repeat = await api(`/bookings/${booking.id}/pay`, {
  method: 'POST',
  body: JSON.stringify({ kind: 'DEPOSIT', method: 'BKASH', idempotencyKey: key, termsAccepted: true }),
}, token);
assert(repeat.repeated === true, 'idempotent payment');
assert(repeat.payment.id === paid.payment.id, 'same payment');

let blocked = false;
try {
  const second = await api('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      citySlug: 'sylhet',
      startDate: '2025-10-21',
      endDate: '2025-11-04',
      pickupTime: '14:00',
      type: 'STAY',
      passengers: 4,
      luggage: 3,
      vehicleId: hiace.id,
      pickupLabel: 'Sylhet International Airport',
    }),
  }, token);
  await api(`/bookings/${second.id}/hold`, { method: 'POST' }, token);
} catch (error) {
  blocked = error.status === 409;
}
assert(blocked, 'overlapping vehicle hold should conflict');

const sos = await api('/emergencies', {
  method: 'POST',
  body: JSON.stringify({ bookingId: booking.id, silent: true }),
}, token);
assert(sos.statusLabel === 'Delivered', sos.statusLabel);

const driverLogin = await api('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'driver@ovyk.com', password: 'driver123' }),
});
const driverToken = driverLogin.accessToken;
let hidden = false;
try {
  await api('/ops/emergencies', {}, driverToken);
} catch (error) {
  hidden = error.status === 403;
}
assert(hidden, 'driver must not open the emergency queue');

const adminPassword = await api('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'admin@ovyk.com', password: 'admin123' }),
});
assert(adminPassword.mfaRequired === true, 'admin mfa');
const admin = await api('/auth/mfa', {
  method: 'POST',
  body: JSON.stringify({ mfaToken: adminPassword.mfaToken, code: '123456' }),
});
const queue = await api('/ops/emergencies', {}, admin.accessToken);
const mine = queue.find((item) => item.id === sos.id);
assert(mine, 'alert reached the dashboard');
const acked = await api(`/ops/emergencies/${sos.id}/acknowledge`, { method: 'POST', body: JSON.stringify({ note: 'Taken' }) }, admin.accessToken);
assert(acked.statusLabel === 'Acknowledged', acked.statusLabel);

console.log('OVYK flow passed');
console.log(booking.reference, 'deposit', paid.payment.amountBdt);
