import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Entrada por código de convite removida.
 * Redireciona para pedido de acesso (aprovação do dono).
 */
export default function TeamJoinRedirect() {
  useEffect(() => {
    router.replace('/merchant/staff/request-access' as any);
  }, []);
  return null;
}
