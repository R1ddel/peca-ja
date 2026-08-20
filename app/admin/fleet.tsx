import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { fleetAdminRemote } from '@/services/fleetClient';
import type { FleetDriverPresence } from '@/services/fleetTypes';
import type { ConductReport } from '@/types';
import { theme } from '@/constants/theme';

export default function AdminFleetScreen() {
  const { ok } = useAdminGate();
  const [drivers, setDrivers] = useState<FleetDriverPresence[]>([]);
  const [reports, setReports] = useState<ConductReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await fleetAdminRemote({ token, adminAction: 'list' });
      if (!res?.ok) {
        Alert.alert('Frota', (res as any)?.message || 'Falha ao carregar.');
        return;
      }
      setDrivers(Object.values((res as any).drivers || {}));
      setReports(Array.isArray((res as any).reports) ? (res as any).reports : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function toggleBlock(d: FleetDriverPresence) {
    const token = await getPlatformToken();
    if (!token) return;
    const adminAction = d.blocked ? 'unblock' : 'block';
    const res = await fleetAdminRemote({
      token,
      adminAction,
      fleetId: d.fleetId,
      reason: d.blocked ? undefined : 'Bloqueado pelo HQ Peça Já.',
    });
    if (!res?.ok) {
      Alert.alert('Erro', (res as any)?.message || 'Falha.');
      return;
    }
    await load();
  }

  if (!ok) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Frota</Text>
      {loading && drivers.length === 0 ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <Text style={styles.h2}>Entregadores ({drivers.length})</Text>
      <FlatList
        data={drivers}
        keyExtractor={(d) => d.fleetId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListFooterComponent={
          <View>
            <Text style={styles.h2}>Denúncias ({reports.length})</Text>
            {reports.slice(0, 30).map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.title}>{r.category}</Text>
                <Text style={styles.meta}>
                  {r.status} · {r.driverName || r.driverId || '—'}
                </Text>
                <Text style={styles.meta}>{r.description}</Text>
              </View>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.name} {item.online ? '· online' : ''}
            </Text>
            <Text style={styles.meta}>
              {item.fleetId}
              {item.blocked ? ' · BLOQUEADO' : ''}
            </Text>
            <TouchableOpacity
              style={[styles.btn, item.blocked ? styles.btnOk : styles.btnDanger]}
              onPress={() => void toggleBlock(item)}
            >
              <Text style={styles.btnText}>{item.blocked ? 'Desbloquear' : 'Bloquear'}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  h2: { color: '#8b949e', fontWeight: '700', marginTop: 12, marginBottom: 8 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: '#8b949e', fontSize: 12, marginTop: 4 },
  btn: { marginTop: 10, padding: 10, borderRadius: 8, alignItems: 'center' },
  btnDanger: { backgroundColor: '#da3633' },
  btnOk: { backgroundColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '800' },
});
