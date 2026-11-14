import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { obrasTheme } from '@/constants/obrasTheme';
import { getCurrentObrasUser, getObrasSession, obrasHomeForRole } from '@/utils/obrasStore';

/** Redireciona para login ou painel conforme sessão. */
export default function ObrasIndex() {
  useEffect(() => {
    void (async () => {
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
      if (!session.activeProjectId) {
        router.replace('/obras/projects' as any);
        return;
      }
      router.replace(obrasHomeForRole(user.role) as any);
    })();
  }, []);

  return (
    <MobileShell style={styles.screen}>
      <View style={styles.center}>
        <ActivityIndicator color={obrasTheme.colors.primary} size="large" />
      </View>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obrasTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
