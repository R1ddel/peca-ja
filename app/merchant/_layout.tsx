import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack, useFocusEffect, usePathname, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { MerchantApplication, isMerchantPanelUnlocked } from '@/utils/partners';
import { hydratePartnerShops } from '@/utils/merchantShop';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import {
  getValidStaffSession,
  staffCanAccessPath,
  staffHomePath,
} from '@/utils/merchantTeam';
import { logMerchantAudit } from '@/utils/merchantAudit';
import {
  attachMerchantNotificationNavigator,
  detachMerchantNotificationNavigator,
  registerMerchantPushToken,
} from '@/services/merchantPush';
import { theme } from '@/constants/theme';
import { MerchantNewOrderWatcher } from '@/components/MerchantNewOrderWatcher';
import { MerchantChatWatcher } from '@/components/MerchantChatWatcher';
import { ShopAutoCloseWatcher } from '@/components/ShopAutoCloseWatcher';

function isPublicStaffPath(pathname?: string | null) {
  const path = pathname || '';
  return (
    path.includes('/staff/login') ||
    path.includes('/staff/register') ||
    path.includes('/staff/request-access') ||
    path.includes('/staff/forgot') ||
    path.includes('/team/join') ||
    path.includes('/advanced')
  );
}

/**
 * Layout do painel: carrega loja, valida sessão e permissões de rota.
 */
export default function MerchantLayout() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [app, setApp] = useState<MerchantApplication | null>(null);
  const publicStaff = isPublicStaffPath(pathname);

  useEffect(() => {
    attachMerchantNotificationNavigator();
    void registerMerchantPushToken();
    return () => detachMerchantNotificationNavigator();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await hydratePartnerShops();

        if (isPublicStaffPath(pathname)) {
          if (!cancelled) {
            setApp(null);
            setReady(true);
          }
          return;
        }

        const { app: found } = await resolveOperatorMerchantContext(user?.email);
        if (cancelled) return;
        setApp(found);

        // Sessão de função: expiração + isolamento de rota
        const before = await import('@/utils/merchantTeam').then((m) => m.getStaffSession());
        const sess = await getValidStaffSession();
        if (before && !sess) {
          await logMerchantAudit({
            businessId: before.businessId,
            actorId: before.memberId,
            actorName: before.name,
            actorRole: before.role,
            action: 'session_expired',
            detail: 'Sessão expirou — precisa entrar de novo',
          });
          if (pathname.includes('/staff/')) {
            router.replace('/merchant/advanced' as any);
            return;
          }
        }

        if (sess && pathname && !staffCanAccessPath(sess.role, pathname)) {
          await logMerchantAudit({
            businessId: sess.businessId,
            actorId: sess.memberId,
            actorName: sess.name,
            actorRole: sess.role,
            action: 'denied_route',
            detail: `Tentou abrir ${pathname}`,
          });
          router.replace(staffHomePath(sess.role) as any);
          return;
        }

        if (!cancelled) setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.email, pathname])
  );

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.muted}>Carregando painel…</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <View style={styles.root}>
      {!publicStaff && app && isMerchantPanelUnlocked(app) ? (
        <>
          <MerchantNewOrderWatcher />
          <MerchantChatWatcher />
          <ShopAutoCloseWatcher />
        </>
      ) : null}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
});
