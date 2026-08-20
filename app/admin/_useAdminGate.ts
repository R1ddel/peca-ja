/** Garante sessão staff HQ; redireciona se não. */
import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export function useAdminGate(opts?: { ceoOnly?: boolean }) {
  const { user, isLoading, cloudAuth } = useAuth();
  const pathname = usePathname();
  const role = user?.platformRole;
  const isStaff = role === 'ceo' || role === 'ops';
  const ok = !!cloudAuth && isStaff && (!opts?.ceoOnly || role === 'ceo');

  useEffect(() => {
    if (isLoading) return;
    if (pathname === '/admin/login') return;
    if (!cloudAuth || !isStaff) {
      router.replace('/admin/login' as any);
      return;
    }
    if (opts?.ceoOnly && role !== 'ceo') {
      router.replace('/admin/overview' as any);
    }
  }, [isLoading, cloudAuth, isStaff, role, opts?.ceoOnly, pathname]);

  return { user, role, ok, isLoading };
}
