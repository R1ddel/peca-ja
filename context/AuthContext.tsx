import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import {
  platformLogin,
  platformRegister,
  platformResetPassword,
  platformRequestPasswordReset,
  platformUpdateProfile,
  platformLogout,
  platformMe,
  asPlatformUser,
  asPlatformToken,
} from '@/services/platformClient';
import { getPlatformToken, setPlatformToken } from '@/services/platformSession';
import { hydrateDemoLocation } from '@/utils/demoLocation';
import {
  applyLocalPasswordReset,
  createLocalPasswordReset,
  findLocalUserByEmail,
  getLocalUsers,
  hydrateLocalAccountIfRemembered,
  saveLocalUsers,
  upsertLocalUser,
  verifyLocalLogin,
} from '@/utils/localAuthStore';
import { normalizeEmail } from '@/utils/authEmail';

type AuthResult = { success: boolean; error?: string };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** true quando login/registro passou pela API da plataforma. */
  cloudAuth: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    address: string;
  }) => Promise<AuthResult>;
  resetPassword: (
    email: string,
    newPassword: string,
    resetToken: string
  ) => Promise<AuthResult>;
  requestPasswordReset: (
    email: string
  ) => Promise<AuthResult & { devResetToken?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = '@pecaja_current_user';
const CLOUD_AUTH_KEY = '@pecaja_cloud_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudAuth, setCloudAuth] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      await hydrateDemoLocation();

      const token = await getPlatformToken();
      if (token) {
        const me = await platformMe(token);
        const remoteUser = me ? asPlatformUser(me) : null;
        if (remoteUser) {
          setUser(remoteUser);
          setCloudAuth(true);
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(remoteUser));
          await AsyncStorage.setItem(CLOUD_AUTH_KEY, '1');
          return;
        }
        await setPlatformToken(null);
      }

      const stored = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (stored) setUser(JSON.parse(stored));
      const cloud = await AsyncStorage.getItem(CLOUD_AUTH_KEY);
      setCloudAuth(cloud === '1');
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function persistSession(userData: User, opts: { cloud: boolean; token?: string | null }) {
    setUser(userData);
    setCloudAuth(opts.cloud);
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userData));
    await AsyncStorage.setItem(CLOUD_AUTH_KEY, opts.cloud ? '1' : '0');
    if (opts.cloud && opts.token) {
      await setPlatformToken(opts.token);
      // Loja local → ownerUserId na nuvem (necessário para saque)
      void import('@/utils/merchantShop')
        .then((m) => m.syncLocalShopsToPlatform())
        .catch(() => {});
    } else if (!opts.cloud) {
      await setPlatformToken(null);
    }
  }

  /** Espelha senha no aparelho para login/recuperação offline. */
  async function mirrorPasswordLocally(
    userData: User,
    password: string
  ): Promise<void> {
    await upsertLocalUser({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      password,
      photoUrl: userData.photoUrl,
      coverUrl: userData.coverUrl,
      bio: userData.bio,
      createdAt: userData.createdAt,
    });
  }

  /** Se a conta só existe no aparelho, tenta criar na nuvem. */
  async function tryMigrateLocalToCloud(
    email: string,
    password: string,
    localUser: User
  ): Promise<{ user: User; token: string } | null> {
    const reg = await platformRegister({
      name: localUser.name,
      email,
      phone: localUser.phone || '',
      password,
      address: localUser.address || '',
    });
    const regUser = reg ? asPlatformUser(reg) : null;
    const regToken = reg ? asPlatformToken(reg) : null;
    if (regUser && regToken) {
      await mirrorPasswordLocally(regUser, password);
      return { user: regUser, token: regToken };
    }
    if (reg && !reg.ok && reg.code === 'EXISTS') {
      const loginRes = await platformLogin(email, password);
      const u = loginRes ? asPlatformUser(loginRes) : null;
      const t = loginRes ? asPlatformToken(loginRes) : null;
      if (u && t) {
        await mirrorPasswordLocally(u, password);
        return { user: u, token: t };
      }
    }
    return null;
  }

  const login = useCallback(async (email: string, password: string) => {
    const trimmed = normalizeEmail(email);
    if (!trimmed.includes('@')) {
      return { success: false, error: 'Informe um e-mail válido.' };
    }
    if (!password) {
      return { success: false, error: 'Informe a senha.' };
    }

    const remote = await platformLogin(trimmed, password);
    const remoteUser = remote ? asPlatformUser(remote) : null;
    const remoteToken = remote ? asPlatformToken(remote) : null;

    if (remoteUser && remoteToken) {
      await mirrorPasswordLocally(remoteUser, password);
      await persistSession(remoteUser, { cloud: true, token: remoteToken });
      return { success: true };
    }

    const localLogin = await verifyLocalLogin(trimmed, password);
    if (localLogin.ok) {
      const migrated = await tryMigrateLocalToCloud(trimmed, password, localLogin.user);
      if (migrated) {
        await persistSession(migrated.user, { cloud: true, token: migrated.token });
        return { success: true };
      }
      await persistSession(localLogin.user, { cloud: false });
      return { success: true };
    }

    const localUser = await findLocalUserByEmail(trimmed);
    if (remote && !remote.ok && remote.message?.toLowerCase().includes('senha')) {
      return { success: false, error: 'Senha incorreta. Use Recuperar conta se esqueceu.' };
    }
    if (localUser) {
      return {
        success: false,
        error: 'Senha incorreta neste aparelho. Toque em Recuperar conta para gerar um código.',
      };
    }
    if (remote && !remote.ok) {
      return {
        success: false,
        error:
          'Não há conta com este e-mail na nuvem nem neste celular. Crie uma conta — ela fica salva na nuvem.',
      };
    }
    return {
      success: false,
      error:
        localLogin.ok === false
          ? localLogin.error
          : 'Não foi possível entrar. Confira a conexão, recupere a senha ou crie a conta.',
    };
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone: string;
      password: string;
      address: string;
    }) => {
      const email = normalizeEmail(data.email);
      const remote = await platformRegister({ ...data, email });
      const remoteUser = remote ? asPlatformUser(remote) : null;
      const remoteToken = remote ? asPlatformToken(remote) : null;

      if (remoteUser && remoteToken) {
        await mirrorPasswordLocally(remoteUser, data.password);
        await persistSession(remoteUser, { cloud: true, token: remoteToken });
        return { success: true };
      }

      if (remote && !remote.ok && remote.code === 'EXISTS') {
        // Já existe na nuvem — tenta login com a senha informada
        const loginRes = await platformLogin(email, data.password);
        const u = loginRes ? asPlatformUser(loginRes) : null;
        const t = loginRes ? asPlatformToken(loginRes) : null;
        if (u && t) {
          await mirrorPasswordLocally(u, data.password);
          await persistSession(u, { cloud: true, token: t });
          return { success: true };
        }
        return { success: false, error: remote.message };
      }

      // API offline / falhou — cria só no aparelho
      const existing = await findLocalUserByEmail(email);
      if (existing) {
        return { success: false, error: 'Este e-mail já está cadastrado neste aparelho.' };
      }

      const local = await upsertLocalUser({
        name: data.name,
        email,
        phone: data.phone,
        address: data.address,
        password: data.password,
      });
      const { password: _, ...userData } = local;
      await persistSession(userData, { cloud: false });
      return { success: true };
    },
    []
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmed = normalizeEmail(email);
    if (!trimmed.includes('@')) return { success: false, error: 'Informe o e-mail da conta.' };

    await hydrateLocalAccountIfRemembered(trimmed);

    const remote = await platformRequestPasswordReset(trimmed);
    const remoteToken =
      remote && remote.ok
        ? typeof (remote as { resetToken?: string }).resetToken === 'string'
          ? (remote as { resetToken: string }).resetToken
          : typeof (remote as { devResetToken?: string }).devResetToken === 'string'
            ? (remote as { devResetToken: string }).devResetToken
            : undefined
        : undefined;
    const cloudExists = !!(remote && remote.ok && (remote as { exists?: boolean }).exists === true);

    if (remoteToken) {
      return { success: true, devResetToken: String(remoteToken).toUpperCase() };
    }

    const local = await createLocalPasswordReset(trimmed);
    if (local.ok) {
      return { success: true, devResetToken: local.token };
    }

    if (cloudExists && !remoteToken) {
      return {
        success: false,
        error:
          'Conta encontrada na nuvem, mas o código não veio. Tente de novo em alguns segundos.',
      };
    }

    return {
      success: false,
      error:
        'Não encontramos este e-mail na nuvem nem neste celular. Crie uma conta com o mesmo e-mail — ela fica salva na nuvem.',
    };
  }, []);

  const resetPassword = useCallback(
    async (email: string, newPassword: string, resetToken: string) => {
      const trimmed = normalizeEmail(email);
      if (!trimmed.includes('@')) return { success: false, error: 'Informe o e-mail da conta.' };
      if (newPassword.length < 6) {
        return { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
      }
      if (!resetToken.trim()) {
        return { success: false, error: 'Informe o código de recuperação.' };
      }

      const remote = await platformResetPassword(trimmed, newPassword, resetToken.trim());
      if (remote?.ok) {
        const localUser = await findLocalUserByEmail(trimmed);
        if (localUser) {
          await upsertLocalUser({ ...localUser, password: newPassword });
        }
        return { success: true };
      }

      const local = await applyLocalPasswordReset(trimmed, newPassword, resetToken);
      if (local.ok) {
        const localUser = await findLocalUserByEmail(trimmed);
        if (localUser) {
          await tryMigrateLocalToCloud(trimmed, newPassword, localUser);
        }
        return { success: true };
      }

      return {
        success: false,
        error: remote?.message || local.error || 'Não foi possível redefinir a senha.',
      };
    },
    []
  );

  const logout = useCallback(async () => {
    const token = await getPlatformToken();
    if (token) await platformLogout(token);
    await setPlatformToken(null);
    await AsyncStorage.setItem(CLOUD_AUTH_KEY, '0');
    setCloudAuth(false);
    setUser(null);
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      if (!user) return;
      const patched: User = { ...user, ...data };

      const token = await getPlatformToken();
      if (token) {
        const remote = await platformUpdateProfile(token, data);
        const remoteUser = remote ? asPlatformUser(remote) : null;
        if (remoteUser) {
          const merged: User = {
            ...patched,
            ...remoteUser,
            ...data,
          };
          if (!('photoUrl' in data) && !remoteUser.photoUrl && patched.photoUrl) {
            merged.photoUrl = patched.photoUrl;
          }
          if (!('coverUrl' in data) && !remoteUser.coverUrl && patched.coverUrl) {
            merged.coverUrl = patched.coverUrl;
          }
          setUser(merged);
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(merged));
          const local = await findLocalUserByEmail(merged.email);
          if (local) {
            await upsertLocalUser({
              ...local,
              ...merged,
              password: local.password,
            });
          }
          return;
        }
      }

      setUser(patched);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(patched));
      const users = await getLocalUsers();
      const index = users.findIndex((u) => u.id === user.id || u.email === user.email);
      if (index >= 0) {
        users[index] = { ...users[index], ...data };
        await saveLocalUsers(users);
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        cloudAuth,
        login,
        register,
        requestPasswordReset,
        resetPassword,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
