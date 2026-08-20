import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { ActiveRunsBlock } from '@/components/ActiveRunsBlock';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { DriverApplication, resolveDriverApplication } from '@/utils/partners';
import { driverFleetId, listDriverActive } from '@/utils/driverOps';
import { usePublishDriverLocation } from '@/hooks/usePublishDriverLocation';
import { theme } from '@/constants/theme';

const ACCENT = '#7C3AED';

export default function DriverActiveScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [app, setApp] = useState<DriverApplication | null>(null);
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const next = await resolveDriverApplication(user?.email);
        setApp(next?.status === 'approved' ? next : null);
        setFleetId(next?.status === 'approved' ? driverFleetId(next) : null);
        setReady(true);
      })();
    }, [user?.email])
  );

  const list = useMemo(
    () => (fleetId ? listDriverActive(orders, fleetId) : []),
    [orders, fleetId]
  );

  usePublishDriverLocation(
    app && fleetId
      ? {
          fleetId,
          applicationId: app.id,
          name: app.name,
          phone: app.phone,
        }
      : null,
    list.length > 0
  );

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Corridas ativas" fallbackHref="/driver" />
      <ScrollView contentContainerStyle={styles.list}>
        <ActiveRunsBlock
          variant="driver"
          orders={list}
          accent={ACCENT}
          onPressOrder={(id) =>
            router.push({ pathname: '/driver/order/[id]' as any, params: { id } })
          }
          emptyHint="Aceite uma oferta em Disponíveis para começar."
        />
        {list.length === 0 ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.push('/driver/jobs' as any)}
          >
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.ctaText}>Ver disponíveis</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  cta: {
    marginTop: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '800' },
});
