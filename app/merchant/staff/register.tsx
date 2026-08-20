import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Cadastro por código de convite removido.
 * Redireciona para pedido de acesso (aprovação do dono).
 */
export default function StaffRegisterRedirect() {
  useEffect(() => {
    router.replace('/merchant/staff/request-access' as any);
  }, []);
  return null;
}
