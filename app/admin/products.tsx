/**
 * Produtos — busca e bloqueio de disponibilidade (web).
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
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminListProducts,
  platformAdminSetProductAvailable,
} from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminProductsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
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
      const res = await platformAdminListProducts(token, {
        q: (search ?? q).trim() || undefined,
        limit: 100,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar produtos.');
        return;
      }
      setRows(((res as any).products || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function setAvailable(p: any, available: boolean) {
    if (reason.trim().length < 3) {
      setErr('Motivo obrigatório.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminSetProductAvailable(
      token,
      p.businessId,
      p.productId,
      available,
      reason.trim()
    );
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao atualizar produto.');
      return;
    }
    setMsg(available ? 'Produto liberado.' : 'Produto bloqueado.');
    await load();
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Produtos" lead="Busca no cardápio da rede · bloquear com motivo" />
      <View style={hqStyles.row}>
        <TextInput
          style={[hqStyles.input, { flex: 1, minWidth: 180 }]}
          placeholder="Buscar produto ou loja…"
          placeholderTextColor={hq.faint}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load(q)}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void load(q)}>
          <Text style={hqStyles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={hqStyles.input}
        placeholder="Motivo (obrigatório para bloquear/liberar)"
        placeholderTextColor={hq.faint}
        value={reason}
        onChangeText={setReason}
      />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      {rows.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhum produto.</Text>
      ) : (
        rows.map((p) => (
          <View key={`${p.businessId}:${p.productId}`} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {p.name} · {formatPrice(p.price || 0)}
              {p.available === false ? ' · OFF' : ''}
            </Text>
            <Text style={hqStyles.lead}>
              {p.businessName} · {p.category} · {p.productId}
            </Text>
            <View style={[hqStyles.row, { marginTop: 8 }]}>
              <TouchableOpacity
                style={hqStyles.btnGhost}
                onPress={() => void setAvailable(p, false)}
              >
                <Text style={hqStyles.btnGhostText}>Bloquear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={hqStyles.btnGhost}
                onPress={() => void setAvailable(p, true)}
              >
                <Text style={hqStyles.btnGhostText}>Liberar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
