import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { FieldRow, GhostButton, GoldButton, Header, Icon, Screen } from '../components/ui';
import { useT } from '../components/ui';
import { greetingWord, rangeLabel } from '../format';
import { homePhoto } from '../images';
import { useApp } from '../state';
import { colors, sans, serif } from '../theme';

type City = { slug: string; name: string };
type Booking = { id: string; reference: string; status: string; datesLabel: string; vehicle?: { name: string } | null };

export function HomeScreen({ navigation }: { navigation: { navigate: (name: string, params?: object) => void } }) {
  const t = useT();
  const { user, language, draft, setDraft } = useApp();
  const [cities, setCities] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [stay, setStay] = useState<Booking | null>(null);

  useEffect(() => {
    api<City[]>('/cities').then(setCities).catch(() => setCities([{ slug: 'sylhet', name: 'Sylhet' }]));
    api<Booking[]>('/bookings')
      .then((rows) => setStay(rows.find((row) => row.status === 'CONFIRMED' || row.status === 'ACTIVE') || null))
      .catch(() => setStay(null));
  }, []);

  const first = user?.name?.split(' ')[0] || 'Ahad';
  const dateValue = draft.type === 'DAY' ? rangeLabel(draft.startDate, draft.startDate) : rangeLabel(draft.startDate, draft.endDate);

  return (
    <Screen>
      <Header onBell={() => navigation.navigate('Notifications')} />
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.hello}>
          {greetingWord(language)}, {first}
        </Text>
        <Text style={styles.where}>{t('where')}</Text>
        <Pressable style={styles.city} onPress={() => setOpen(true)}>
          <Icon name="pin" color={colors.ink} size={18} />
          <Text style={styles.cityText}>{draft.cityName}</Text>
          <Text style={styles.caret}>▾</Text>
        </Pressable>
        {stay ? (
          <Pressable style={styles.upcoming} onPress={() => navigation.navigate('Stay')}>
            <Text style={styles.upcomingLabel}>Upcoming stay</Text>
            <Text style={styles.upcomingTitle}>{stay.vehicle?.name || stay.reference}</Text>
            <Text style={styles.upcomingMeta}>{stay.datesLabel}</Text>
          </Pressable>
        ) : null}
        <Image source={homePhoto} style={styles.hero} />
        <Text style={styles.title}>{t('yourStayTitle')}</Text>
        <Text style={styles.copy}>
          {draft.cityName === 'Sylhet'
            ? t('yourStayBody')
            : `A dedicated car and driver for your entire stay in ${draft.cityName}.`}
        </Text>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleItem, draft.type === 'DAY' && styles.toggleOn]}
            onPress={() => setDraft({ type: 'DAY', endDate: draft.startDate })}>
            <Text style={[styles.toggleText, draft.type === 'DAY' && styles.toggleTextOn]}>{t('forDay')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleItem, draft.type === 'STAY' && styles.toggleOn]}
            onPress={() => setDraft({ type: 'STAY', endDate: draft.endDate === draft.startDate ? '2025-11-04' : draft.endDate })}>
            <Text style={[styles.toggleText, draft.type === 'STAY' && styles.toggleTextOn]}>{t('forStay')}</Text>
          </Pressable>
        </View>
        <FieldRow icon="plane" label={t('pickup')} value={draft.pickupLabel} onPress={() => navigation.navigate('Plan')} />
        <FieldRow icon="calendar" label={draft.type === 'DAY' ? t('yourDate') : t('stayDates')} value={dateValue} onPress={() => navigation.navigate('Plan')} />
        <GoldButton label={t('explore')} onPress={() => navigation.navigate('Plan')} />
        <View style={{ height: 12 }} />
        <GhostButton danger label={t('sos')} onPress={() => navigation.navigate('Sos', stay ? { bookingId: stay.id } : undefined)} />
      </ScrollView>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modal} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {cities.map((city) => (
              <Pressable
                key={city.slug}
                style={styles.cityRow}
                onPress={() => {
                  setDraft({ citySlug: city.slug, cityName: city.name });
                  setOpen(false);
                }}>
                <Text style={styles.cityText}>{city.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.ivory },
  hello: { fontFamily: serif, fontSize: 28, color: colors.ink },
  where: { fontFamily: sans, color: colors.secondary, marginTop: 4, marginBottom: 12 },
  city: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  cityText: { fontFamily: sans, fontSize: 16, color: colors.ink, fontWeight: '600' },
  caret: { color: colors.muted },
  hero: { width: '100%', height: 210, borderRadius: 18, marginBottom: 16 },
  title: { fontFamily: serif, fontSize: 26, color: colors.ink },
  copy: { fontFamily: sans, color: colors.secondary, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  toggle: { flexDirection: 'row', backgroundColor: '#E9E2D6', borderRadius: 24, padding: 4, marginBottom: 14 },
  toggleItem: { flex: 1, height: 42, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.ink },
  toggleText: { fontFamily: sans, color: colors.ink },
  toggleTextOn: { color: colors.white, fontWeight: '600' },
  upcoming: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 14 },
  upcomingLabel: { fontFamily: sans, color: colors.muted, fontSize: 12 },
  upcomingTitle: { fontFamily: serif, fontSize: 20, color: colors.ink, marginTop: 2 },
  upcomingMeta: { fontFamily: sans, color: colors.secondary, marginTop: 2 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cityRow: { paddingVertical: 14 },
});
