/**
 * Modo de operação do painel: simples (pequeno comércio) vs avançado (equipe/rede).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OpsMode = 'simple' | 'advanced';

const MODE_KEY = '@pecaja_merchant_ops_mode_v1';
const SESSION_HOURS_KEY = '@pecaja_merchant_session_hours_v1';

export async function getOpsMode(): Promise<OpsMode> {
  try {
    const v = await AsyncStorage.getItem(MODE_KEY);
    return v === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

export async function setOpsMode(mode: OpsMode): Promise<void> {
  await AsyncStorage.setItem(MODE_KEY, mode);
  await AsyncStorage.setItem(SESSION_HOURS_KEY, String(mode === 'advanced' ? 8 : 12));
}

/** Horas de validade da sessão de função (padrão: simples 12h, avançado 8h). */
export async function getSessionHours(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_HOURS_KEY);
    if (raw) {
      const n = Number(raw);
      if (n >= 1 && n <= 24) return n;
    }
  } catch {
    /* ignore */
  }
  const mode = await getOpsMode();
  return mode === 'advanced' ? 8 : 12;
}

export async function setSessionHours(hours: number): Promise<void> {
  const n = Math.min(24, Math.max(1, Math.round(hours)));
  await AsyncStorage.setItem(SESSION_HOURS_KEY, String(n));
}
