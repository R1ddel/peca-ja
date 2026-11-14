import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack, usePathname, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { obrasTheme } from '@/constants/obrasTheme';
import { getCurrentObrasUser, getObrasSession } from '@/utils/obrasStore';

const PUBLIC_PATHS = ['/obras', '/obras/login', '/obras/projects'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

export default function ObrasLayout() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const checkAuth = useCallback(async () => {
    if (isPublic(pathname ?? '')) {
      setReady(true);
      return;
    }
    const session = await getObrasSession();
    if (!session) {
      router.replace('/obras/login' as any);
      return;
    }
    const user = await getCurrentObrasUser();
    if (!user) {
      router.replace('/obras/login' as any);
      return;
    }
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={obrasTheme.colors.primary} size="large" />
          <Text style={styles.muted}>Carregando Obras…</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obrasTheme.colors.background },
  screen: { flex: 1, backgroundColor: obrasTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: obrasTheme.colors.textMuted, fontSize: obrasTheme.fontSize.sm },
});
