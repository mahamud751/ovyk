import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { api } from '../api';
import { FieldRow, GhostButton, GoldButton, Header, Icon, Screen } from '../components/ui';
import { useT } from '../components/ui';
import { addDays, greetingWord, rangeLabel } from '../format';
import { homePhoto } from '../images';
import { City, STAY_NIGHTS, useApp } from '../state';
import { colors, fonts } from '../theme';

type Booking = { id: string; reference: string; status: string; datesLabel: string; vehicle?: { name: string } | null };

export function HomeScreen({ navigation }: { navigation: { navigate: (name: string, params?: object) => void } }) {
  const t = useT();
  const { user, language, draft, setDraft } = useApp();
  const [cities, setCities] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [stay, setStay] = useState<Booking | null>(null);

  useEffect(() => {
    api<City[]>('/cities').then(setCities).catch(() => setCities([]));
    api<Booking[]>('/bookings')
      .then((rows) => setStay(rows.find((row) => row.status === 'CONFIRMED' || row.status === 'ACTIVE') || null))
      .catch(() => setStay(null));
  }, []);

  const first = user?.name?.trim().split(' ')[0];
  const dateValue = draft.type === 'DAY' ? rangeLabel(draft.startDate, draft.startDate) : rangeLabel(draft.startDate, draft.endDate);

  return (
    <Screen>
      <Header onBell={() => navigation.navigate('Notifications')} />
      <ScrollView style={styles.body} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={styles.hello}>
          {greetingWord(language)}{first ? `, ${first}` : ''}
        </Text>
        <Text style={styles.where}>{t('where')}</Text>
        <Pressable style={styles.city} onPress={() => setOpen(true)}>
          <Icon name="pin" color={colors.ink} size={20} />
          <Text style={styles.cityText}>{draft.cityName || 'Select city'}</Text>
          <Icon name="chevronDown" color={colors.ink} size={18} />
        </Pressable>
        <View style={styles.heroWrap}>
          <Image source={homePhoto} style={styles.hero} />
          <Svg style={styles.heroFade} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.ivory} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.ivory} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#fade)" />
          </Svg>
        </View>
        <Text style={styles.title}>{t('yourStayTitle')}</Text>
        <Text style={styles.copy}>
          {t('yourStayBody').replace('{city}', draft.cityName || 'your city')}
        </Text>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleItem, draft.type === 'DAY' && styles.toggleOn]}
            onPress={() => setDraft({ type: 'DAY', endDate: draft.startDate })}>
            <Text style={[styles.toggleText, draft.type === 'DAY' && styles.toggleTextOn]}>{t('forDay')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleItem, draft.type === 'STAY' && styles.toggleOn]}
            onPress={() => setDraft({ type: 'STAY', endDate: draft.endDate === draft.startDate ? addDays(draft.startDate, STAY_NIGHTS) : draft.endDate })}>
            <Text style={[styles.toggleText, draft.type === 'STAY' && styles.toggleTextOn]}>{t('forStay')}</Text>
          </Pressable>
        </View>
        <FieldRow icon="plane" label={t('pickup')} value={draft.pickupLabel || 'Choose a pickup location'} onPress={() => navigation.navigate('Plan')} />
        <FieldRow icon="calendar" label={draft.type === 'DAY' ? t('yourDate') : t('stayDates')} value={dateValue} onPress={() => navigation.navigate('Plan')} />
        <View style={{ height: 6 }} />
        <GoldButton label={t('explore')} onPress={() => navigation.navigate('Plan')} height={46} />
        <View style={{ height: 10 }} />
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
                  setDraft({
                    citySlug: city.slug,
                    cityName: city.name,
                    cityLat: city.lat,
                    cityLng: city.lng,
                    pickupLabel: '',
                    pickupKind: '',
                    pickupLat: undefined,
                    pickupLng: undefined,
                  });
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
  hello: { fontFamily: fonts.serifSemi, fontSize: 26, lineHeight: 32, color: colors.ink },
  where: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary, marginTop: 2, marginBottom: 12 },
  city: {
    alignSelf: 'flex-start',
    width: 184,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    zIndex: 2,
    elevation: 2,
  },
  cityText: { flex: 1, fontFamily: fonts.sansSemi, fontSize: 16, color: colors.ink },
  heroWrap: { marginHorizontal: -20, marginTop: -4, marginBottom: 8 },
  hero: { width: '100%', height: 200 },
  heroFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 34 },
  title: { fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 30, color: colors.ink },
  copy: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary, marginTop: 2, marginBottom: 12, lineHeight: 21 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F1ECE3',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  toggleItem: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#1C1A18' },
  toggleText: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  toggleTextOn: { color: colors.white },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cityRow: { paddingVertical: 14 },
});
