import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { BlackButton, FieldRow, GoldButton, Header, Icon, Screen, useT } from '../components/ui';
import { bdt, daysBetween } from '../format';
import { photoSource } from '../images';
import { useApp } from '../state';
import { colors, fonts, sans, serif } from '../theme';

export type VehicleQuote = {
  id: string;
  slug: string;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  descriptionBn: string;
  make: string;
  model: string;
  seats: number;
  luggage: number;
  airConditioning: boolean;
  photos: string[];
  features: string[];
  days: number;
  totalBdt: number;
  depositBdt: number;
  balanceBdt: number;
  depositPercent: number;
  includedHours: number;
  includedKm: number;
  extraHourRate: number;
  extraKmRate: number;
  fits: boolean;
  verified: boolean;
  guaranteeLabel: string;
  included: string[];
  excluded: string[];
  cancellation: string[];
  estimates: { usd: number; gbp: number; asOf: string; disclaimer: string };
};

type Quote = { vehicles: VehicleQuote[]; days: number };

function vehicleTitle(vehicle: { category?: string; make?: string; model?: string }) {
  const category = vehicle.category === 'FAMILY' ? 'Family' : vehicle.category === 'EXECUTIVE' ? 'Executive' : 'Premium';
  return `${category} / ${vehicle.make} ${vehicle.model}`;
}

function useQuote() {
  const { draft } = useApp();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Quote>('/quotes', {
      method: 'POST',
      body: JSON.stringify({
        citySlug: draft.citySlug,
        startDate: draft.startDate,
        endDate: draft.type === 'DAY' ? draft.startDate : draft.endDate,
        pickupTime: draft.pickupTime,
        type: draft.type,
        passengers: draft.passengers,
        luggage: draft.luggage,
        promoCode: draft.promoCode || undefined,
      }),
    })
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load vehicles'));
  }, [draft]);
  return { quote, error };
}

export function VehiclesScreen({ navigation }: { navigation: { goBack: () => void; navigate: (name: string, params?: object) => void } }) {
  const t = useT();
  const { draft, setDraft, language } = useApp();
  const { quote, error } = useQuote();
  const [selected, setSelected] = useState(draft.vehicleId);

  useEffect(() => {
    if (!quote || selected) return;
    const family = quote.vehicles.find((vehicle) => vehicle.slug === 'family-hiace') || quote.vehicles.find((vehicle) => vehicle.fits) || quote.vehicles[0];
    if (family) setSelected(family.id);
  }, [quote, selected]);

  const days = quote?.days || (draft.type === 'DAY' ? 1 : daysBetween(draft.startDate, draft.endDate));

  return (
    <Screen>
      <Header title={t('choose')} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, backgroundColor: colors.ivory }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          <Text style={styles.hint}>
            {t('chooseHint').replace('{city}', draft.cityName)}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {quote?.vehicles.map((vehicle) => {
            const on = vehicle.id === selected;
            return (
              <Pressable key={vehicle.id} style={[styles.card, on && styles.cardOn]} onPress={() => setSelected(vehicle.id)}>
                <Image source={photoSource(vehicle.photos[0])} style={styles.cardImage} />
                <View style={styles.mark}>
                  <Icon name={on ? 'check' : 'ring'} size={28} />
                </View>
                <View style={styles.cardBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{vehicle.name}</Text>
                    <Text style={styles.cardSub}>{vehicle.subtitle}</Text>
                    <View style={styles.capRow}>
                      <Icon name="person" size={20} color={colors.ink} />
                      <Text style={styles.cap}>{vehicle.seats}</Text>
                      <View style={styles.capDivider} />
                      <Icon name="bag" size={20} color={colors.ink} />
                      <Text style={styles.cap}>{vehicle.luggage}</Text>
                    </View>
                    {!vehicle.fits ? <Text style={styles.warn}>Fewer seats or bags than this request</Text> : null}
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={styles.price}>{bdt(vehicle.totalBdt)}</Text>
                    <Text style={styles.forDays}>for {days} days</Text>
                  </View>
                </View>
                {language === 'BN' ? <Text style={styles.bn}>{vehicle.descriptionBn}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <BlackButton
            label={t('viewVehicle')}
            onPress={() => {
              if (!selected) return;
              setDraft({ vehicleId: selected });
              navigation.navigate('Vehicle', { vehicleId: selected });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

export function VehicleDetailScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (name: string, params?: object) => void };
  route: { params: { vehicleId: string } };
}) {
  const t = useT();
  const { language, draft } = useApp();
  const { quote, error } = useQuote();
  const vehicle = quote?.vehicles.find((item) => item.id === route.params.vehicleId);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  async function continueToReview() {
    if (!vehicle) return;
    setLoading(true);
    setLocalError('');
    try {
      const booking = await api<{ id: string }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          citySlug: draft.citySlug,
          startDate: draft.startDate,
          endDate: draft.type === 'DAY' ? draft.startDate : draft.endDate,
          pickupTime: draft.pickupTime,
          type: draft.type,
          passengers: draft.passengers,
          luggage: draft.luggage,
          vehicleId: vehicle.id,
          pickupLabel: draft.pickupLabel,
          pickupKind: draft.pickupKind,
          pickupLat: draft.pickupLat,
          pickupLng: draft.pickupLng,
          flightNumber: draft.flightNumber || undefined,
          childSeat: draft.childSeat,
          accessibility: draft.accessibility,
          notes: draft.notes || undefined,
          promoCode: draft.promoCode || undefined,
        }),
      });
      const held = await api<{ id: string; preferredDriverAvailable?: boolean }>(`/bookings/${booking.id}/hold`, { method: 'POST' });
      navigation.navigate('Review', { bookingId: held.id || booking.id });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not reserve this vehicle');
    } finally {
      setLoading(false);
    }
  }


  return (
    <Screen>
      <Header title={t('detail')} onBack={() => navigation.goBack()} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ paddingBottom: 24 }}>
        {vehicle ? (
          <>
            <Image source={photoSource(vehicle.photos[0])} style={styles.hero} />
            <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
              <Text style={styles.detailTitle}>{vehicleTitle(vehicle)}</Text>
              <Text style={styles.copy}>{language === 'BN' ? vehicle.descriptionBn : vehicle.description}</Text>
              <View style={styles.thumbs}>
                {vehicle.photos.slice(1, 3).map((photo, index) => (
                  <Image key={photo} source={photoSource(photo)} style={[styles.thumb, { flex: index === 0 ? 2.4 : 1 }]} />
                ))}
              </View>
              <View style={styles.specs}>
                <Spec icon="person" label={`${vehicle.seats} seats`} />
                <View style={styles.specDivider} />
                <Spec icon="bag" label={`${vehicle.luggage} luggage`} />
                <View style={styles.specDivider} />
                <Spec icon="snow" label={vehicle.airConditioning ? 'Air conditioning' : 'Fan'} />
              </View>
              <Pressable style={styles.line}>
                <Icon name="seat" size={26} color={colors.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>
                    <Text style={{ fontFamily: fonts.sansBold }}>{bdt(vehicle.totalBdt)}</Text> / {vehicle.days} days
                  </Text>
                  <Text style={styles.lineSub}>{t('includesDriver')}</Text>
                </View>
                <Icon name="chevron" size={18} color={colors.ink} />
              </Pressable>
              <Pressable style={styles.line} onPress={() => setTerms((value) => !value)}>
                <Icon name="doc" size={26} color={colors.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineTitle, { fontSize: 15 }]}>{t('packageTerms')}</Text>
                  <Text style={styles.lineSub}>{t('seeTerms')}</Text>
                </View>
                <Icon name={terms ? 'chevronDown' : 'chevron'} size={18} color={colors.ink} />
              </Pressable>
              {terms ? (
                <View style={styles.terms}>
                  <Text style={styles.term}>{vehicle.includedHours} hours and {vehicle.includedKm} km included.</Text>
                  <Text style={styles.term}>Extra hour {bdt(vehicle.extraHourRate)}. Extra kilometre {bdt(vehicle.extraKmRate)}.</Text>
                  {vehicle.included.map((line) => <Text key={line} style={styles.term}>Included: {line}</Text>)}
                  {vehicle.excluded.map((line) => <Text key={line} style={styles.term}>Not included: {line}</Text>)}
                  {vehicle.cancellation.map((line) => <Text key={line} style={styles.term}>{line}</Text>)}
                  <Text style={styles.term}>{vehicle.guaranteeLabel}</Text>
                  <Text style={styles.term}>{vehicle.estimates.disclaimer} About USD {vehicle.estimates.usd} / GBP {vehicle.estimates.gbp} as of {vehicle.estimates.asOf.slice(0, 16).replace('T', ' ')}.</Text>
                </View>
              ) : null}
              {error || localError ? <Text style={styles.error}>{localError || error}</Text> : null}
              <View style={{ height: 10 }} />
              <GoldButton label={t('continue')} onPress={continueToReview} loading={loading} height={54} />
            </View>
          </>
        ) : (
          <Text style={[styles.copy, { padding: 16 }]}>{error || 'Loading the vehicle'}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Spec({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.spec}>
      <Icon name={icon} size={22} color={colors.ink} />
      <Text style={styles.specText}>{label}</Text>
    </View>
  );
}

type BookingView = {
  id: string;
  reference: string;
  datesLabel: string;
  pickupTime: string;
  pickupLabel: string;
  passengers: number;
  luggage: number;
  totalBdt: number;
  depositBdt: number;
  balanceBdt: number;
  depositPercent?: number;
  vehicle: { name: string; subtitle?: string; category?: string; make?: string; model?: string; seats: number; luggage: number; photos: string[] } | null;
  priceSnapshot?: { depositPercent?: number };
};

export function ReviewScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (name: string, params?: object) => void };
  route: { params: { bookingId: string } };
}) {
  const t = useT();
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<BookingView>(`/bookings/${route.params.bookingId}`).then(setBooking).catch((err) => setError(err.message));
  }, [route.params.bookingId]);

  const snap = booking?.priceSnapshot as { days?: number } | undefined;

  return (
    <Screen>
      <Header title={t('review')} onBack={() => navigation.goBack()} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 }}>
        <Text style={styles.hint}>{t('reviewHint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {booking ? (
          <>
            <View style={styles.group}>
              <ReviewRow icon="plane" label={t('pickup')} value={booking.pickupLabel} />
              <View style={styles.groupLine} />
              <ReviewRow icon="calendar" value={booking.datesLabel} note={snap?.days ? `${snap.days} days` : undefined} />
              <View style={styles.groupLine} />
              <ReviewRow icon="clock" label={t('pickupTime')} value={booking.pickupTime} />
              <View style={styles.groupLine} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <ReviewRow icon="people" label={t('passengers')} value={String(booking.passengers)} />
                </View>
                <View style={styles.groupSplit} />
                <View style={{ flex: 1 }}>
                  <ReviewRow icon="bag" label={t('luggage')} value={String(booking.luggage)} />
                </View>
              </View>
            </View>
            {booking.vehicle ? (
              <Pressable style={styles.vehicleMini} onPress={() => navigation.goBack()}>
                <Image source={photoSource(booking.vehicle.photos[0])} style={styles.miniPhoto} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniTitle}>{booking.vehicle.make ? vehicleTitle(booking.vehicle) : booking.vehicle.name}</Text>
                  <Text style={styles.cardSub}>{booking.vehicle.seats} seats • {booking.vehicle.luggage} luggage</Text>
                </View>
                <Icon name="chevron" size={18} color={colors.ink} />
              </Pressable>
            ) : null}
            <View style={styles.moneyTop} />
            <Money label={`${t('total')}${snap?.days ? ` (${snap.days} days)` : ''}`} value={bdt(booking.totalBdt)} strong />
            <Money label={t('payNow')} value={bdt(booking.depositBdt)} />
            <Money label={t('balance')} value={bdt(booking.balanceBdt)} last />
            <Pressable style={styles.agree} onPress={() => setAgree((value) => !value)}>
              <View style={[styles.box, agree && styles.boxOn]}>{agree ? <Icon name="tick" size={18} color={colors.white} /> : null}</View>
              <Text style={styles.agreeText}>
                I agree to the <Text style={{ color: colors.muted }}>terms and conditions</Text>
              </Text>
            </Pressable>
            <GoldButton
              label={t('payCta')}
              disabled={!agree}
              onPress={() => navigation.navigate('Payment', { bookingId: booking.id })}
              height={54}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Money({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <View style={[styles.money, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, strong && { fontFamily: fonts.sansBold, fontSize: 21 }]}>{value}</Text>
    </View>
  );
}

function ReviewRow({ icon, label, value, note }: { icon: string; label?: string; value: string; note?: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIcon}>
        <Icon name={icon} size={24} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        {label ? <Text style={styles.reviewLabel}>{label}</Text> : null}
        <Text style={styles.reviewValue}>{value}</Text>
        {note ? <Text style={styles.reviewLabel}>{note}</Text> : null}
      </View>
    </View>
  );
}

export function PaymentScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (name: string, params?: object) => void };
  route: { params: { bookingId: string } };
}) {
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [method, setMethod] = useState<'BKASH' | 'NAGAD' | 'CARD'>('BKASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<BookingView>(`/bookings/${route.params.bookingId}`).then(setBooking).catch((err) => setError(err.message));
  }, [route.params.bookingId]);

  async function pay() {
    if (!booking) return;
    setLoading(true);
    setError('');
    try {
      await api(`/bookings/${booking.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'DEPOSIT',
          method,
          idempotencyKey: `app-${booking.id}-deposit`,
          termsAccepted: true,
        }),
      });
      navigation.navigate('Confirmation', { bookingId: booking.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment was not completed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header title="Payment" onBack={() => navigation.goBack()} />
      <View style={styles.payBody}>
        <Text style={styles.detailTitle}>Pay {booking ? bdt(booking.depositBdt) : ''}</Text>
        <Text style={styles.copy}>25% confirms the stay. The balance is due before pickup. This local build uses a simulated provider and never asks for a card number.</Text>
        {(['BKASH', 'NAGAD', 'CARD'] as const).map((item) => (
          <Pressable key={item} style={[styles.payOption, method === item && styles.cardOn]} onPress={() => setMethod(item)}>
            <Text style={styles.optionTitle}>{item === 'BKASH' ? 'bKash' : item === 'NAGAD' ? 'Nagad' : 'Card token'}</Text>
            <View style={[styles.ring, method === item && { backgroundColor: colors.ink, borderColor: colors.ink }]} />
          </Pressable>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GoldButton label={booking ? `Pay ${bdt(booking.depositBdt)}` : 'Pay'} onPress={pay} loading={loading} />
      </View>
    </Screen>
  );
}

type ConfirmedBooking = BookingView & {
  status: string;
  paidBdt: number;
  dueBdt: number;
  driver: { name: string; photoUrl?: string | null; languages: string[]; rating: number; reviewCount: number; experienceYears?: number } | null;
  payments: { id: string; kind: string; status: string; amountBdt: number; displayLabel: string; createdAt: string }[];
  invoices: { id: string; number: string; amountBdt: number }[];
};

const statusCopy: Record<string, { title: string; body: string }> = {
  CONFIRMED: { title: 'Your stay is confirmed', body: 'Your deposit is received and the vehicle is reserved for you.' },
  PENDING_APPROVAL: { title: 'Request received', body: 'Your deposit is received. OVYK will approve this request shortly and let you know.' },
  ACTIVE: { title: 'Your stay is under way', body: 'Your driver and vehicle are with you.' },
  COMPLETED: { title: 'Stay completed', body: 'Thank you for travelling with OVYK.' },
  CANCELLED: { title: 'Booking cancelled', body: 'This booking was cancelled. Any refund appears in My stay.' },
};

export function ConfirmationScreen({
  navigation,
  route,
}: {
  navigation: { navigate: (name: string) => void; popToTop: () => void };
  route: { params: { bookingId: string } };
}) {
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<ConfirmedBooking>(`/bookings/${route.params.bookingId}`).then(setBooking).catch((err) => setError(err.message));
  }, [route.params.bookingId]);

  const copy = booking ? statusCopy[booking.status] || { title: booking.status.replaceAll('_', ' '), body: '' } : null;
  const deposit = booking?.payments.find((payment) => payment.kind === 'DEPOSIT' && payment.status === 'SUCCEEDED');
  const days = (booking?.priceSnapshot as { days?: number } | undefined)?.days;

  function leave(target?: string) {
    navigation.popToTop();
    if (target) navigation.navigate(target);
  }

  return (
    <Screen>
      <Header title="Confirmed" />
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {booking && copy ? (
          <>
            <View style={styles.done}>
              <View style={[styles.doneMark, booking.status === 'CANCELLED' && { backgroundColor: colors.danger }]}>
                <Text style={styles.doneTick}>{booking.status === 'CANCELLED' ? '✕' : '✓'}</Text>
              </View>
              <Text style={styles.doneTitle}>{copy.title}</Text>
              {copy.body ? <Text style={[styles.copy, { textAlign: 'center' }]}>{copy.body}</Text> : null}
              <Text style={styles.refLabel}>Booking reference</Text>
              <Text style={styles.ref}>{booking.reference}</Text>
            </View>

            {booking.vehicle ? (
              <View style={styles.vehicleMini}>
                <Image source={photoSource(booking.vehicle.photos[0])} style={styles.miniPhoto} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{booking.vehicle.name}</Text>
                  <Text style={styles.cardSub}>{booking.vehicle.subtitle || `${booking.vehicle.seats} seats • ${booking.vehicle.luggage} luggage`}</Text>
                </View>
              </View>
            ) : null}

            <FieldRow icon="calendar" label={days ? `Stay · ${days} days` : 'Stay'} value={booking.datesLabel} />
            <FieldRow icon="plane" label={`Pickup at ${booking.pickupTime}`} value={booking.pickupLabel} />

            <View style={styles.receipt}>
              <Text style={styles.receiptTitle}>Your driver</Text>
              {booking.driver ? (
                <View style={styles.driverRow}>
                  <Image source={photoSource(booking.driver.photoUrl)} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{booking.driver.name}</Text>
                    <Text style={styles.cardSub}>
                      {booking.driver.languages.join(', ')} · {booking.driver.rating.toFixed(1)} ({booking.driver.reviewCount})
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.copy}>A dedicated driver will be confirmed before pickup. We will notify you.</Text>
              )}
            </View>

            <View style={styles.receipt}>
              <Text style={styles.receiptTitle}>Payment receipt</Text>
              <Money label={`Total${days ? ` (${days} days)` : ''}`} value={bdt(booking.totalBdt)} strong />
              <Money label={deposit ? `Paid · ${deposit.displayLabel}` : 'Paid'} value={bdt(booking.paidBdt)} />
              <Money label="Balance due before pickup" value={bdt(booking.dueBdt)} />
              {booking.invoices[0] ? <Text style={styles.invoice}>Invoice {booking.invoices[0].number}</Text> : null}
            </View>

            <GoldButton label="View my stay" onPress={() => leave('Stay')} />
            <Pressable style={styles.homeLink} onPress={() => leave()}>
              <Text style={styles.homeLinkText}>Back to home</Text>
            </Pressable>
          </>
        ) : !error ? (
          <Text style={styles.copy}>Loading your booking</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.sans, fontSize: 14, color: colors.secondary, textAlign: 'center', marginBottom: 14 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 14, overflow: 'hidden' },
  cardOn: { borderWidth: 1.5, borderColor: colors.champagneDark },
  cardImage: { width: '100%', height: 188 },
  mark: { position: 'absolute', top: 12, right: 12 },
  priceCol: { alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 2 },
  capDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 12 },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.white, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardBody: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  cardTitle: { fontFamily: fonts.serifBold, fontSize: 21, lineHeight: 26, color: colors.ink },
  cardSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary, marginTop: 1 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cap: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  price: { fontFamily: fonts.sansBold, fontSize: 19, color: colors.ink },
  forDays: { fontFamily: fonts.sans, color: colors.secondary, fontSize: 15, marginTop: 1 },
  warn: { color: colors.danger, fontFamily: sans, fontSize: 12, marginTop: 6 },
  bn: { fontFamily: sans, color: colors.secondary, paddingHorizontal: 14, paddingBottom: 12 },
  footer: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.ivory },
  hero: { width: '100%', height: 236 },
  detailTitle: { fontFamily: fonts.serifBold, fontSize: 22, lineHeight: 28, color: colors.ink },
  copy: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary, marginTop: 2, lineHeight: 21 },
  thumbs: { flexDirection: 'row', gap: 10, marginTop: 14 },
  thumb: { height: 106, borderRadius: 8 },
  specs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 12 },
  specDivider: { width: 1, height: 26, backgroundColor: colors.border },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  specText: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 66, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 8, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  lineTitle: { fontFamily: fonts.sansSemi, fontSize: 17, color: colors.ink },
  lineSub: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary, marginTop: 1 },
  chev: { color: colors.muted, fontSize: 22 },
  terms: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  term: { fontFamily: sans, color: colors.secondary, marginBottom: 6, lineHeight: 18 },
  error: { color: colors.danger, fontFamily: sans, marginVertical: 8 },
  fieldLabel: { fontFamily: sans, color: colors.muted, fontSize: 12, marginTop: 6 },
  optionTitle: { fontFamily: sans, fontSize: 16, color: colors.ink, fontWeight: '600' },
  vehicleMini: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 8, paddingRight: 16, marginTop: 10 },
  miniTitle: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.ink },
  group: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8 },
  groupLine: { height: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  groupSplit: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 10 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 10, paddingVertical: 11 },
  reviewIcon: { width: 28, alignItems: 'center' },
  reviewLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  reviewValue: { fontFamily: fonts.sansSemi, fontSize: 16, color: colors.ink },
  moneyTop: { height: 1, backgroundColor: colors.border, marginTop: 10 },
  miniPhoto: { width: 116, height: 72, borderRadius: 6 },
  money: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  moneyLabel: { fontFamily: fonts.sans, fontSize: 17, color: colors.ink },
  moneyValue: { fontFamily: fonts.sans, fontSize: 17, color: colors.ink },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, marginBottom: 20, paddingHorizontal: 4 },
  box: { width: 26, height: 26, borderRadius: 5, borderWidth: 1.5, borderColor: colors.champagneDark, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: '#151413' },
  agreeText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, flex: 1 },
  payBody: { flex: 1, backgroundColor: colors.ivory, padding: 16 },
  done: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  doneMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.champagne, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  doneTick: { color: colors.white, fontSize: 30, fontWeight: '700' },
  doneTitle: { fontFamily: serif, fontSize: 26, color: colors.ink, textAlign: 'center' },
  refLabel: { fontFamily: sans, color: colors.muted, fontSize: 12, marginTop: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  ref: { fontFamily: serif, fontSize: 24, color: colors.ink, marginTop: 4, letterSpacing: 1 },
  receipt: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 10 },
  receiptTitle: { fontFamily: sans, color: colors.muted, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  invoice: { fontFamily: sans, color: colors.muted, fontSize: 12, marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  homeLink: { alignItems: 'center', paddingVertical: 16 },
  homeLinkText: { fontFamily: sans, color: colors.ink, fontSize: 16, textDecorationLine: 'underline' },
  payOption: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
