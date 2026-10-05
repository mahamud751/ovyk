import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { translate } from '../i18n';
import { useApp } from '../state';
import { colors, fonts, logoType, taglineType } from '../theme';

export function Icon({ name, color = colors.ink, size = 22 }: { name: string; color?: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  const s = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (
        <Svg {...common}>
          <Path d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5V15h-5v5.5H5a1 1 0 0 1-1-1V11Z" {...s} />
        </Svg>
      );
    case 'homeFill':
      return (
        <Svg {...common}>
          <Path d="M3.5 11.2 12 3.5l8.5 7.7v8.8a1 1 0 0 1-1 1h-5v-5.5h-5V21h-5a1 1 0 0 1-1-1v-8.8Z" fill={color} />
        </Svg>
      );
    case 'stay':
      return (
        <Svg {...common}>
          <Rect x="4" y="5" width="16" height="15.5" rx="2" {...s} />
          <Path d="M8 3v4M16 3v4M4 9.5h16M10 16.5l4-4" {...s} />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l1.5 1.8H5l1.5-1.8Z" {...s} />
          <Path d="M10 20.5a2.2 2.2 0 0 0 4 0M12 3.5v2" {...s} />
        </Svg>
      );
    case 'person':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8" r="3.6" {...s} />
          <Path d="M4.5 20c.9-3.7 3.8-5.6 7.5-5.6s6.6 1.9 7.5 5.6H4.5Z" {...s} />
        </Svg>
      );
    case 'people':
      return (
        <Svg {...common}>
          <Circle cx="9" cy="8.5" r="3.2" {...s} />
          <Path d="M3 19.5c.6-3.3 2.9-5 6-5s5.4 1.7 6 5H3Z" {...s} />
          <Path d="M15 5.6a3.1 3.1 0 0 1 0 5.9M17 14.6c2.2.4 3.6 2 4 4.9h-3" {...s} />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...common}>
          <Path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11Z" {...s} />
          <Circle cx="12" cy="10" r="2.3" {...s} />
        </Svg>
      );
    case 'plane':
      return (
        <Svg {...common}>
          <G transform="rotate(90 12 12)">
            <Path
              d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"
              fill={color}
            />
          </G>
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...common}>
          <Rect x="4" y="5" width="16" height="15.5" rx="2" {...s} />
          <Path d="M8 3v4M16 3v4M4 9.5h16" {...s} />
          <Path d="M8 13h1.5M11.3 13h1.5M8 16.5h1.5M11.3 16.5h1.5" {...s} strokeWidth={1.8} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" {...s} />
          <Path d="M12 7.5V12l3 2.5" {...s} />
        </Svg>
      );
    case 'bag':
      return (
        <Svg {...common}>
          <Rect x="6" y="6.5" width="12" height="14" rx="1.8" {...s} />
          <Path d="M9.5 6.5V3.5h5v3M9.8 9.5v8M14.2 9.5v8M8.5 20.5v1M15.5 20.5v1" {...s} />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...common}>
          <Path d="M12 2.8 19.5 5.5v6c0 4.6-3.2 7.8-7.5 9.8-4.3-2-7.5-5.2-7.5-9.8v-6L12 2.8Z" fill={color} />
          <Path d="M12 8.2v6.6M8.7 11.5h6.6" stroke={colors.white} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="10.5" fill={colors.white} stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />
          <Path d="M7.5 12.3 10.6 15.4 16.6 9" stroke={colors.gold} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'tick':
      return (
        <Svg {...common}>
          <Path d="M5.5 12.5 10 17l8.5-9.5" {...s} strokeWidth={2.4} />
        </Svg>
      );
    case 'ring':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="10" fill={colors.white} stroke={colors.ink} strokeWidth={1.4} />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...common}>
          <Path d="m9.5 6 6 6-6 6" {...s} strokeWidth={2} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg {...common}>
          <Path d="m6 9.5 6 6 6-6" {...s} strokeWidth={2} />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...common}>
          <Path d="M15 4.5 7.5 12l7.5 7.5" {...s} strokeWidth={1.8} />
        </Svg>
      );
    case 'arrow':
      return (
        <Svg {...common}>
          <Path d="M4 12h15.5M13.5 6l6 6-6 6" {...s} strokeWidth={1.8} />
        </Svg>
      );
    case 'snow':
      return (
        <Svg {...common}>
          <Path
            d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2M4 10.5l3.2-.6-1-3.2M20 13.5l-3.2.6 1 3.2M4 13.5l3.2.6-1 3.2M20 10.5l-3.2-.6 1-3.2"
            {...s}
          />
        </Svg>
      );
    case 'seat':
      return (
        <Svg {...common}>
          <Path d="M7 3.5h4.5l2.3 9.5H19a1.5 1.5 0 0 1 1.5 1.5V16H9.5L7 3.5Z" {...s} />
          <Path d="M9.5 16 6 20.5M14.5 16v4.5M18.5 16l2 4.5M4 9.5l3 1" {...s} />
        </Svg>
      );
    case 'doc':
      return (
        <Svg {...common}>
          <Path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" {...s} />
          <Path d="M14 3.5V8.5h5M9 12h7M9 15h7M9 18h4.5" {...s} />
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8" {...s} />
        </Svg>
      );
  }
}

export function Logo({ size = 34, tagline = 10 }: { size?: number; tagline?: number }) {
  const spacing = size * 0.3;
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[logoType, { fontSize: size, lineHeight: size * 1.1, letterSpacing: spacing, paddingLeft: spacing }]}>OVYK</Text>
      <Text style={[taglineType, { fontSize: tagline, marginTop: size * 0.02 }]}>The new word for Comfort</Text>
    </View>
  );
}

export function Header({
  title,
  onBack,
  onBell,
}: {
  title?: string;
  onBack?: () => void;
  onBell?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Icon name="back" color={colors.white} size={24} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.headerMid}>
        {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : <Logo />}
      </View>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {onBell ? (
          <Pressable onPress={onBell} hitSlop={12}>
            <Icon name="bell" color={colors.champagneLight} size={24} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>;
}

function GoldFill() {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D9BE8A" />
          <Stop offset="0.55" stopColor="#C8A96F" />
          <Stop offset="1" stopColor="#B4935C" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#gold)" />
    </Svg>
  );
}

export function GoldButton({
  label,
  onPress,
  loading,
  disabled,
  height = 52,
  radius = 10,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  radius?: number;
  textStyle?: TextStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.gold, { height, borderRadius: radius }, (pressed || disabled) && { opacity: 0.8 }]}>
      <GoldFill />
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={styles.btnRow}>
          <Text style={[styles.goldText, textStyle]}>{label}</Text>
          <Icon name="arrow" color={colors.ink} size={20} />
        </View>
      )}
    </Pressable>
  );
}

export function BlackButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.blackBtn}>
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.btnRow}>
          <Text style={styles.blackText}>{label}</Text>
          <Icon name="arrow" color={colors.white} size={20} />
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
  onLight,
  style,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  onLight?: boolean;
  style?: ViewStyle;
}) {
  const border = danger ? colors.danger : onLight ? colors.ink : 'rgba(226,214,190,0.75)';
  const text = danger ? colors.danger : onLight ? colors.ink : colors.white;
  return (
    <Pressable onPress={onPress} style={[styles.ghost, { borderColor: border }, danger || onLight ? styles.ghostLight : null, style]}>
      {danger ? <Icon name="shield" color={colors.danger} size={18} /> : null}
      <Text style={[styles.ghostText, { color: text }, danger && { fontFamily: fonts.sansSemi }]}>{label}</Text>
    </Pressable>
  );
}

export function FieldRow({
  icon,
  label,
  value,
  onPress,
  tall,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  tall?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.field, tall && styles.fieldTall]}>
      <View style={styles.fieldIcon}>
        <Icon name={icon} color={colors.ink} size={tall ? 26 : 24} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldLabel, tall && { fontSize: 14 }]}>{label}</Text>
        <Text style={[styles.fieldValue, tall && { fontSize: 17 }]}>{value}</Text>
      </View>
      {onPress ? <Icon name="chevron" color={colors.ink} size={18} /> : null}
    </Pressable>
  );
}

export function useT() {
  const { language } = useApp();
  return (key: string) => translate(language, key);
}

type TabRoute = { name: string; key: string; state?: { key?: string; index?: number } };

export function OvykTabBar({
  state,
  navigation,
}: {
  state: { index: number; routes: TabRoute[] };
  navigation: { navigate: (name: string) => void; dispatch: (action: ReturnType<typeof StackActions.popToTop> & { target?: string }) => void };
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const icons: Record<string, string> = { Home: 'home', Stay: 'stay', Concierge: 'bell', Account: 'person' };
  const labels: Record<string, string> = { Home: t('home'), Stay: t('myStay'), Concierge: t('concierge'), Account: t('account') };
  return (
    <View style={[styles.tab, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const active = state.index === index;
        const color = active ? colors.gold : colors.tabIdle;
        const icon = icons[route.name] || 'home';
        return (
          <Pressable
            key={route.key}
            style={styles.tabItem}
            onPress={() => {
              // Tapping the tab you're on returns its stack to the first screen, e.g. Confirmation -> Home.
              if (active && route.state?.key && (route.state.index ?? 0) > 0) {
                navigation.dispatch({ ...StackActions.popToTop(), target: route.state.key });
              } else {
                navigation.navigate(route.name);
              }
            }}>
            <Icon name={active && icon === 'home' ? 'homeFill' : icon} color={color} size={25} />
            <Text style={[styles.tabLabel, { color }]}>{labels[route.name] || route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function sheetStyle(extra?: ViewStyle): ViewStyle {
  return { backgroundColor: colors.card, borderRadius: 18, padding: 16, ...extra };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { height: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: colors.black },
  headerMid: { flex: 1, alignItems: 'center' },
  side: { width: 40 },
  headerTitle: { color: colors.white, fontFamily: fonts.serifSemi, fontSize: 24 },
  gold: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goldText: { color: colors.ink, fontFamily: fonts.sansSemi, fontSize: 17 },
  blackBtn: {
    backgroundColor: '#151413',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackText: { color: colors.white, fontFamily: fonts.sansSemi, fontSize: 17 },
  ghost: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ghostLight: { height: 42, borderRadius: 10, borderWidth: 1.2, backgroundColor: colors.card },
  ghostText: { color: colors.white, fontFamily: fonts.sans, fontSize: 17 },
  field: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  fieldTall: { minHeight: 78, paddingHorizontal: 18, gap: 16, marginBottom: 14, borderRadius: 12 },
  fieldIcon: { width: 28, alignItems: 'center' },
  fieldLabel: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13 },
  fieldValue: { color: colors.ink, fontFamily: fonts.sansSemi, fontSize: 16, marginTop: 1 },
  tab: {
    flexDirection: 'row',
    backgroundColor: colors.tab,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontFamily: fonts.sans, fontSize: 12 },
});
