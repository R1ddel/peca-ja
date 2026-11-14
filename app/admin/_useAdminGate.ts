/**
 * Gate do Command Center — exclusivo WEB.
 * No app nativo, bloqueia e orienta abrir no navegador.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isStaffRole, hasPermission, type PlatformPermission } from '@/services/platformRoles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHqMode, setHqMode, type HqThemeMode } from '@/app/admin/_ui';
import { getPlatformToken } from '@/services/platformSession';

const THEME_KEY = '@pecaja_hq_theme';

export function useAdminGate(opts?: {
  ceoOnly?: boolean;
  permission?: PlatformPermission;
}) {
  const { user, isLoading, cloudAuth } = useAuth();
  const pathname = usePathname();
  const role = user?.platformRole;
  const isWeb = Platform.OS === 'web';
  const isStaff = isStaffRole(role);
  const permOk = opts?.permission ? hasPermission(role, opts.permission) : true;
  const ceoOk = !opts?.ceoOnly || role === 'ceo';
  const ok = isWeb && !!cloudAuth && isStaff && permOk && ceoOk;

  useEffect(() => {
    if (isLoading) return;
    if (pathname === '/admin/login') return;
    if (!isWeb) return;
    void (async () => {
      const token = await getPlatformToken();
      if (!token || !cloudAuth || !isStaff) {
        router.replace('/admin/login' as any);
        return;
      }
      if (opts?.ceoOnly && role !== 'ceo') {
        router.replace('/admin/overview' as any);
      }
    })();
  }, [isLoading, cloudAuth, isStaff, role, opts?.ceoOnly, pathname, isWeb]);

  return { user, role, ok, isLoading, isWeb, isStaff };
}

export function useHqTheme() {
  const [mode, setMode] = useState<HqThemeMode>(getHqMode());

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light') {
        setHqMode(v);
        setMode(v);
      }
    });
  }, []);

  const toggle = () => {
    const next: HqThemeMode = mode === 'light' ? 'dark' : 'light';
    setHqMode(next);
    setMode(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  };

  return {
    mode,
    toggle,
    setMode: (m: HqThemeMode) => {
      setHqMode(m);
      setMode(m);
      void AsyncStorage.setItem(THEME_KEY, m);
    },
  };
}
