/**
 * HQ — cadastros: aceitar ou recusar motoboy e ver o plano mensal de cada loja.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminListApplications,
  platformAdminListShops,
  platformAdminSetApplicationStatus,
} from '@/services/platformClient';
import { MERCHANT_PLANS, formatPlanPrice, type MerchantPlan } from '@/constants/plans';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

type AppRow = {
  id: string;
  role: string;
  status: string;
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  city?: string;
  raw?: { vehicle?: string; termsStatus?: string };
};

type ShopRow = {
  businessId: string;
  name: string;
  city?: string;
  plan?: string;
  planPaidUntil?: string | null;
  suspended?: boolean;
  isOpen?: boolean;
};

function planLine(plan?: string): string {
  if (plan === 'essencial' || plan === 'crescimento' || plan === 'destaque') {
    const def = MERCHANT_PLANS[plan as MerchantPlan];
    return `${def.label} · ${formatPlanPrice(def.monthlyPrice)}/mês`;
  }
  return 'Sem plano';
}

function paidLine(until?: string | null): string {
  if (!until) return 'Mensalidade em aberto';
  const time = new Date(until).getTime();
  if (!Number.isFinite(time)) return 'Mensalidade em aberto';
  const when = new Date(until).toLocaleDateString('pt-BR');
  return time < Date.now() ? `Venceu em ${when}` : `Pago até ${when}`;
}

function driverStatus(status: string): string {
  if (status === 'approved') return 'Aceito';
  if (status === 'rejected') return 'Recusado';
  return 'Em análise';
}

export default function AdminCrmScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const [appsRes, shopsRes] = await Promise.all([
        platformAdminListApplications(token),
        platformAdminListShops(token),
      ]);
      if (!appsRes?.ok) {
        setErr((appsRes as any)?.message || 'Falha ao listar cadastros.');
        return;
      }
      setApps(((appsRes as any).applications || []) as AppRow[]);
      if (shopsRes?.ok) setShops(((shopsRes as any).shops || []) as ShopRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  const drivers = useMemo(() => apps.filter((a) => a.role === 'driver'), [apps]);
  const waiting = drivers.filter((a) => a.status !== 'approved' && a.status !== 'rejected');
  const decided = drivers.filter((a) => a.status === 'approved' || a.status === 'rejected');

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    setErr('');
    setMsg('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminSetApplicationStatus(token, id, status);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao atualizar o cadastro.');
        return;
      }
      setMsg(
        status === 'approved'
          ? 'Motoboy aceito. O painel libera na próxima vez que ele abrir o app.'
          : 'Cadastro recusado. O painel continua bloqueado.'
      );
      await load();
    } finally {
      setBusyId('');
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
      <PageHeader
        title="Cadastros"
        lead="Aceitar ou recusar motoboy e acompanhar o plano mensal de cada loja."
      />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Motoboys em análise</Text>
      {waiting.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>
          Nenhum motoboy aguardando. O nome aparece aqui depois que ele assina o termo e abre o app.
        </Text>
      ) : (
        waiting.map((a) => (
          <View key={a.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>{a.name || a.email || 'Motoboy'}</Text>
            <Text style={hqStyles.lead}>
              {a.phone || 'sem telefone'} · {a.city || 'sem cidade'}
              {a.raw?.vehicle ? ` · ${a.raw.vehicle}` : ''}
            </Text>
            <Text style={hqStyles.lead}>{a.email}</Text>
            <View style={[hqStyles.row, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[hqStyles.btn, { opacity: busyId === a.id ? 0.5 : 1 }]}
                disabled={busyId === a.id}
                onPress={() => void decide(a.id, 'approved')}
              >
                <Text style={hqStyles.btnText}>Aceitar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[hqStyles.btnGhost, { opacity: busyId === a.id ? 0.5 : 1 }]}
                disabled={busyId === a.id}
                onPress={() => void decide(a.id, 'rejected')}
              >
                <Text style={[hqStyles.btnGhostText, { color: hq.red }]}>Recusar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={hqStyles.h2}>Motoboys já decididos</Text>
      {decided.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhuma decisão ainda.</Text>
      ) : (
        decided.map((a) => (
          <View key={a.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {a.name || a.email} · {driverStatus(a.status)}
            </Text>
            <Text style={hqStyles.lead}>
              {a.phone || '—'} · {a.city || '—'} · {a.email}
            </Text>
            <View style={[hqStyles.row, { marginTop: 10 }]}>
              {a.status !== 'approved' ? (
                <TouchableOpacity
                  style={hqStyles.btn}
                  disabled={busyId === a.id}
                  onPress={() => void decide(a.id, 'approved')}
                >
                  <Text style={hqStyles.btnText}>Aceitar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={hqStyles.btnGhost}
                  disabled={busyId === a.id}
                  onPress={() => void decide(a.id, 'rejected')}
                >
                  <Text style={[hqStyles.btnGhostText, { color: hq.red }]}>Recusar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      <Text style={hqStyles.h2}>Planos mensais</Text>
      {shops.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhuma loja na rede ainda.</Text>
      ) : (
        shops.map((shop) => (
          <View key={shop.businessId} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>{shop.name}</Text>
            <Text style={hqStyles.lead}>
              {planLine(shop.plan)} · {paidLine(shop.planPaidUntil)}
            </Text>
            <Text style={hqStyles.lead}>
              {shop.city || '—'}
              {shop.suspended ? ' · suspensa' : shop.isOpen ? ' · aberta' : ' · fechada'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
