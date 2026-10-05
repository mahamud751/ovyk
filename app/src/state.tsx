import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from './api';
import { addDays, todayIso } from './format';
import { Lang } from './i18n';

export type SessionUser = {
  id: string;
  role: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  preferredLanguage: Lang;
  marketingConsent: boolean;
  notifications: { push: boolean; email: boolean; sms: boolean; whatsapp: boolean };
  safeContactMethod: string;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
};

export type Draft = {
  citySlug: string;
  cityName: string;
  type: 'DAY' | 'STAY';
  startDate: string;
  endDate: string;
  pickupTime: string;
  passengers: number;
  luggage: number;
  pickupLabel: string;
  pickupKind: string;
  pickupLat?: number;
  pickupLng?: number;
  cityLat?: number;
  cityLng?: number;
  flightNumber: string;
  childSeat: boolean;
  accessibility: boolean;
  notes: string;
  vehicleId: string;
  promoCode: string;
};

export const STAY_NIGHTS = 7;

export function makeDraft(): Draft {
  const startDate = addDays(todayIso(), 1);
  return {
    citySlug: '',
    cityName: '',
    type: 'STAY',
    startDate,
    endDate: addDays(startDate, STAY_NIGHTS),
    pickupTime: '14:00',
    passengers: 1,
    luggage: 1,
    pickupLabel: '',
    pickupKind: '',
    flightNumber: '',
    childSeat: false,
    accessibility: false,
    notes: '',
    vehicleId: '',
    promoCode: '',
  };
}

export type City = { slug: string; name: string; lat: number; lng: number };
export type Place = { id: string; name: string; line: string; kind: string; lat: number; lng: number };

type AppState = {
  ready: boolean;
  user: SessionUser | null;
  language: Lang;
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  signIn: (user: SessionUser, accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setLanguage: (language: Lang) => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [language, setLang] = useState<Lang>('EN');
  const [draft, setDraftState] = useState<Draft>(makeDraft);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('ovyk_token');
      const lang = (await AsyncStorage.getItem('ovyk_lang')) as Lang | null;
      if (lang === 'BN' || lang === 'EN') setLang(lang);
      if (saved) {
        setToken(saved);
        try {
          const me = await api<SessionUser>('/auth/me');
          setUser(me);
          if (me.preferredLanguage) setLang(me.preferredLanguage);
        } catch {
          setToken(null);
          await AsyncStorage.removeItem('ovyk_token');
        }
      }
      setReady(true);
    })();
  }, []);

  // Fill the city and pickup from the live catalogue once signed in.
  useEffect(() => {
    if (!user || draft.citySlug) return;
    api<City[]>('/cities')
      .then((cities) => {
        const city = cities.find((row) => row.slug === 'sylhet') || cities[0];
        if (city) setDraftState((current) => ({ ...current, citySlug: city.slug, cityName: city.name, cityLat: city.lat, cityLng: city.lng }));
      })
      .catch(() => undefined);
  }, [user, draft.citySlug]);

  useEffect(() => {
    if (!user || !draft.citySlug || draft.pickupLabel) return;
    api<Place[]>(`/cities/${draft.citySlug}/places`)
      .then((places) => {
        const place = places[0];
        if (place) {
          setDraftState((current) =>
            current.citySlug === draft.citySlug && !current.pickupLabel
              ? { ...current, pickupLabel: place.name, pickupKind: place.kind, pickupLat: place.lat, pickupLng: place.lng }
              : current,
          );
        }
      })
      .catch(() => undefined);
  }, [user, draft.citySlug, draft.pickupLabel]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      user,
      language,
      draft,
      setDraft: (patch) => setDraftState((current) => ({ ...current, ...patch })),
      signIn: async (next, accessToken) => {
        setToken(accessToken);
        await AsyncStorage.setItem('ovyk_token', accessToken);
        setUser(next);
        if (next.preferredLanguage) {
          setLang(next.preferredLanguage);
          await AsyncStorage.setItem('ovyk_lang', next.preferredLanguage);
        }
      },
      signOut: async () => {
        setToken(null);
        await AsyncStorage.removeItem('ovyk_token');
        setUser(null);
        setDraftState(makeDraft());
      },
      refreshMe: async () => {
        const me = await api<SessionUser>('/auth/me');
        setUser(me);
      },
      setLanguage: async (next) => {
        setLang(next);
        await AsyncStorage.setItem('ovyk_lang', next);
        if (user) {
          const me = await api<SessionUser>('/auth/me', {
            method: 'PATCH',
            body: JSON.stringify({ preferredLanguage: next }),
          });
          setUser(me);
        }
      },
    }),
    [ready, user, language, draft],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp outside provider');
  return value;
}
