import React from 'react';
import { Image, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldButton, GhostButton, Logo } from '../components/ui';
import { welcomePhoto } from '../images';
import { useT } from '../components/ui';
import { colors, fonts } from '../theme';

export function WelcomeScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Frame the van and driver (left of centre in the landscape photo) in the middle of the screen.
  const photoWidth = width * 1.6;
  const photoHeight = (photoWidth * 832) / 1248;
  const t = useT();
  return (
    <View style={styles.fill}>
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', width: photoWidth, height: photoHeight, left: width / 2 - photoWidth * 0.47, top: height * 0.56 - photoHeight / 2 }}>
        <Image source={welcomePhoto} style={{ width: '100%', height: '100%' }} />
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B0B0B" stopOpacity="1" />
              <Stop offset="0.3" stopColor="#0B0B0B" stopOpacity="0.35" />
              <Stop offset="0.5" stopColor="#0B0B0B" stopOpacity="0" />
              <Stop offset="0.72" stopColor="#0B0B0B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#0B0B0B" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#shade)" />
        </Svg>
      </View>
      <View style={[styles.top, { paddingTop: insets.top + 56 }]}>
        <Logo size={52} tagline={16} />
        <Text style={styles.headline}>{t('headline')}</Text>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 34 }]}>
        <GoldButton label={t('getStarted')} onPress={() => navigation.navigate('SignIn')} height={56} radius={14} />
        <View style={{ height: 14 }} />
        <GhostButton label={t('signIn')} onPress={() => navigation.navigate('SignIn')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.black },
  top: { alignItems: 'center' },
  bottom: { marginTop: 'auto', paddingHorizontal: 20 },
  headline: {
    color: colors.white,
    fontFamily: fonts.serif,
    fontSize: 25,
    lineHeight: 31,
    textAlign: 'center',
    marginTop: 36,
  },
});
