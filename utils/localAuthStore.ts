/**
 * Auth local (AsyncStorage) + espelho das contas da nuvem.
 * Contas criadas no Expo Go desde o início ficam em @pecaja_users.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';
import { normalizeEmail } from '@/utils/authEmail';
import { getSavedLogin } from '@/utils/savedLogin';

const CURRENT_USER_KEY = '@pecaja_current_user';

const USERS_KEY = '@pecaja_users';
const LOCAL_RESETS_KEY = '@pecaja_local_password_resets_v1';

export type LocalStoredUser = User & { password: string };

type LocalReset = {
  email: string;
  token: string;
  expiresAt: string;
};

export async function getLocalUsers(): Promise<LocalStoredUser[]> {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    const list = data ? (JSON.parse(data) as LocalStoredUser[]) : [];
    return list.map((u) => ({ ...u, email: normalizeEmail(u.email || '') }));
  } catch {
    return [];
  }
}

export async function saveLocalUsers(users: LocalStoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Upsert por e-mail — mantém id antigo se já existir. */
export async function upsertLocalUser(input: {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  photoUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  createdAt?: string;
}): Promise<LocalStoredUser> {
  const email = normalizeEmail(input.email);
  const users = await getLocalUsers();
  const idx = users.findIndex((u) => normalizeEmail(u.email) === email);
  const next: LocalStoredUser = {
    id: input.id || (idx >= 0 ? users[idx].id : `local_${Date.now()}`),
    name: input.name,
    email,
    phone: input.phone,
    address: input.address,
    password: input.password,
    photoUrl: input.photoUrl ?? (idx >= 0 ? users[idx].photoUrl : null),
    coverUrl: input.coverUrl ?? (idx >= 0 ? users[idx].coverUrl : null),
    bio: input.bio ?? (idx >= 0 ? users[idx].bio : null),
    createdAt:
      input.createdAt ||
      (idx >= 0 ? users[idx].createdAt : new Date().toISOString()),
  };
  if (idx >= 0) users[idx] = { ...users[idx], ...next };
  else users.push(next);
  await saveLocalUsers(users);
  return next;
}

export async function findLocalUserByEmail(
  email: string
): Promise<LocalStoredUser | null> {
  const users = await getLocalUsers();
  return users.find((u) => normalizeEmail(u.email) === normalizeEmail(email)) ?? null;
}

/**
 * Se a conta não está em @pecaja_users, tenta reconstruir a partir do
 * login salvo ou da última sessão neste aparelho — para recuperação funcionar.
 */
export async function hydrateLocalAccountIfRemembered(
  email: string
): Promise<LocalStoredUser | null> {
  const e = normalizeEmail(email);
  const existing = await findLocalUserByEmail(e);
  if (existing) return existing;

  const saved = await getSavedLogin('customer');
  let sessionUser: Partial<User> | null = null;
  try {
    const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (raw) sessionUser = JSON.parse(raw) as Partial<User>;
  } catch {
    sessionUser = null;
  }

  const savedMatch = saved && normalizeEmail(saved.email) === e;
  const sessionMatch = sessionUser?.email && normalizeEmail(sessionUser.email) === e;
  if (!savedMatch && !sessionMatch) return null;

  return upsertLocalUser({
    id: typeof sessionUser?.id === 'string' ? sessionUser.id : undefined,
    name:
      (typeof sessionUser?.name === 'string' && sessionUser.name) ||
      e.split('@')[0] ||
      'Cliente',
    email: e,
    phone: typeof sessionUser?.phone === 'string' ? sessionUser.phone : '',
    address: typeof sessionUser?.address === 'string' ? sessionUser.address : '',
    password: `__pending_reset_${Date.now()}`,
    photoUrl: sessionUser?.photoUrl,
    coverUrl: sessionUser?.coverUrl,
    bio: sessionUser?.bio,
    createdAt: sessionUser?.createdAt,
  });
}

export async function verifyLocalLogin(
  email: string,
  password: string
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const found = await findLocalUserByEmail(email);
  if (!found) {
    return { ok: false, error: 'E-mail não encontrado. Crie uma conta.' };
  }
  if (found.password !== password) {
    return { ok: false, error: 'Senha incorreta. Tente novamente.' };
  }
  const { password: _, ...userData } = found;
  return { ok: true, user: userData };
}

function newLocalResetToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function loadResets(): Promise<LocalReset[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_RESETS_KEY);
    return raw ? (JSON.parse(raw) as LocalReset[]) : [];
  } catch {
    return [];
  }
}

async function saveResets(list: LocalReset[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_RESETS_KEY, JSON.stringify(list));
}

/** Cria código local se a conta existir no aparelho. */
export async function createLocalPasswordReset(
  email: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const found = (await findLocalUserByEmail(email)) || (await hydrateLocalAccountIfRemembered(email));
  if (!found) {
    return {
      ok: false,
      error:
        'Não encontramos esta conta neste aparelho nem na sessão salva. Crie a conta de novo — ela sobe para a nuvem.',
    };
  }
  const token = newLocalResetToken();
  const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
  const emailKey = normalizeEmail(email);
  const list = (await loadResets()).filter((r) => r.email !== emailKey);
  list.push({ email: emailKey, token, expiresAt });
  await saveResets(list);
  return { ok: true, token };
}

export async function applyLocalPasswordReset(
  email: string,
  newPassword: string,
  resetToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
  }
  const emailKey = normalizeEmail(email);
  const token = resetToken.trim().toUpperCase();
  const list = await loadResets();
  const entry = list.find((r) => r.email === emailKey && r.token === token);
  if (!entry) {
    return { ok: false, error: 'Código inválido ou expirado.' };
  }
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    await saveResets(list.filter((r) => !(r.email === emailKey && r.token === token)));
    return { ok: false, error: 'Código expirado. Solicite um novo.' };
  }
  const users = await getLocalUsers();
  const idx = users.findIndex((u) => normalizeEmail(u.email) === emailKey);
  if (idx < 0) {
    return { ok: false, error: 'Conta não encontrada neste aparelho.' };
  }
  users[idx] = { ...users[idx], password: newPassword };
  await saveLocalUsers(users);
  await saveResets(list.filter((r) => !(r.email === emailKey && r.token === token)));
  return { ok: true };
}
