import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { FieldRow, GoldButton, Header, Screen, useT } from '../components/ui';
import { longDate, todayIso } from '../format';
import { Place, useApp } from '../state';
import { colors, fonts, sans, serif } from '../theme';

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(first).fill(null)];
  for (let day = 1; day <= days; day += 1) cells.push(day);
  return cells;
}

export function PlanScreen({ navigation }: { navigation: { goBack: () => void; navigate: (name: string) => void } }) {
  const t = useT();
  const { draft, setDraft } = useApp();
  const [places, setPlaces] = useState<Place[]>([]);
  const [extras, setExtras] = useState(false);
  const [sheet, setSheet] = useState<'place' | 'start' | 'end' | 'time' | 'people' | 'bags' | null>(null);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = draft.startDate.split('-').map(Number);
    return { year, month: month - 1 };
  });

  useEffect(() => {
    api<Place[]>(`/cities/${draft.citySlug}/places`).then(setPlaces).catch(() => setPlaces([]));
  }, [draft.citySlug]);

  const times = useMemo(() => {
    const rows: string[] = [];
    for (let hour = 6; hour <= 22; hour += 1) {
      rows.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 22) rows.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return rows;
  }, []);

  const today = todayIso();
  const minDate = sheet === 'end' ? draft.startDate : today;
  const cellIso = (day: number) => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const atMinMonth = cursor.year * 12 + cursor.month <= Number(minDate.slice(0, 4)) * 12 + Number(minDate.slice(5, 7)) - 1;

  function chooseDate(day: number) {
    const iso = cellIso(day);
    if (iso < minDate) return;
    if (sheet === 'start') {
      const end = draft.endDate < iso ? iso : draft.endDate;
      setDraft({ startDate: iso, endDate: draft.type === 'DAY' ? iso : end });
    } else {
      setDraft({ endDate: iso < draft.startDate ? draft.startDate : iso });
    }
    setSheet(null);
  }

  return (
    <Screen>
      <Header title={draft.type === 'DAY' ? t('planDay') : t('plan')} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 }}>
        <FieldRow tall icon="plane" label={t('pickup')} value={draft.pickupLabel || 'Choose a pickup location'} onPress={() => setSheet('place')} />
        <FieldRow tall icon="calendar" label={t('startDate')} value={longDate(draft.startDate)} onPress={() => setSheet('start')} />
        {draft.type === 'STAY' ? (
          <FieldRow tall icon="calendar" label={t('endDate')} value={longDate(draft.endDate)} onPress={() => setSheet('end')} />
        ) : null}
        <FieldRow tall icon="clock" label={t('pickupTime')} value={draft.pickupTime} onPress={() => setSheet('time')} />
        <FieldRow tall icon="person" label={t('passengers')} value={String(draft.passengers)} onPress={() => setSheet('people')} />
        <FieldRow tall icon="bag" label={t('luggage')} value={String(draft.luggage)} onPress={() => setSheet('bags')} />
        <View style={{ height: 22 }} />
        <GoldButton label={t('continue')} onPress={() => navigation.navigate('Vehicles')} height={54} />
        <Pressable onPress={() => setExtras((value) => !value)} hitSlop={8}>
          <Text style={styles.moreLink}>{extras ? 'Hide extra requests' : 'Flight number, child seat or notes'}</Text>
        </Pressable>
        {extras ? (
          <>
            <Text style={styles.label}>Flight number, optional</Text>
            <TextInput value={draft.flightNumber} onChangeText={(flightNumber) => setDraft({ flightNumber })} style={styles.input} placeholder="BG 305" placeholderTextColor={colors.muted} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Child seat, subject to availability</Text>
              <Switch value={draft.childSeat} onValueChange={(childSeat) => setDraft({ childSeat })} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Accessibility request</Text>
              <Switch value={draft.accessibility} onValueChange={(accessibility) => setDraft({ accessibility })} />
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput value={draft.notes} onChangeText={(notes) => setDraft({ notes })} style={[styles.input, { height: 80 }]} multiline placeholder="Anything the chauffeur should know" placeholderTextColor={colors.muted} />
          </>
        ) : null}
      </ScrollView>
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.modal} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            {sheet === 'place' ? (
              <>
                <Text style={styles.sheetTitle}>Pickup location</Text>
                {places.map((place) => (
                  <Pressable
                    key={place.id}
                    style={styles.option}
                    onPress={() => {
                      setDraft({ pickupLabel: place.name, pickupKind: place.kind, pickupLat: place.lat, pickupLng: place.lng });
                      setSheet(null);
                    }}>
                    <Text style={styles.optionTitle}>{place.name}</Text>
                    <Text style={styles.optionMeta}>{place.line}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    setDraft({ pickupLabel: 'Pinned location', pickupKind: 'PIN', pickupLat: draft.cityLat, pickupLng: draft.cityLng });
                    setSheet(null);
                  }}>
                  <Text style={styles.optionTitle}>Map pin in {draft.cityName}</Text>
                  <Text style={styles.optionMeta}>A saved point near the city centre</Text>
                </Pressable>
              </>
            ) : null}
            {sheet === 'start' || sheet === 'end' ? (
              <>
                <View style={styles.monthRow}>
                  <Pressable disabled={atMinMonth} onPress={() => setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }))}>
                    <Text style={[styles.monthBtn, atMinMonth && styles.cellOff]}>‹</Text>
                  </Pressable>
                  <Text style={styles.sheetTitle}>{['January','February','March','April','May','June','July','August','September','October','November','December'][cursor.month]} {cursor.year}</Text>
                  <Pressable onPress={() => setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }))}>
                    <Text style={styles.monthBtn}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.grid}>
                  {monthGrid(cursor.year, cursor.month).map((day, index) => (
                    <Pressable key={index} style={styles.cell} disabled={!day || cellIso(day) < minDate} onPress={() => day && chooseDate(day)}>
                      <Text style={[styles.cellText, !!day && cellIso(day) < minDate && styles.cellOff]}>{day || ''}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {sheet === 'time' ? (
              <ScrollView style={{ maxHeight: 360 }}>
                {times.map((time) => (
                  <Pressable key={time} style={styles.option} onPress={() => { setDraft({ pickupTime: time }); setSheet(null); }}>
                    <Text style={styles.optionTitle}>{time}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {sheet === 'people' || sheet === 'bags' ? (
              <Stepper
                label={sheet === 'people' ? 'Passengers' : 'Luggage pieces'}
                value={sheet === 'people' ? draft.passengers : draft.luggage}
                min={sheet === 'people' ? 1 : 0}
                max={sheet === 'people' ? 14 : 16}
                onChange={(value) => setDraft(sheet === 'people' ? { passengers: value } : { luggage: value })}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <Text style={styles.sheetTitle}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 12 }}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
        <Text style={{ fontFamily: serif, fontSize: 36 }}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.ivory },
  moreLink: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline', marginTop: 16, marginBottom: 12 },
  label: { fontFamily: sans, color: colors.secondary, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, fontFamily: sans, color: colors.ink, marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { fontFamily: sans, color: colors.ink, flex: 1, paddingRight: 12 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '75%' },
  sheetTitle: { fontFamily: serif, fontSize: 22, color: colors.ink, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  optionTitle: { fontFamily: sans, fontSize: 16, color: colors.ink },
  optionMeta: { fontFamily: sans, color: colors.muted, marginTop: 2 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthBtn: { fontSize: 28, paddingHorizontal: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: sans, color: colors.ink },
  cellOff: { color: colors.muted, opacity: 0.4 },
  step: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ivory, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 28 },
});
