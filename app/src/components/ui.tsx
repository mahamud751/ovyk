import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { translate } from '../i18n';
import { useApp } from '../state';
import { colors, logoType, sans, serif, taglineType } from '../theme';

export function Icon({ name, color = colors.ink, size = 22 }: { name: string; color?: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  if (name === 'home') {
    return (
      <Svg {...common}>
        <Path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'stay') {
    return (
      <Svg {...common}>
        <Rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth={1.6} />
        <Path d="M4 10h16M8 3v4M16 3v4" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'bell') {
    return (
      <Svg {...common}>
        <Path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16Z" stroke={color} strokeWidth={1.6} />
        <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'person') {
    return (
      <Svg {...common}>
        <Circle cx="12" cy="8" r="3.2" stroke={color} strokeWidth={1.6} />
        <Path d="M5 19.5c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'pin') {
    return (
      <Svg {...common}>
        <Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke={color} strokeWidth={1.6} />
        <Circle cx="12" cy="11" r="1.6" fill={color} />
      </Svg>
    );
  }
  if (name === 'plane') {
    return (
      <Svg {...common}>
        <Path d="M3 12.5 21 4l-6 16-3.2-6.2L3 12.5Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (name === 'calendar') {
    return (
      <Svg {...common}>
        <Rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth={1.6} />
        <Path d="M8 3.5V7M16 3.5V7M4 10h16" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'clock') {
    return (
      <Svg {...common}>
        <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.6} />
        <Path d="M12 8v4.5L15 15" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'people') {
    return (
      <Svg {...common}>
        <Circle cx="9" cy="9" r="2.4" stroke={color} strokeWidth={1.6} />
        <Circle cx="16" cy="10" r="2" stroke={color} strokeWidth={1.6} />
        <Path d="M4.5 18c.8-2.4 2.6-3.6 4.6-3.6S13 15.6 13.8 18M14 14.6c1.6.1 3 .9 3.8 3.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'bag') {
    return (
      <Svg {...common}>
        <Rect x="5" y="7" width="14" height="12" rx="2" stroke={color} strokeWidth={1.6} />
        <Path d="M9 7V6a3 3 0 0 1 6 0v1" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'shield') {
    return (
      <Svg {...common}>
        <Path d="M12 3.5 19 6v6.2c0 3.6-2.7 6.2-7 8.3-4.3-2.1-7-4.7-7-8.3V6l7-2.5Z" stroke={color} strokeWidth={1.6} />
      </Svg>
    );
  }
  if (name === 'check') {
    return (
      <Svg {...common}>
        <Circle cx="12" cy="12" r="9" fill={colors.ink} />
        <Path d="M8 12.2 10.8 15 16 9.5" stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg {...common}>
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[logoType, light ? null : { color: colors.champagne }]}>OVYK</Text>
      <Text style={taglineType}>The new word for Comfort</Text>
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
            <Text style={styles.back}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      {title ? <Text style={styles.headerTitle}>{title}</Text> : <Logo />}
      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {onBell ? (
          <Pressable onPress={onBell} hitSlop={12}>
            <Icon name="bell" color={colors.champagne} />
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

export function GoldButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.gold, (pressed || disabled) && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.goldText}>{label}  →</Text>}
    </Pressable>
  );
}

export function BlackButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.blackBtn}>
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.blackText}>{label}  →</Text>}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
  onLight,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  onLight?: boolean;
}) {
  const border = danger ? colors.danger : onLight ? colors.ink : 'rgba(255,255,255,0.85)';
  const text = danger ? colors.danger : onLight ? colors.ink : colors.white;
  return (
    <Pressable onPress={onPress} style={[styles.ghost, { borderColor: border }]}>
      {danger ? <Icon name="shield" color={colors.danger} size={18} /> : null}
      <Text style={[styles.ghostText, { color: text }]}>{label}</Text>
    </Pressable>
  );
}

export function FieldRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.field}>
      <Icon name={icon} color={colors.secondary} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function useT() {
  const { language } = useApp();
  return (key: string) => translate(language, key);
}

export function OvykTabBar({ state, navigation }: { state: { index: number; routes: { name: string; key: string }[] }; navigation: { navigate: (name: string) => void } }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const icons: Record<string, string> = { Home: 'home', Stay: 'stay', Concierge: 'bell', Account: 'person' };
  const labels: Record<string, string> = { Home: t('home'), Stay: t('myStay'), Concierge: t('concierge'), Account: t('account') };
  return (
    <View style={[styles.tab, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const active = state.index === index;
        const color = active ? colors.champagne : '#A39C92';
        return (
          <Pressable key={route.key} style={styles.tabItem} onPress={() => navigation.navigate(route.name)}>
            <Icon name={icons[route.name] || 'home'} color={color} size={22} />
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
  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { width: 44 },
  back: { color: colors.white, fontSize: 34, lineHeight: 36, fontFamily: serif },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.white, fontFamily: serif, fontSize: 22 },
  gold: {
    backgroundColor: colors.champagne,
    height: 54,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldText: { color: colors.ink, fontFamily: sans, fontSize: 16, fontWeight: '600' },
  blackBtn: {
    backgroundColor: colors.ink,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackText: { color: colors.white, fontFamily: sans, fontSize: 16, fontWeight: '600' },
  ghost: {
    height: 52,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ghostText: { color: colors.white, fontFamily: sans, fontSize: 16 },
  field: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  fieldLabel: { color: colors.muted, fontFamily: sans, fontSize: 12 },
  fieldValue: { color: colors.ink, fontFamily: sans, fontSize: 16, fontWeight: '600', marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 22 },
  tab: {
    flexDirection: 'row',
    backgroundColor: colors.tab,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontFamily: sans, fontSize: 11 },
});
