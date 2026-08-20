/**
 * Credenciais salvas localmente (Expo Go / AsyncStorage).
 * Escopos separados: conta do app e login da equipe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedLoginScope = 'customer' | 'staff';

export type SavedLogin = {
  email: string;
  password: string;
};

const KEY: Record<SavedLoginScope, string> = {
  customer: '@pecaja_saved_login_customer_v1',
  staff: '@pecaja_saved_login_staff_v1',
};

export async function getSavedLogin(scope: SavedLoginScope): Promise<SavedLogin | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY[scope]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLogin>;
    if (!parsed?.email || typeof parsed.password !== 'string') return null;
    return { email: String(parsed.email), password: String(parsed.password) };
  } catch {
    return null;
  }
}

export async function saveLogin(
  scope: SavedLoginScope,
  email: string,
  password: string
): Promise<void> {
  const payload: SavedLogin = {
    email: email.trim().toLowerCase(),
    password,
  };
  await AsyncStorage.setItem(KEY[scope], JSON.stringify(payload));
}

export async function clearSavedLogin(scope: SavedLoginScope): Promise<void> {
  await AsyncStorage.removeItem(KEY[scope]);
}
