import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { GoldButton, Header, Screen } from '../components/ui';
import { SessionUser, useApp } from '../state';
import { colors, sans } from '../theme';

export function SignInScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { signIn } = useApp();
  const [mode, setMode] = useState<'phone' | 'driver'>('phone');
  const [phone, setPhone] = useState('+880');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('driver@ovyk.com');
  const [password, setPassword] = useState('driver123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  async function request() {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ debugCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setSent(true);
      if (result.debugCode) setCode(result.debugCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code');
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setError('');
    try {
      const session = await api<{ accessToken: string; user: SessionUser }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code, name: name || undefined }),
      });
      await signIn(session.user, session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted');
    } finally {
      setLoading(false);
    }
  }

  async function confirmMfa() {
    setLoading(true);
    setError('');
    try {
      const session = await api<{ accessToken: string; user: SessionUser }>('/auth/mfa', {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      await signIn(session.user, session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted');
    } finally {
      setLoading(false);
    }
  }

  async function driver() {
    setLoading(true);
    setError('');
    try {
      const session = await api<{ accessToken?: string; user?: SessionUser; mfaRequired?: boolean; mfaToken?: string; debugCode?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (session.mfaRequired && session.mfaToken) {
        setMfaToken(session.mfaToken);
        if (session.debugCode) setMfaCode(session.debugCode);
        return;
      }
      if (!session.accessToken || !session.user) throw new Error('Sign in failed');
      await signIn(session.user, session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header title="Sign in" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.switch}>
          <Pressable onPress={() => setMode('phone')} style={[styles.pill, mode === 'phone' && styles.pillOn]}>
            <Text style={[styles.pillText, mode === 'phone' && styles.pillTextOn]}>Phone</Text>
          </Pressable>
          <Pressable onPress={() => setMode('driver')} style={[styles.pill, mode === 'driver' && styles.pillOn]}>
            <Text style={[styles.pillText, mode === 'driver' && styles.pillTextOn]}>Driver</Text>
          </Pressable>
        </View>
        {mode === 'phone' ? (
          <>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholder="+8801..." placeholderTextColor={colors.muted} />
            <Text style={styles.help}>Bangladesh, UK and other international numbers. The local code is 123456.</Text>
            {sent ? (
              <>
                <Text style={styles.label}>Your name</Text>
                <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Ahad" placeholderTextColor={colors.muted} />
                <Text style={styles.label}>Code</Text>
                <TextInput value={code} onChangeText={setCode} style={styles.input} keyboardType="number-pad" />
                <GoldButton label="Continue" onPress={verify} loading={loading} />
              </>
            ) : (
              <GoldButton label="Send code" onPress={request} loading={loading} />
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            {mfaToken ? (
              <>
                <Text style={styles.label}>Verification code</Text>
                <TextInput value={mfaCode} onChangeText={setMfaCode} style={styles.input} keyboardType="number-pad" />
                <GoldButton label="Confirm code" onPress={confirmMfa} loading={loading} />
              </>
            ) : (
              <GoldButton label="Sign in" onPress={driver} loading={loading} />
            )}
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.ivory, padding: 20 },
  switch: { flexDirection: 'row', backgroundColor: '#E7E0D4', borderRadius: 24, padding: 4, marginBottom: 18 },
  pill: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.ink },
  pillText: { fontFamily: sans, color: colors.ink },
  pillTextOn: { color: colors.white },
  label: { fontFamily: sans, color: colors.secondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    fontFamily: sans,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 14,
  },
  help: { fontFamily: sans, color: colors.muted, marginBottom: 16, lineHeight: 18 },
  error: { color: colors.danger, marginTop: 12, fontFamily: sans },
});
