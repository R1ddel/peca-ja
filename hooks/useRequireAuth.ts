import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { loginHref } from '@/utils/authReturnTo';

/**
 * Redireciona para login se não houver sessão.
 * Usado nas abas (sem alterar tabs/_layout.tsx).
 */
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(loginHref(pathname) as any);
    }
  }, [user, isLoading, pathname]);

  return { user, isLoading };
}
