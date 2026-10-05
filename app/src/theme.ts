import { TextStyle } from 'react-native';

export const colors = {
  black: '#0E0E0E',
  ivory: '#F6F2EB',
  card: '#FFFDF9',
  border: '#E7E0D4',
  champagne: '#C9A96E',
  champagneLight: '#DCC293',
  champagneDark: '#B08D55',
  gold: '#8E6E3A',
  ink: '#1A1714',
  muted: '#7C766D',
  secondary: '#4F4A43',
  line: '#E6DFD2',
  danger: '#C0392B',
  white: '#FFFFFF',
  tab: '#F8F5EF',
  tabIdle: '#3D3A36',
  overlay: 'rgba(0,0,0,0.28)',
};

// Bundled in src/assets/fonts (Android: android/app/src/main/assets/fonts).
// Each weight is its own family, so styles pick a family instead of fontWeight.
export const fonts = {
  logo: 'CormorantGaramond-Medium',
  serif: 'CrimsonPro-Regular',
  serifSemi: 'CrimsonPro-SemiBold',
  serifBold: 'CrimsonPro-Bold',
  sans: 'NunitoSans-Regular',
  sansSemi: 'NunitoSans-SemiBold',
  sansBold: 'NunitoSans-Bold',
};

export const serif = fonts.serifSemi;
export const sans = fonts.sans;

export const logoType: TextStyle = {
  fontFamily: fonts.logo,
  fontSize: 40,
  lineHeight: 44,
  letterSpacing: 10,
  color: colors.champagneLight,
};

export const taglineType: TextStyle = {
  fontFamily: fonts.sans,
  fontSize: 11,
  letterSpacing: 0.2,
  color: '#EDE6D8',
};
