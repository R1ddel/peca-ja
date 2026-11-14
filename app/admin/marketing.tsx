/**
 * Marketing — cupons e campanhas (web).
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
  platformAdminListCampaigns,
  platformAdminListCoupons,
  platformAdminUpsertCampaign,
  platformAdminUpsertCoupon,
} from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminMarketingScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [couponValue, setCouponValue] = useState('');
  const [campName, setCampName] = useState('');
  const [campBody, setCampBody] = useState('');
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
      const [c, camp] = await Promise.all([
        platformAdminListCoupons(token),
        platformAdminListCampaigns(token),
      ]);
      if (!c?.ok) {
        setErr((c as any)?.message || 'Falha ao listar cupons.');
      } else {
        setCoupons(((c as any).coupons || []) as any[]);
      }
      if (camp?.ok) setCampaigns(((camp as any).campaigns || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function createCoupon() {
    const value = Number(couponValue.replace(',', '.'));
    if (!code.trim() || !Number.isFinite(value) || value <= 0) {
      setErr('Código e valor válidos são obrigatórios.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminUpsertCoupon(token, {
      code: code.trim(),
      type: 'percent',
      value,
      active: true,
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao criar cupom.');
      return;
    }
    setMsg('Cupom criado.');
    setCode('');
    setCouponValue('');
    await load();
  }

  async function createCampaign() {
    if (!campName.trim()) {
      setErr('Nome da campanha obrigatório.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminUpsertCampaign(token, {
      name: campName.trim(),
      channel: 'push',
      segment: 'all',
      status: 'draft',
      body: campBody.trim() || campName.trim(),
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao criar campanha.');
      return;
    }
    setMsg('Campanha criada.');
    setCampName('');
    setCampBody('');
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
      <PageHeader title="Marketing" lead="Cupons e campanhas" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Novo cupom</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Código"
          placeholderTextColor={hq.faint}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="% desconto"
          placeholderTextColor={hq.faint}
          keyboardType="decimal-pad"
          value={couponValue}
          onChangeText={setCouponValue}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void createCoupon()}>
          <Text style={hqStyles.btnText}>Criar cupom</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Cupons ({coupons.length})</Text>
      {coupons.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhum cupom.</Text>
      ) : (
        coupons.map((c) => (
          <View key={c.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {c.code} · {c.type} {c.value}
              {c.active === false ? ' · inativo' : ''}
            </Text>
            <Text style={hqStyles.lead}>
              usos {c.usedCount || 0}/{c.maxUses ?? '∞'}
            </Text>
          </View>
        ))
      )}

      <Text style={hqStyles.h2}>Nova campanha</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Nome"
          placeholderTextColor={hq.faint}
          value={campName}
          onChangeText={setCampName}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Mensagem"
          placeholderTextColor={hq.faint}
          value={campBody}
          onChangeText={setCampBody}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void createCampaign()}>
          <Text style={hqStyles.btnText}>Criar rascunho</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Campanhas ({campaigns.length})</Text>
      {campaigns.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhuma campanha.</Text>
      ) : (
        campaigns.map((c) => (
          <View key={c.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {c.name} · {c.status} · {c.channel}
            </Text>
            <Text style={hqStyles.lead}>{c.body || '—'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
