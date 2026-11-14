/**
 * Gate /admin → login ou overview.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isStaffRole } from '@/services/platformRoles';
import { theme } from '@/constants/theme';

export default function AdminIndex() {
  const { user, isLoading, cloudAuth } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (cloudAuth && isStaffRole(user?.platformRole)) {
      router.replace('/admin/overview' as any);
    } else {
      router.replace('/admin/login' as any);
    }
  }, [isLoading, user, cloudAuth]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1419' },
});
