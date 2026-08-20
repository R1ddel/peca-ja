import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { theme } from '@/constants/theme';

/** Redireciona o cadastro antigo para o novo fluxo completo. */
export default function DriverApplyRedirect() {
  useEffect(() => {
    router.replace('/driver/register' as any);
  }, []);

  return (
    <MobileShell style={styles.screen}>
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
