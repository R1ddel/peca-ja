/**
 * Ficha do cliente — bloquear / desbloquear (web).
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminCustomerDetail, platformAdminSetUserBlock } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, KpiCard, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminCustomerDetailScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminCustomerDetail(token, String(id));
      if (!res?.ok) {
        setErr((res as any)?.message || 'Cliente não encontrado.');
        setDetail(null);
        return;
      }
      setDetail(res);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function toggleBlock() {
    const user = detail?.user;
    if (!user) return;
    const block = !user.blocked;
    if (block && reason.trim().length < 3) {
      setErr('Informe o motivo do bloqueio (mín. 3 caracteres).');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminSetUserBlock(token, user.id, block, reason.trim() || undefined);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao atualizar bloqueio.');
        return;
      }
      setMsg(block ? 'Cliente bloqueado.' : 'Cliente desbloqueado.');
      setReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const user = detail?.user;
  const metrics = detail?.metrics || {};

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader
        title={user?.name || 'Cliente'}
        lead={user ? `${user.email} · ${user.id}` : 'Carregando…'}
      />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      {!user && !loading ? <Text style={hqStyles.empty}>Cliente não encontrado.</Text> : null}

      {user ? (
        <>
          <View style={hqStyles.row}>
            <KpiCard label="Pedidos" value={metrics.ordersCount || 0} />
            <KpiCard label="GMV" value={formatPrice(metrics.gmv || 0)} tone="green" />
            <KpiCard label="Ticket médio" value={formatPrice(metrics.ticketAvg || 0)} />
            <KpiCard label="Cancelados" value={metrics.canceled || 0} tone="red" />
          </View>

          <Text style={hqStyles.h2}>Contato</Text>
          <View style={hqStyles.card}>
            <Text style={hqStyles.lead}>
              Tel: {user.phone || '—'} · Endereço: {user.address || '—'}
              {user.blocked ? `\nBloqueado: ${user.blockedReason || '—'}` : ''}
            </Text>
          </View>

          <Text style={hqStyles.h2}>{user.blocked ? 'Desbloquear' : 'Bloquear'}</Text>
          <TextInput
            style={hqStyles.input}
            placeholder="Motivo (obrigatório para bloquear)"
            placeholderTextColor={hq.faint}
            value={reason}
            onChangeText={setReason}
          />
          <TouchableOpacity
            style={[hqStyles.btn, { marginTop: 8, opacity: busy ? 0.6 : 1 }]}
            disabled={busy}
            onPress={() => void toggleBlock()}
          >
            <Text style={hqStyles.btnText}>
              {user.blocked ? 'Confirmar desbloqueio' : 'Confirmar bloqueio'}
            </Text>
          </TouchableOpacity>

          <Text style={hqStyles.h2}>Pedidos recentes</Text>
          {(detail?.recentOrders || []).length === 0 ? (
            <Text style={hqStyles.empty}>Sem pedidos.</Text>
          ) : (
            (detail.recentOrders as any[]).slice(0, 20).map((o) => (
              <View key={o.id} style={hqStyles.card}>
                <Text style={hqStyles.tableCell}>
                  {o.businessName} · {o.status} · {formatPrice(o.total || 0)}
                </Text>
                <Text style={hqStyles.lead}>{o.createdAt}</Text>
              </View>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
