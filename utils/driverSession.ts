/**
 * Sessão local do painel do entregador (após login dedicado).
 * Nunca persiste senha em plaintext — "lembrar" guarda só o e-mail.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@pecaja_driver_session_v1';
const REMEMBER_KEY = '@pecaja_driver_remember_login_v1';

export type DriverSession = {
  applicationId: string;
  email: string;
  loggedAt: string;
};

export type DriverRememberedLogin = {
  email: string;
  /** @deprecated nunca mais gravado — mantido opcional para limpar payloads antigos */
  password?: string;
  savedAt: string;
};

export async function getDriverSession(): Promise<DriverSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.applicationId || !parsed?.email) return null;
    return parsed as DriverSession;
  } catch {
    return null;
  }
}

export async function setDriverSession(session: DriverSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearDriverSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getRememberedDriverLogin(): Promise<DriverRememberedLogin | null> {
  try {
    const raw = await AsyncStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    // Migra payloads antigos com senha: regrava só o e-mail
    if (typeof parsed.password === 'string' && parsed.password.length > 0) {
      await setRememberedDriverLogin(parsed.email);
      return { email: String(parsed.email).trim().toLowerCase(), savedAt: new Date().toISOString() };
    }
    return {
      email: String(parsed.email).trim().toLowerCase(),
      savedAt: parsed.savedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function setRememberedDriverLogin(email: string): Promise<void> {
  const payload: DriverRememberedLogin = {
    email: email.trim().toLowerCase(),
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify(payload));
}

export async function clearRememberedDriverLogin(): Promise<void> {
  await AsyncStorage.removeItem(REMEMBER_KEY);
}

const ONLINE_KEY = '@pecaja_driver_online_v1';
const WALLET_KEY = '@pecaja_driver_wallet_v1';
const FORCE_WIPE_KEY = '@pecaja_driver_force_wipe_token';

/**
 * Apaga TODOS os cadastros de entregador neste aparelho (candidatura, sessão, carteira).
 * Mantém cadastros de comércio.
 */
export async function wipeAllDriverLocalData(): Promise<{ removed: number }> {
  const KEY = '@pecaja_partner_applications';
  const LAST_DRIVER_KEY = '@pecaja_last_driver_app';

  let removed = 0;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const kept = list.filter((a: { role?: string }) => a?.role !== 'driver');
      removed = list.length - kept.length;
      await AsyncStorage.setItem(KEY, JSON.stringify(kept));
    }
  } catch {
    /* ignore */
  }

  await AsyncStorage.multiRemove([
    LAST_DRIVER_KEY,
    SESSION_KEY,
    REMEMBER_KEY,
    ONLINE_KEY,
    WALLET_KEY,
  ]);

  try {
    await AsyncStorage.setItem(FORCE_WIPE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }

  return { removed };
}

export async function getDriverForceWipeToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FORCE_WIPE_KEY);
  } catch {
    return null;
  }
}

/**
 * O login pede uma limpeza única por token. A função não existia e a tela quebrava.
 * Marca o token como já aplicado e não apaga cadastros atuais.
 */
export async function maybeForceWipeDriverData(token: string): Promise<boolean> {
  const current = await getDriverForceWipeToken();
  if (current === token) return false;
  try {
    await AsyncStorage.setItem(FORCE_WIPE_KEY, token);
  } catch {
    /* ignore */
  }
  return false;
}
