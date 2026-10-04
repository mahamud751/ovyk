import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { GoldButton, Header, Screen } from '../components/ui';
import { bdt } from '../format';
import { useApp } from '../state';
import { colors, sans, serif } from '../theme';

type Assignment = {
  id: string;
  reference: string;
  status: string;
  city: string;
  startDate: string;
  endDate: string;
  pickupTime: string;
  pickupLabel: string;
  passengerName: string;
  passengerPhone?: string | null;
  vehicle?: string;
  journeys: { id: string; date: string; status: string; hoursUsed: number; kmUsed: number }[];
};

const QUEUE_KEY = 'ovyk_driver_queue';

export function DriverScreen() {
  const { signOut } = useApp();
  const [me, setMe] = useState<{ name: string; status: string; rating: number; trackingNote: string; documents: { kind: string; status: string }[] } | null>(null);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [earnings, setEarnings] = useState<{ tipTotalBdt: number; completedStays: number; note: string } | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('350');
  const [queued, setQueued] = useState(0);

  async function load() {
    const [profile, assignments, money] = await Promise.all([
      api<NonNullable<typeof me>>('/driver/me'),
      api<Assignment[]>('/driver/assignments'),
      api<NonNullable<typeof earnings>>('/driver/earnings'),
    ]);
    setMe(profile);
    setRows(assignments);
    setEarnings(money);
    await flush();
  }

  useEffect(() => { load().catch((err) => setNote(err.message)); }, []);

  async function flush() {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: { path: string; body: object; key: string }[] = raw ? JSON.parse(raw) : [];
    const left = [];
    for (const item of queue) {
      try {
        await api(item.path, { method: 'POST', body: JSON.stringify(item.body) });
      } catch {
        left.push(item);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(left));
    setQueued(left.length);
  }

  async function send(path: string, body: object) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      setNote('Updated');
      await load();
    } catch {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push({ path, body, key: `${path}-${Date.now()}` });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      setQueued(queue.length);
      setNote('Saved on this phone. It will sync when the connection returns.');
    }
  }

  const job = rows.find((row) => row.status === 'ACTIVE' || row.status === 'CONFIRMED') || rows[0];
  const journey = job?.journeys.find((item) => item.status !== 'COMPLETED') || job?.journeys[0];

  return (
    <Screen>
      <Header title="Driver" />
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>{me?.name || 'Driver'}</Text>
        <Text style={styles.copy}>Status {me?.status} · rating {me?.rating?.toFixed(1)}</Text>
        {me?.documents.map((doc) => <Text key={doc.kind} style={styles.copy}>{doc.kind} · {doc.status}</Text>)}
        <Text style={styles.copy}>{me?.trackingNote}</Text>
        {queued ? <Text style={styles.copy}>{queued} update(s) waiting to sync.</Text> : null}
        {job ? (
          <View style={styles.card}>
            <Text style={styles.section}>{job.reference}</Text>
            <Text style={styles.copy}>{job.passengerName} · {job.passengerPhone}</Text>
            <Text style={styles.copy}>{job.pickupLabel} at {job.pickupTime}</Text>
            <Text style={styles.copy}>{job.startDate} – {job.endDate} · {job.vehicle}</Text>
            <Text style={styles.copy}>Journey {journey?.date} · {journey?.status}</Text>
            <GoldButton label="Accept assignment" onPress={() => send(`/driver/assignments/${job.id}/accept`, {})} />
            <View style={{ height: 8 }} />
            {journey ? <GoldButton label="Next journey step" onPress={() => send(`/driver/journeys/${journey.id}/advance`, { hoursUsed: 8, kmUsed: 90 })} /> : null}
            <View style={{ height: 8 }} />
            <GoldButton label="Send location" onPress={() => send(`/driver/assignments/${job.id}/location`, { lat: 24.91, lng: 91.87, heading: 20, source: 'DRIVER_APP' })} />
            <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="number-pad" />
            <GoldButton label="Submit toll" onPress={() => send(`/driver/assignments/${job.id}/expenses`, { kind: 'TOLL', amountBdt: Number(amount), note: 'Bridge toll', evidenceNote: 'Receipt on file' })} />
            <View style={{ height: 8 }} />
            <GoldButton label="Vehicle check" onPress={() => send(`/driver/assignments/${job.id}/inspection`, { cleanliness: true, exteriorOk: true, interiorOk: true, notes: 'Ready for the guest' })} />
            <View style={{ height: 8 }} />
            <GoldButton label="Report a delay" onPress={() => send(`/driver/assignments/${job.id}/issues`, { kind: 'delay', note: 'Traffic on the airport road' })} />
          </View>
        ) : <Text style={styles.copy}>No assignment is on this account yet.</Text>}
        {earnings ? <Text style={styles.copy}>Tips {bdt(earnings.tipTotalBdt)} · {earnings.completedStays} completed stays. {earnings.note}</Text> : null}
        {note ? <Text style={styles.copy}>{note}</Text> : null}
        <View style={{ height: 16 }} />
        <GoldButton label="Sign out" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.ivory },
  title: { fontFamily: serif, fontSize: 28, color: colors.ink },
  section: { fontFamily: serif, fontSize: 22, color: colors.ink },
  copy: { fontFamily: sans, color: colors.secondary, marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 16 },
  input: { backgroundColor: colors.ivory, borderRadius: 12, padding: 12, marginVertical: 8, fontFamily: sans, color: colors.ink },
});
