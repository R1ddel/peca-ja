/**
 * Sessão da plataforma (token JWT-like opaco no AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@pecaja_platform_token';

export async function getPlatformToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setPlatformToken(token: string | null): Promise<void> {
  try {
    if (!token) await AsyncStorage.removeItem(TOKEN_KEY);
    else await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}
