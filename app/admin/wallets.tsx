/**
 * Carteiras / ajuste de ledger (web).
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
import { platformAdminLedgerAdjust, platformAdminLedgerList } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

type OwnerType = 'merchant' | 'driver' | 'platform';
type Kind = 'credit' | 'debit' | 'adjust';

export default function AdminWalletsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [ownerType, setOwnerType] = useState<OwnerType>('merchant');
  const [ownerId, setOwnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('adjust');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [ledger, setLedger] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminLedgerList(token, {
        ownerType: filterType || undefined,
        limit: 100,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar ledger.');
        return;
      }
      setLedger(((res as any).ledger || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function submitAdjust() {
    const amt = Number(amount.replace(',', '.'));
    if (!ownerId.trim()) {
      setErr('Informe ownerId.');
      return;
    }
    if (!Number.isFinite(amt) || amt === 0) {
      setErr('Valor inválido.');
      return;
    }
    if (reason.trim().length < 3) {
      setErr('Motivo obrigatório (mín. 3 caracteres).');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminLedgerAdjust(token, {
        ownerType,
        ownerId: ownerId.trim(),
        amount: amt,
        kind,
        note: note.trim() || reason.trim(),
        reason: reason.trim(),
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha no ajuste.');
        return;
      }
      setMsg('Ajuste registrado.');
      setAmount('');
      setNote('');
      setReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Carteiras" lead="Extrato e ajuste manual de ledger (motivo obrigatório)" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Novo ajuste</Text>
      <View style={hqStyles.card}>
        <Text style={hqStyles.kpiLabel}>Tipo de dono</Text>
        <View style={[hqStyles.row, { marginBottom: 8 }]}>
          {(['merchant', 'driver', 'platform'] as OwnerType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[hqStyles.btnGhost, ownerType === t && { borderColor: hq.green }]}
              onPress={() => setOwnerType(t)}
            >
              <Text style={hqStyles.btnGhostText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="ownerId (ex.: businessId, fleetId, pecaja)"
          placeholderTextColor={hq.faint}
          value={ownerId}
          onChangeText={setOwnerId}
        />
        <View style={[hqStyles.row, { marginBottom: 8 }]}>
          {(['credit', 'debit', 'adjust'] as Kind[]).map((k) => (
            <TouchableOpacity
              key={k}
              style={[hqStyles.btnGhost, kind === k && { borderColor: hq.green }]}
              onPress={() => setKind(k)}
            >
              <Text style={hqStyles.btnGhostText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Valor (R$)"
          placeholderTextColor={hq.faint}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Nota"
          placeholderTextColor={hq.faint}
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Motivo (obrigatório)"
          placeholderTextColor={hq.faint}
          value={reason}
          onChangeText={setReason}
        />
        <TouchableOpacity
          style={[hqStyles.btn, { opacity: busy ? 0.6 : 1 }]}
          disabled={busy}
          onPress={() => void submitAdjust()}
        >
          <Text style={hqStyles.btnText}>Registrar ajuste</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Filtro do extrato</Text>
      <View style={hqStyles.row}>
        {['', 'merchant', 'driver', 'platform'].map((t) => (
          <TouchableOpacity
            key={t || 'all'}
            style={[hqStyles.btnGhost, filterType === t && { borderColor: hq.green }]}
            onPress={() => setFilterType(t)}
          >
            <Text style={hqStyles.btnGhostText}>{t || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={hqStyles.h2}>Lançamentos</Text>
      {ledger.length === 0 ? (
        <Text style={hqStyles.empty}>Sem lançamentos.</Text>
      ) : (
        ledger.map((e) => (
          <View key={e.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {e.kind} · {e.ownerType}/{e.ownerId} · {formatPrice(e.amount || 0)}
            </Text>
            <Text style={hqStyles.lead}>
              {e.note || '—'} · {e.createdAt}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
