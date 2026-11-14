/**
 * Contexto HQ V2 — modo REAL vs PROJEÇÃO (persistido localmente).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HqDataMode } from '@/services/hqMode';
import { hqEnvironmentLabel } from '@/services/hqMode';

const KEY = '@pecaja_hq_data_mode_v2';

type HqCtx = {
  mode: HqDataMode;
  setMode: (m: HqDataMode) => void;
  environmentLabel: string;
  isProjection: boolean;
  ensureRealIfProjectionUnavailable: (projectionAvailable: boolean) => void;
};

const Ctx = createContext<HqCtx>({
  mode: 'real',
  setMode: () => {},
  environmentLabel: hqEnvironmentLabel('real'),
  isProjection: false,
  ensureRealIfProjectionUnavailable: () => {},
});

export function HqModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<HqDataMode>('projection');

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw === 'projection' || raw === 'real') setModeState(raw);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const setMode = useCallback((m: HqDataMode) => {
    setModeState(m);
    void AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  /** Se projeção não estiver disponível, volta para REAL automaticamente. */
  const ensureRealIfProjectionUnavailable = useCallback(
    (projectionAvailable: boolean) => {
      if (mode === 'projection' && !projectionAvailable) {
        setMode('real');
      }
    },
    [mode, setMode]
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      environmentLabel: hqEnvironmentLabel(mode),
      isProjection: mode === 'projection',
      ensureRealIfProjectionUnavailable,
    }),
    [mode, setMode, ensureRealIfProjectionUnavailable]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHqMode() {
  return useContext(Ctx);
}
