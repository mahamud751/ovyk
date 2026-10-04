import React, { useState } from 'react';
import { ImageBackground, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, setToken } from '../api';
import { GoldButton, GhostButton, Logo } from '../components/ui';
import { welcomePhoto } from '../images';
import { useT } from '../components/ui';
import { SessionUser, useApp } from '../state';
import { colors, sans, serif } from '../theme';

export function WelcomeScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { signIn } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function enter() {
    setLoading(true);
    setError('');
    try {
      await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone: '+8801711111111' }) });
      const session = await api<{ accessToken: string; user: SessionUser }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+8801711111111', code: '123456', name: 'Ahad' }),
      });
      setToken(session.accessToken);
      await signIn(session.user, session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach OVYK');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={welcomePhoto} style={styles.fill}>
      <StatusBar barStyle="light-content" />
      <View style={styles.scrim} />
      <View style={[styles.top, { paddingTop: insets.top + 36 }]}>
        <Logo />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.headline}>{t('headline')}</Text>
        <GoldButton label={t('getStarted')} onPress={enter} loading={loading} />
        <View style={{ height: 12 }} />
        <GhostButton label={t('signIn')} onPress={() => navigation.navigate('SignIn')} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.hint}>Local demo signs in as Ahad. Other numbers use Sign in.</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.black },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.38)' },
  top: { alignItems: 'center' },
  bottom: { marginTop: 'auto', paddingHorizontal: 22 },
  headline: {
    color: colors.white,
    fontFamily: serif,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 28,
  },
  error: { color: '#F3C1C1', textAlign: 'center', marginTop: 12, fontFamily: sans },
  hint: { color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: 14, fontFamily: sans, fontSize: 12 },
});
