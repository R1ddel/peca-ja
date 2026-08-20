import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminShopDetail,
  platformAdminSetShopStatus,
} from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

export default function AdminShopDetailScreen() {
  const { ok, role } = useAdminGate();
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminShopDetail(token, String(businessId));
      if (!res?.ok) {
        setErr((res as any)?.message || 'Loja não encontrada.');
        setDetail(null);
        return;
      }
      setDetail(res);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function setStatus(status: 'active' | 'suspended') {
    if (role !== 'ceo') {
      Alert.alert('Permissão', 'Só o CEO pode suspender/reativar lojas.');
      return;
    }
    setBusy(true);
    try {
      const token = await getPlatformToken();
      if (!token || !businessId) return;
      const res = await platformAdminSetShopStatus(
        token,
        String(businessId),
        status,
        reason || undefined
      );
      if (!res?.ok) {
        Alert.alert('Erro', (res as any)?.message || 'Falha.');
        return;
      }
      await load();
      Alert.alert('OK', status === 'suspended' ? 'Loja suspensa.' : 'Loja reativada.');
    } finally {
      setBusy(false);
    }
  }

  if (!ok) return null;
  const shop = detail?.shop;
  const metrics = detail?.metrics;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      {loading && !shop ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {shop ? (
        <>
          <Text style={styles.h1}>{shop.name}</Text>
          <Text style={styles.meta}>
            {shop.category} · {shop.city || '—'} · {shop.businessId}
          </Text>
          <Text style={styles.meta}>
            {shop.suspended
              ? `Suspensa${shop.suspendedReason ? `: ${shop.suspendedReason}` : ''}`
              : shop.isOpen
                ? 'Aberta'
                : 'Fechada'}
          </Text>

          <View style={styles.row}>
            <Stat label="GMV" value={formatPrice(metrics?.gmv || 0)} />
            <Stat label="Pedidos pagos" value={String(metrics?.ordersPaid || 0)} />
            <Stat label="Cancelados" value={String(metrics?.ordersCanceled || 0)} />
            <Stat label="Ledger" value={formatPrice(detail?.ledgerBalance || 0)} />
          </View>

          {role === 'ceo' ? (
            <View style={styles.box}>
              <Text style={styles.h2}>Controle HQ</Text>
              <TextInput
                style={styles.input}
                placeholder="Motivo da suspensão (opcional)"
                placeholderTextColor="#8b949e"
                value={reason}
                onChangeText={setReason}
              />
              {shop.suspended ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnOk]}
                  disabled={busy}
                  onPress={() => void setStatus('active')}
                >
                  <Text style={styles.btnText}>Reativar loja</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger]}
                  disabled={busy}
                  onPress={() => void setStatus('suspended')}
                >
                  <Text style={styles.btnText}>Suspender loja</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <Text style={styles.h2}>Pedidos recentes</Text>
          {(detail?.recentOrders || []).map((o: any) => (
            <View key={o.id} style={styles.line}>
              <Text style={styles.lineTitle}>
                #{o.shopOrderNumber || o.id.slice(-6)} · {o.status}
              </Text>
              <Text style={styles.meta}>
                {formatPrice(o.total)} · {formatOrderTime(o.createdAt)}
              </Text>
            </View>
          ))}

          <Text style={styles.h2}>Ledger recente</Text>
          {(detail?.recentLedger || []).map((e: any) => (
            <View key={e.id} style={styles.line}>
              <Text style={styles.lineTitle}>
                {e.kind} · {formatPrice(e.amount)}
              </Text>
              <Text style={styles.meta}>{e.note}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  h2: { color: '#8b949e', fontWeight: '700', marginTop: 20, marginBottom: 8 },
  meta: { color: '#8b949e', marginTop: 4 },
  err: { color: '#f85149' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 12,
    minWidth: 120,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  statLbl: { color: '#8b949e', fontSize: 11 },
  statVal: { color: '#fff', fontWeight: '800', marginTop: 4 },
  box: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  input: {
    backgroundColor: '#0f1419',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginBottom: 10,
  },
  btn: { padding: 12, borderRadius: 8, alignItems: 'center' },
  btnDanger: { backgroundColor: '#da3633' },
  btnOk: { backgroundColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '800' },
  line: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#21262d' },
  lineTitle: { color: '#fff', fontWeight: '600' },
});
