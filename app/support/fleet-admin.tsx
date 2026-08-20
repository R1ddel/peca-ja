/**
 * Painel de suporte: denúncias + bloqueio de entregador (frota compartilhada).
 * PIN padrão local: pecaja-suporte (ou EXPO_PUBLIC_SUPPORT_PIN).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { theme } from '@/constants/theme';
import { fleetAdminRemote } from '@/services/fleetClient';
import type { ConductReport } from '@/types';
import type { FleetDriverPresence } from '@/services/fleetTypes';
import { conductCategoryLabel } from '@/utils/conductReports';

export default function FleetAdminScreen() {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ConductReport[]>([]);
  const [drivers, setDrivers] = useState<FleetDriverPresence[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fleetAdminRemote({
        pin,
        adminAction: 'list',
      });
      if (!res?.ok) {
        Alert.alert('Acesso', res?.message || 'Não foi possível carregar a frota.');
        setUnlocked(false);
        return;
      }
      setUnlocked(true);
      setReports(Array.isArray(res.reports) ? res.reports : []);
      setDrivers(Object.values(res.drivers || {}));
    } finally {
      setLoading(false);
    }
  }, [pin]);

  async function unlock() {
    if (pin.trim().length < 4) {
      Alert.alert('PIN', 'Informe o PIN de suporte.');
      return;
    }
    await refresh();
  }

  async function blockDriver(d: FleetDriverPresence) {
    Alert.alert(
      'Bloquear entregador',
      `Bloquear ${d.name} (${d.fleetId})?\nOfertas e corridas sem retirada serão liberadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await fleetAdminRemote({
                pin,
                adminAction: 'block',
                fleetId: d.fleetId,
                reason: 'Bloqueado por denúncia no painel de suporte.',
              });
              if (!res?.ok) {
                Alert.alert('Erro', res?.message || 'Falha ao bloquear.');
                return;
              }
              Alert.alert('OK', 'Entregador bloqueado na frota.');
              await refresh();
            })();
          },
        },
      ]
    );
  }

  async function unblockDriver(d: FleetDriverPresence) {
    const res = await fleetAdminRemote({
      pin,
      adminAction: 'unblock',
      fleetId: d.fleetId,
    });
    if (!res?.ok) {
      Alert.alert('Erro', res?.message || 'Falha ao desbloquear.');
      return;
    }
    await refresh();
  }

  async function markReport(
    reportId: string,
    status: ConductReport['status']
  ) {
    const res = await fleetAdminRemote({
      pin,
      adminAction: 'set_report_status',
      reportId,
      status,
    });
    if (!res?.ok) {
      Alert.alert('Erro', res?.message || 'Falha ao atualizar denúncia.');
      return;
    }
    await refresh();
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Suporte · Frota" fallbackHref="/support" />
      <ScrollView contentContainerStyle={styles.content}>
        {!unlocked ? (
          <View style={styles.lockCard}>
            <Ionicons name="shield-checkmark" size={28} color={theme.colors.primary} />
            <Text style={styles.lockTitle}>Painel interno</Text>
            <Text style={styles.lockHint}>
              Denúncias e bloqueio de entregadores na fila compartilhada. Use o PIN
              de suporte (padrão local: pecaja-suporte).
            </Text>
            <TextInput
              style={styles.pin}
              value={pin}
              onChangeText={setPin}
              placeholder="PIN"
              secureTextEntry
              autoCapitalize="none"
            />
            <Button title={loading ? 'Entrando…' : 'Entrar'} onPress={() => void unlock()} />
          </View>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Text style={styles.section}>Frota compartilhada</Text>
              <TouchableOpacity onPress={() => void refresh()} style={styles.refreshBtn}>
                {loading ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sub}>Denúncias ({reports.length})</Text>
            {reports.length === 0 ? (
              <Text style={styles.empty}>Nenhuma denúncia na frota ainda.</Text>
            ) : (
              reports.map((r) => (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {conductCategoryLabel(r.category)} · {r.status}
                  </Text>
                  <Text style={styles.meta}>
                    Pedido {r.orderId} · {r.driverName || '—'} ({r.driverId || '—'})
                  </Text>
                  <Text style={styles.meta}>
                    Cliente {r.reporterName} ·{' '}
                    {new Date(r.createdAt).toLocaleString('pt-BR')}
                  </Text>
                  <Text style={styles.body}>{r.description}</Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={() => void markReport(r.id, 'em_analise')}
                    >
                      <Text style={styles.chipText}>Em análise</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={() => void markReport(r.id, 'encerrado')}
                    >
                      <Text style={styles.chipText}>Encerrar</Text>
                    </TouchableOpacity>
                    {r.driverId ? (
                      <TouchableOpacity
                        style={[styles.chip, styles.chipDanger]}
                        onPress={() => {
                          const d = drivers.find((x) => x.fleetId === r.driverId) || {
                            fleetId: r.driverId!,
                            applicationId: r.driverId!,
                            name: r.driverName || 'Entregador',
                            phone: '',
                            online: false,
                            lastSeenAt: new Date().toISOString(),
                          };
                          void blockDriver(d);
                        }}
                      >
                        <Text style={[styles.chipText, { color: '#fff' }]}>Bloquear</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sub, { marginTop: 20 }]}>
              Entregadores ({drivers.length})
            </Text>
            {drivers.map((d) => (
              <View key={d.fleetId} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {d.name} {d.blocked ? '· BLOQUEADO' : d.online ? '· online' : '· offline'}
                </Text>
                <Text style={styles.meta}>{d.fleetId}</Text>
                {d.blockedReason ? (
                  <Text style={styles.body}>{d.blockedReason}</Text>
                ) : null}
                <View style={styles.row}>
                  {d.blocked ? (
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={() => void unblockDriver(d)}
                    >
                      <Text style={styles.chipText}>Desbloquear</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.chip, styles.chipDanger]}
                      onPress={() => void blockDriver(d)}
                    >
                      <Text style={[styles.chipText, { color: '#fff' }]}>Bloquear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },
  lockCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  lockHint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  pin: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  section: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  refreshBtn: { padding: 8 },
  sub: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  empty: { color: theme.colors.textMuted, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  body: { fontSize: 13, color: theme.colors.text, lineHeight: 18, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipDanger: { backgroundColor: theme.colors.error },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
});
