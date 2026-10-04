import { Platform, TextStyle } from 'react-native';

export const colors = {
  black: '#0C0C0C',
  ivory: '#F3EEE4',
  card: '#FFFDF8',
  champagne: '#C6A36A',
  champagneDark: '#B08D55',
  ink: '#161616',
  muted: '#8A8378',
  secondary: '#5E584F',
  line: '#E6DFD2',
  danger: '#C44747',
  white: '#FFFFFF',
  tab: '#F7F4EE',
  overlay: 'rgba(0,0,0,0.28)',
};

export const serif = Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }) as string;
export const sans = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  default: 'System',
}) as string;

export const logoType: TextStyle = {
  fontFamily: serif,
  fontSize: 34,
  letterSpacing: 6,
  color: colors.champagne,
  fontWeight: '500',
};

export const taglineType: TextStyle = {
  fontFamily: sans,
  fontSize: 11,
  letterSpacing: 0.3,
  color: colors.champagne,
};
