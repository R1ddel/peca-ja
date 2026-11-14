/**
 * Clientes — Command Center (web).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListCustomers } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminCustomersScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminListCustomers(token, {
        q: (search ?? q).trim() || undefined,
        limit: 100,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar clientes.');
        setRows([]);
        return;
      }
      setRows(((res as any).customers || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Clientes" lead={`${rows.length} resultados · toque para ficha`} />
      <View style={hqStyles.row}>
        <TextInput
          style={[hqStyles.input, { flex: 1, minWidth: 200 }]}
          placeholder="Buscar nome, e-mail, telefone…"
          placeholderTextColor={hq.faint}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load(q)}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void load(q)}>
          <Text style={hqStyles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>
      <ErrBox message={err} />
      {rows.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhum cliente encontrado.</Text>
      ) : (
        rows.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={hqStyles.card}
            onPress={() => router.push(`/admin/customers/${c.id}` as any)}
          >
            <Text style={hqStyles.tableCell}>
              {c.name} {c.blocked ? '· BLOQUEADO' : ''}
            </Text>
            <Text style={hqStyles.lead}>
              {c.email} · {c.ordersCount || 0} pedidos · GMV {formatPrice(c.gmv || 0)}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}
