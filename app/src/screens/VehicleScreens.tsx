import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { BlackButton, FieldRow, GoldButton, Header, Icon, Screen, useT } from '../components/ui';
import { bdt, daysBetween } from '../format';
import { photoSource } from '../images';
import { useApp } from '../state';
import { colors, sans, serif } from '../theme';

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
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
          <Text style={styles.hint}>
            {draft.cityName === 'Sylhet' ? t('chooseHint') : `Select the perfect vehicle for your stay in ${draft.cityName}.`}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {quote?.vehicles.map((vehicle) => {
            const on = vehicle.id === selected;
            return (
              <Pressable key={vehicle.id} style={[styles.card, on && styles.cardOn]} onPress={() => setSelected(vehicle.id)}>
                <Image source={photoSource(vehicle.photos[0])} style={styles.cardImage} />
                <View style={styles.mark}>{on ? <Icon name="check" /> : <View style={styles.ring} />}</View>
                <View style={styles.cardBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{vehicle.name}</Text>
                    <Text style={styles.cardSub}>{vehicle.subtitle}</Text>
                    <View style={styles.capRow}>
                      <Icon name="people" size={16} color={colors.secondary} />
                      <Text style={styles.cap}>{vehicle.seats}</Text>
                      <Icon name="bag" size={16} color={colors.secondary} />
                      <Text style={styles.cap}>{vehicle.luggage}</Text>
                    </View>
                    {!vehicle.fits ? <Text style={styles.warn}>Fewer seats or bags than this request</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
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

  const category = vehicle?.category === 'FAMILY' ? 'Family' : vehicle?.category === 'EXECUTIVE' ? 'Executive' : 'Premium';

  return (
    <Screen>
      <Header title={t('detail')} onBack={() => navigation.goBack()} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ paddingBottom: 24 }}>
        {vehicle ? (
          <>
            <Image source={photoSource(vehicle.photos[0])} style={styles.hero} />
            <View style={{ padding: 16 }}>
              <Text style={styles.detailTitle}>{category} / {vehicle.make} {vehicle.model}</Text>
              <Text style={styles.copy}>{language === 'BN' ? vehicle.descriptionBn : vehicle.description}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                {vehicle.photos.slice(1).map((photo) => (
                  <Image key={photo} source={photoSource(photo)} style={styles.thumb} />
                ))}
              </ScrollView>
              <View style={styles.specs}>
                <Spec icon="people" label={`${vehicle.seats} seats`} />
                <Spec icon="bag" label={`${vehicle.luggage} luggage`} />
                <Spec icon="clock" label={vehicle.airConditioning ? 'Air conditioning' : 'Fan'} />
              </View>
              {vehicle.verified ? <Text style={styles.verified}>Verification complete for this category</Text> : null}
              <Pressable style={styles.line}>
                <View>
                  <Text style={styles.lineTitle}>{bdt(vehicle.totalBdt)} / {vehicle.days} days</Text>
                  <Text style={styles.lineSub}>{t('includesDriver')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
              <Pressable style={styles.line} onPress={() => setTerms((value) => !value)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>{t('packageTerms')}</Text>
                  <Text style={styles.lineSub}>{t('seeTerms')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
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
              <GoldButton label={t('continue')} onPress={continueToReview} loading={loading} />
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
      <Icon name={icon} size={18} color={colors.secondary} />
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
  vehicle: { name: string; subtitle?: string; seats: number; luggage: number; photos: string[] } | null;
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
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.hint}>{t('reviewHint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {booking ? (
          <>
            <FieldRow icon="plane" label={t('pickup')} value={booking.pickupLabel} />
            <FieldRow icon="calendar" label="Stay" value={`${booking.datesLabel}\n${booking.pickupTime}`} />
            <View style={styles.pair}>
              <Mini icon="people" label={t('passengers')} value={String(booking.passengers)} />
              <Mini icon="bag" label={t('luggage')} value={String(booking.luggage)} />
            </View>
            {booking.vehicle ? (
              <View style={styles.vehicleMini}>
                <Image source={photoSource(booking.vehicle.photos[0])} style={styles.miniPhoto} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{booking.vehicle.name}</Text>
                  <Text style={styles.cardSub}>{booking.vehicle.seats} seats • {booking.vehicle.luggage} luggage</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </View>
            ) : null}
            <Money label={`${t('total')}${snap?.days ? ` (${snap.days} days)` : ''}`} value={bdt(booking.totalBdt)} strong />
            <Money label={t('payNow')} value={bdt(booking.depositBdt)} />
            <Money label={t('balance')} value={bdt(booking.balanceBdt)} />
            <Pressable style={styles.agree} onPress={() => setAgree((value) => !value)}>
              <View style={[styles.box, agree && styles.boxOn]}>{agree ? <Text style={{ color: colors.white }}>✓</Text> : null}</View>
              <Text style={styles.agreeText}>{t('agree')}</Text>
            </Pressable>
            <GoldButton
              label={t('payCta')}
              disabled={!agree}
              onPress={() => navigation.navigate('Payment', { bookingId: booking.id })}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Mini({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Icon name={icon} size={18} color={colors.secondary} />
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.optionTitle}>{value}</Text>
    </View>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.money}>
      <Text style={[styles.moneyLabel, strong && { fontWeight: '700', color: colors.ink }]}>{label}</Text>
      <Text style={[styles.moneyValue, strong && { fontWeight: '700' }]}>{value}</Text>
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

export function ConfirmationScreen({
  navigation,
  route,
}: {
  navigation: { navigate: (name: string) => void };
  route: { params: { bookingId: string } };
}) {
  const [booking, setBooking] = useState<BookingView & { reference: string; status: string } | null>(null);
  useEffect(() => {
    api<BookingView & { reference: string; status: string }>(`/bookings/${route.params.bookingId}`).then(setBooking).catch(() => undefined);
  }, [route.params.bookingId]);
  return (
    <Screen>
      <Header title="Confirmed" />
      <View style={styles.payBody}>
        <Text style={styles.detailTitle}>{booking?.reference || 'OVYK'}</Text>
        <Text style={styles.copy}>Your deposit is received. {booking?.datesLabel}. A dedicated driver will be confirmed before pickup.</Text>
        <GoldButton label="View my stay" onPress={() => navigation.navigate('Stay')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: sans, color: colors.secondary, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 18, marginBottom: 14, overflow: 'hidden' },
  cardOn: { borderWidth: 1.5, borderColor: colors.ink },
  cardImage: { width: '100%', height: 150 },
  mark: { position: 'absolute', top: 12, right: 12 },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.white, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardBody: { flexDirection: 'row', padding: 14, gap: 8 },
  cardTitle: { fontFamily: serif, fontSize: 20, color: colors.ink },
  cardSub: { fontFamily: sans, color: colors.secondary, marginTop: 2 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cap: { fontFamily: sans, color: colors.ink, marginRight: 8 },
  price: { fontFamily: sans, fontWeight: '700', color: colors.ink },
  forDays: { fontFamily: sans, color: colors.muted, fontSize: 12 },
  warn: { color: colors.danger, fontFamily: sans, fontSize: 12, marginTop: 6 },
  bn: { fontFamily: sans, color: colors.secondary, paddingHorizontal: 14, paddingBottom: 12 },
  footer: { padding: 16, backgroundColor: colors.ivory },
  hero: { width: '100%', height: 230 },
  detailTitle: { fontFamily: serif, fontSize: 28, color: colors.ink },
  copy: { fontFamily: sans, color: colors.secondary, marginTop: 6, lineHeight: 20 },
  thumb: { width: 120, height: 84, borderRadius: 12, marginRight: 8 },
  specs: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specText: { fontFamily: sans, color: colors.ink },
  verified: { fontFamily: sans, color: colors.secondary, marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  lineTitle: { fontFamily: sans, fontSize: 16, color: colors.ink, fontWeight: '600' },
  lineSub: { fontFamily: sans, color: colors.muted, marginTop: 2 },
  chev: { color: colors.muted, fontSize: 22 },
  terms: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  term: { fontFamily: sans, color: colors.secondary, marginBottom: 6, lineHeight: 18 },
  error: { color: colors.danger, fontFamily: sans, marginVertical: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  mini: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 12 },
  fieldLabel: { fontFamily: sans, color: colors.muted, fontSize: 12, marginTop: 6 },
  optionTitle: { fontFamily: sans, fontSize: 16, color: colors.ink, fontWeight: '600' },
  vehicleMini: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 10, marginVertical: 8 },
  miniPhoto: { width: 74, height: 56, borderRadius: 10 },
  money: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  moneyLabel: { fontFamily: sans, color: colors.secondary },
  moneyValue: { fontFamily: sans, color: colors.ink },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink },
  agreeText: { fontFamily: sans, color: colors.ink, flex: 1 },
  payBody: { flex: 1, backgroundColor: colors.ivory, padding: 16 },
  payOption: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
