import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListShops } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';

type Row = {
  businessId: string;
  name: string;
  category: string;
  city: string;
  suspended: boolean;
  isOpen: boolean;
  metrics: { ordersPaid: number; gmv: number; ordersCanceled: number };
  ledgerBalance: number;
};

export default function AdminShopsScreen() {
  const { ok, isLoading: gateLoading } = useAdminGate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminListShops(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar lojas.');
        setRows([]);
        return;
      }
      setRows(((res as any).shops || []) as Row[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.city.toLowerCase().includes(s) ||
        r.businessId.toLowerCase().includes(s)
    );
  }, [rows, q]);

  if (gateLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={hq.green} />
      </View>
    );
  }
  if (!ok) return null;

  return (
    <View style={hqStyles.screen}>
      <Text style={hqStyles.h1}>Lojas</Text>
      <Text style={[hqStyles.lead, { marginBottom: 12 }]}>
        {rows.length} na rede · toque para ficha, vendas e suspensão
      </Text>
      <TextInput
        style={[hqStyles.input, { marginBottom: 12 }]}
        placeholder="Buscar nome, cidade ou id…"
        placeholderTextColor={hq.faint}
        value={q}
        onChangeText={setQ}
      />
      {err ? (
        <View style={[hqStyles.errBox, { marginBottom: 12 }]}>
          <Text style={hqStyles.errText}>{err}</Text>
        </View>
      ) : null}
      {loading && rows.length === 0 ? <ActivityIndicator color={hq.green} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.businessId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          !loading ? <Text style={hqStyles.empty}>Nenhuma loja encontrada.</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/admin/shops/${item.businessId}` as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.city || '—'} · {item.category} · {formatPrice(item.metrics?.gmv || 0)} GMV
              </Text>
            </View>
            <View
              style={[
                hqStyles.pill,
                {
                  backgroundColor: item.suspended
                    ? hq.redDim
                    : item.isOpen
                      ? hq.greenDim
                      : hq.panel2,
                },
              ]}
            >
              <Text
                style={[
                  hqStyles.pillText,
                  {
                    color: item.suspended ? hq.red : item.isOpen ? hq.green : hq.muted,
                  },
                ]}
              >
                {item.suspended ? 'Suspensa' : item.isOpen ? 'Aberta' : 'Fechada'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: hq.panel,
    borderRadius: hq.radius,
    borderWidth: 1,
    borderColor: hq.line,
    padding: 14,
    marginBottom: 10,
  },
  name: { color: hq.text, fontWeight: '800', fontSize: 15 },
  meta: { color: hq.muted, fontSize: 12, marginTop: 4 },
});
