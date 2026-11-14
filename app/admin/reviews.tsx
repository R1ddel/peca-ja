/**
 * Avaliações — moderação (web).
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
  platformAdminListReviews,
  platformAdminModerateReview,
} from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminReviewsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [reviews, setReviews] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminListReviews(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar avaliações.');
        return;
      }
      setReviews(((res as any).reviews || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function moderate(id: string, hidden: boolean) {
    if (hidden && reason.trim().length < 3) {
      setErr('Motivo obrigatório para ocultar.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminModerateReview(token, id, hidden, reason.trim() || undefined);
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha na moderação.');
      return;
    }
    setMsg(hidden ? 'Avaliação ocultada.' : 'Avaliação restaurada.');
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
      <PageHeader title="Avaliações" lead="Moderar reviews da rede" />
      <TextInput
        style={hqStyles.input}
        placeholder="Motivo (obrigatório para ocultar)"
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

      {reviews.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhuma avaliação.</Text>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              ★ {r.rating ?? '—'} · {r.businessName || r.businessId || '—'}
              {r.hidden ? ' · OCULTA' : ''}
            </Text>
            <Text style={hqStyles.lead}>
              {r.comment || r.text || '—'} · {r.createdAt}
            </Text>
            <View style={[hqStyles.row, { marginTop: 8 }]}>
              {!r.hidden ? (
                <TouchableOpacity style={hqStyles.btnGhost} onPress={() => void moderate(r.id, true)}>
                  <Text style={hqStyles.btnGhostText}>Ocultar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={hqStyles.btnGhost}
                  onPress={() => void moderate(r.id, false)}
                >
                  <Text style={hqStyles.btnGhostText}>Restaurar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
