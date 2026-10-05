import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { GhostButton, GoldButton, Header, Screen } from '../components/ui';
import { addDays, bdt } from '../format';
import { photoSource } from '../images';
import { Lang } from '../i18n';
import { SessionUser, useApp } from '../state';
import { colors, sans, serif } from '../theme';

type Stay = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  datesLabel: string;
  startDate: string;
  endDate: string;
  pickupLabel: string;
  pickupTime: string;
  totalBdt: number;
  paidBdt: number;
  dueBdt: number;
  vehicle: { name: string; photos: string[]; seats: number; luggage: number } | null;
  driver: { name: string; photoUrl?: string | null; phone?: string | null; languages: string[]; rating: number; reviewCount: number } | null;
  allowance: { includedHours: number; includedKm: number; hoursUsed: number; kmUsed: number; hoursRemaining: number; kmRemaining: number };
  journeys: { id: string; date: string; status: string; destination?: string }[];
  invoices: { id: string; number: string; amountBdt: number }[];
  expenses: { id: string; kind: string; amountBdt: number; status: string }[];
  shares: { id: string; name: string; status: string; token: string }[];
};

export function MyStayScreen({
  navigation,
}: {
  navigation: { navigate: (name: string, params?: object) => void; addListener: (event: 'focus', callback: () => void) => () => void };
}) {
  const [rows, setRows] = useState<Stay[]>([]);
  const [error, setError] = useState('');
  const load = () => api<Stay[]>('/bookings').then(setRows).catch((err) => setError(err.message));
  useEffect(() => navigation.addListener('focus', load), [navigation]);
  const current = rows.find((stay) => stay.status !== 'CANCELLED' && stay.status !== 'COMPLETED') || rows[0];

  return (
    <Screen>
      <Header title="My stay" onBell={() => navigation.navigate('Notifications')} />
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!current ? <Text style={styles.copy}>When you confirm a vehicle, the stay, driver and live tracking appear here.</Text> : null}
        {current ? <StayCard key={current.id} stay={current} navigation={navigation} onChange={load} /> : null}
        {rows.filter((stay) => stay !== current).map((stay) => (
          <Pressable key={stay.id} style={styles.card} onPress={() => navigation.navigate('Tracking', { bookingId: stay.id })}>
            <Text style={styles.ref}>{stay.reference}</Text>
            <Text style={styles.copy}>{stay.datesLabel} · {stay.status}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function StayCard({ stay, navigation, onChange }: { stay: Stay; navigation: { navigate: (name: string, params?: object) => void }; onChange: () => void }) {
  const [endDate, setEndDate] = useState(() => addDays(stay.endDate, 1));
  const [message, setMessage] = useState('');
  const [nominee, setNominee] = useState('Family');
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState('');
  const [note, setNote] = useState('');

  async function act(path: string, body?: object) {
    setNote('');
    try {
      await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      setMessage('Saved');
      onChange();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <View>
      <Text style={styles.kicker}>{stay.status === 'CONFIRMED' ? 'Confirmed booking' : stay.status.replaceAll('_', ' ')}</Text>
      <Text style={styles.title}>{stay.reference}</Text>
      <Text style={styles.copy}>{stay.datesLabel} · {stay.pickupTime}</Text>
      <Text style={styles.copy}>{stay.pickupLabel}</Text>
      {stay.vehicle ? <Image source={photoSource(stay.vehicle.photos[0])} style={styles.hero} /> : null}
      <Text style={styles.section}>{stay.vehicle?.name}</Text>
      {stay.driver ? (
        <View style={styles.driver}>
          <Image source={photoSource(stay.driver.photoUrl)} style={styles.avatar} />
          <View>
            <Text style={styles.section}>{stay.driver.name}</Text>
            <Text style={styles.copy}>{stay.driver.languages.join(', ')} · {stay.driver.rating.toFixed(1)} ({stay.driver.reviewCount})</Text>
          </View>
        </View>
      ) : <Text style={styles.copy}>Driver confirmation is still open.</Text>}
      <Text style={styles.section}>Allowance</Text>
      <Text style={styles.copy}>{stay.allowance.hoursUsed} of {stay.allowance.includedHours} hours · {stay.allowance.kmUsed} of {stay.allowance.includedKm} km</Text>
      <Text style={styles.copy}>Paid {bdt(stay.paidBdt)} · Balance {bdt(stay.dueBdt)}</Text>
      {stay.journeys.slice(0, 3).map((journey) => (
        <Text key={journey.id} style={styles.copy}>{journey.date} · {journey.status}{journey.destination ? ` · ${journey.destination}` : ''}</Text>
      ))}
      {stay.expenses.map((expense) => (
        <Text key={expense.id} style={styles.copy}>{expense.kind} {bdt(expense.amountBdt)} · {expense.status}</Text>
      ))}
      <View style={{ height: 10 }} />
      <GoldButton label="Live tracking" onPress={() => navigation.navigate('Tracking', { bookingId: stay.id })} />
      <View style={{ height: 10 }} />
      <GhostButton danger label="Emergency / SOS" onPress={() => navigation.navigate('Sos', { bookingId: stay.id })} />
      <Text style={styles.section}>Family tracking</Text>
      <TextInput value={nominee} onChangeText={setNominee} style={styles.input} />
      <GoldButton label="Share for 24 hours" onPress={() => act(`/bookings/${stay.id}/shares`, { name: nominee, scope: 'BOOKING', hours: 24 })} />
      {stay.shares.map((share) => (
        <Text key={share.id} style={styles.copy}>{share.name} · {share.status} · code {share.token.slice(0, 8)}</Text>
      ))}
      <Text style={styles.section}>Change this stay</Text>
      <TextInput value={endDate} onChangeText={setEndDate} style={styles.input} placeholder="New end date" placeholderTextColor={colors.muted} />
      <GoldButton label="Quote an extension" onPress={() => act(`/bookings/${stay.id}/changes`, { kind: 'EXTEND', endDate })} />
      <View style={{ height: 8 }} />
      <GoldButton label="Ask to cancel" onPress={() => act(`/bookings/${stay.id}/cancel`, { reason: 'Plans changed' })} />
      {stay.status === 'COMPLETED' ? (
        <>
          <Text style={styles.section}>Review</Text>
          <TextInput value={String(rating)} onChangeText={(value) => setRating(Number(value) || 5)} style={styles.input} />
          <GoldButton label="Send review" onPress={() => act(`/bookings/${stay.id}/review`, { overall: rating, comment: 'Thank you', comfort: rating, cleanliness: rating, punctuality: rating, professionalism: rating })} />
          <Text style={styles.section}>Tip the driver</Text>
          <View style={styles.tips}>
            {[200, 500, 1000].map((amount) => (
              <Pressable key={amount} onPress={() => setTip(String(amount))} style={styles.tip}><Text>{bdt(amount)}</Text></Pressable>
            ))}
          </View>
          <TextInput value={tip} onChangeText={setTip} style={styles.input} placeholder="Custom BDT amount" placeholderTextColor={colors.muted} keyboardType="number-pad" />
          <GoldButton label="Send tip" onPress={() => act(`/bookings/${stay.id}/tip`, { amountBdt: Number(tip), method: 'BKASH', idempotencyKey: `tip-${stay.id}-${tip}` })} />
        </>
      ) : null}
      {message ? <Text style={styles.copy}>{message}</Text> : null}
      {note ? <Text style={styles.error}>{note}</Text> : null}
      {stay.invoices[0] ? <Text style={styles.copy}>Invoice {stay.invoices[0].number}</Text> : null}
    </View>
  );
}

export function TrackingScreen({ navigation, route }: { navigation: { goBack: () => void; navigate: (name: string, params?: object) => void }; route: { params: { bookingId: string } } }) {
  const [track, setTrack] = useState<{ stale: boolean; message: string; current: { lat: number; lng: number; recordedAt: string; source: string } | null; lastKnown: { lat: number; lng: number; recordedAt: string } | null; destination: string; etaMinutes: number | null } | null>(null);
  const load = () => api<NonNullable<typeof track>>(`/bookings/${route.params.bookingId}/tracking`).then(setTrack).catch(() => undefined);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [route.params.bookingId]);
  const point = track?.current || track?.lastKnown;
  return (
    <Screen>
      <Header title="Live tracking" onBack={() => navigation.goBack()} />
      <View style={styles.bodyPad}>
        <Text style={styles.title}>{track?.stale ? 'Location unavailable' : 'On the way'}</Text>
        <Text style={styles.copy}>{track?.message}</Text>
        <Text style={styles.copy}>Destination {track?.destination}</Text>
        {track?.etaMinutes ? <Text style={styles.copy}>About {track.etaMinutes} minutes</Text> : null}
        {point ? <Text style={styles.copy}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)} · {new Date(point.recordedAt).toLocaleTimeString()}</Text> : null}
        {track?.stale ? <Text style={styles.error}>An old location is not shown as the current position.</Text> : null}
        <GhostButton danger label="Emergency / SOS" onPress={() => navigation.navigate('Sos', { bookingId: route.params.bookingId })} />
      </View>
    </Screen>
  );
}

export function ConciergeScreen() {
  const [bookings, setBookings] = useState<Stay[]>([]);
  const [body, setBody] = useState('');
  const [messages, setMessages] = useState<{ id: string; body: string; sender: { name: string } }[]>([]);
  const [channel, setChannel] = useState<'CONCIERGE' | 'DRIVER'>('CONCIERGE');
  useEffect(() => {
    api<Stay[]>('/bookings').then(setBookings).catch(() => undefined);
  }, []);
  const booking = bookings[0];
  useEffect(() => {
    if (!booking) return;
    api<typeof messages>(`/bookings/${booking.id}/messages`).then(setMessages).catch(() => undefined);
  }, [booking?.id]);

  async function send() {
    if (!booking || !body.trim()) return;
    await api(`/bookings/${booking.id}/messages`, { method: 'POST', body: JSON.stringify({ body, channel }) });
    setBody('');
    const next = await api<typeof messages>(`/bookings/${booking.id}/messages`);
    setMessages(next);
  }

  return (
    <Screen>
      <Header title="Concierge" />
      <View style={styles.bodyPad}>
        <Text style={styles.copy}>{booking ? `Messages for ${booking.reference}` : 'Confirm a stay to message the concierge or your driver.'}</Text>
        <View style={styles.tips}>
          <Pressable onPress={() => setChannel('CONCIERGE')} style={styles.tip}><Text>Concierge</Text></Pressable>
          <Pressable onPress={() => setChannel('DRIVER')} style={styles.tip}><Text>Driver</Text></Pressable>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {messages.map((message) => (
            <Text key={message.id} style={styles.bubble}>{message.sender.name}: {message.body}</Text>
          ))}
        </ScrollView>
        <TextInput value={body} onChangeText={setBody} style={styles.input} placeholder={`Message ${channel === 'DRIVER' ? 'your driver' : 'the concierge'}`} placeholderTextColor={colors.muted} />
        <GoldButton label="Send" onPress={send} />
      </View>
    </Screen>
  );
}

export function AccountScreen() {
  const { user, signOut, setLanguage, language, refreshMe } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [marketing, setMarketing] = useState(!!user?.marketingConsent);
  const [note, setNote] = useState('');

  async function save() {
    await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ name, marketingConsent: marketing }) });
    await refreshMe();
    setNote('Saved');
  }

  async function remove() {
    try {
      await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone: user?.phone, purpose: 'delete' }) });
      await api('/auth/account', { method: 'DELETE', body: JSON.stringify({ code: '123456' }) });
      await signOut();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not delete the account');
    }
  }

  return (
    <Screen>
      <Header title="Account" />
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>{user?.name}</Text>
        <Text style={styles.copy}>{user?.phone || user?.email}</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />
        <Text style={styles.label}>Language</Text>
        <View style={styles.tips}>
          {(['EN', 'BN'] as Lang[]).map((item) => (
            <Pressable key={item} style={styles.tip} onPress={() => setLanguage(item)}><Text>{item === language ? `• ${item}` : item}</Text></Pressable>
          ))}
        </View>
        <Text style={styles.copy}>The tagline stays “The new word for Comfort”.</Text>
        <Pressable onPress={() => setMarketing((value) => !value)}><Text style={styles.copy}>{marketing ? 'Marketing messages on' : 'Marketing messages off'} · Essential service messages stay on</Text></Pressable>
        <Text style={styles.copy}>Safe contact: {user?.safeContactMethod}. Emergency contact {user?.emergencyName || 'not set'} {user?.emergencyPhone || ''}</Text>
        <GoldButton label="Save" onPress={save} />
        <View style={{ height: 12 }} />
        <GhostButton onLight label="Sign out" onPress={signOut} />
        <View style={{ height: 12 }} />
        <GhostButton danger label="Delete account" onPress={remove} />
        {note ? <Text style={styles.copy}>{note}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

export function SosScreen({ navigation, route }: { navigation: { goBack: () => void }; route: { params?: { bookingId?: string } } }) {
  const [silent, setSilent] = useState(false);
  const [alert, setAlert] = useState<{ id: string; statusLabel: string; helpOnTheWay: boolean; callFallback: string } | null>(null);
  const [error, setError] = useState('');

  async function send() {
    setError('');
    try {
      const created = await api<NonNullable<typeof alert>>('/emergencies', {
        method: 'POST',
        body: JSON.stringify({ bookingId: route.params?.bookingId, silent }),
      });
      setAlert(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The alert could not be delivered');
    }
  }

  async function kind(type: string) {
    if (!alert) return;
    const next = await api<NonNullable<typeof alert>>(`/emergencies/${alert.id}/type`, { method: 'POST', body: JSON.stringify({ type }) });
    setAlert(next);
  }

  return (
    <Screen>
      <Header title="Emergency / SOS" onBack={() => navigation.goBack()} />
      <View style={styles.bodyPad}>
        <Text style={styles.title}>{alert?.statusLabel || 'Send help now'}</Text>
        <Text style={styles.copy}>{alert?.helpOnTheWay ? 'Help is on the way.' : 'One press alerts the OVYK response team. You can add a type after it is sent.'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!alert ? (
          <>
            <Pressable onPress={() => setSilent((value) => !value)}><Text style={styles.copy}>{silent ? 'Silent alert on. No sound, and the driver is not told.' : 'Silent alert off'}</Text></Pressable>
            <GhostButton danger label="Send Emergency / SOS" onPress={send} />
          </>
        ) : (
          <>
            <View style={styles.tips}>
              {['ACCIDENT', 'MEDICAL', 'HIJACKING', 'THREAT', 'OTHER'].map((type) => (
                <Pressable key={type} style={styles.tip} onPress={() => kind(type)}><Text>{type}</Text></Pressable>
              ))}
            </View>
            <GoldButton label="Call OVYK" onPress={() => Linking.openURL(`tel:${alert.callFallback}`)} />
            <View style={{ height: 8 }} />
            <GhostButton label="Cancel this alert" onPress={async () => {
              const next = await api<NonNullable<typeof alert>>(`/emergencies/${alert.id}/cancel`, { method: 'POST' });
              setAlert(next);
            }} />
          </>
        )}
      </View>
    </Screen>
  );
}

export function NotificationsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [rows, setRows] = useState<{ id: string; title: string; body: string }[]>([]);
  useEffect(() => { api<typeof rows>('/notifications').then(setRows).catch(() => undefined); }, []);
  return (
    <Screen>
      <Header title="Notices" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        {rows.length === 0 ? <Text style={styles.copy}>No notices yet.</Text> : null}
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.section}>{row.title}</Text>
            <Text style={styles.copy}>{row.body}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.ivory },
  bodyPad: { flex: 1, backgroundColor: colors.ivory, padding: 16 },
  kicker: { fontFamily: sans, color: colors.champagne, letterSpacing: 0.4 },
  title: { fontFamily: serif, fontSize: 28, color: colors.ink },
  section: { fontFamily: serif, fontSize: 20, color: colors.ink, marginTop: 14 },
  copy: { fontFamily: sans, color: colors.secondary, marginTop: 4, lineHeight: 20 },
  hero: { width: '100%', height: 160, borderRadius: 16, marginTop: 12 },
  driver: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 12 },
  ref: { fontFamily: serif, fontSize: 18 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 12, fontFamily: sans, color: colors.ink, marginVertical: 8 },
  error: { color: colors.danger, fontFamily: sans, marginTop: 8 },
  tips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  tip: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontFamily: sans, color: colors.secondary, marginTop: 12 },
  bubble: { backgroundColor: colors.card, borderRadius: 12, padding: 10, marginBottom: 8, fontFamily: sans, color: colors.ink },
});
