import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Stack, useFocusEffect, usePathname, router } from 'expo-router';
import { theme } from '@/constants/theme';
import { DriverChatWatcher } from '@/components/DriverChatWatcher';
import { getDriverSession } from '@/utils/driverSession';

function isPublicDriverPath(pathname?: string | null) {
  const path = pathname || '';
  return (
    path.includes('/driver/login') ||
    path.includes('/driver/register') ||
    path.includes('/driver/terms')
  );
}

/**
 * Layout do painel do entregador — exige sessão (exceto login/cadastro/termos).
 */
export default function DriverLayout() {
  const pathname = usePathname();
  const publicPath = isPublicDriverPath(pathname);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (isPublicDriverPath(pathname)) {
          if (!cancelled) {
            setAuthed(false);
            setReady(true);
          }
          return;
        }
        const session = await getDriverSession();
        if (cancelled) return;
        setAuthed(!!session);
        setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [pathname])
  );

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!publicPath && !authed) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Painel do entregador</Text>
        <Text style={styles.sub}>Faça login para continuar.</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/driver/login' as any)}
        >
          <Text style={styles.btnText}>Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile' as any)}>
          <Text style={styles.link}>Voltar ao perfil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {!publicPath ? <DriverChatWatcher /> : null}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  sub: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  btn: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: theme.fontWeight.bold },
  link: { marginTop: 12, color: theme.colors.primary, fontWeight: '600' },
});
