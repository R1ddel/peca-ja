import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminOverview } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';

type Overview = {
  today: { count: number; gmv: number; platformFee: number; delivered: number };
  week7d: { count: number; gmv: number; platformFee: number; delivered: number };
  shopsActive: number;
  shopsSuspended: number;
  shopsTotal: number;
  openTickets: number;
  usersTotal: number;
};

const EMPTY: Overview = {
  today: { count: 0, gmv: 0, platformFee: 0, delivered: 0 },
  week7d: { count: 0, gmv: 0, platformFee: 0, delivered: 0 },
  shopsActive: 0,
  shopsSuspended: 0,
  shopsTotal: 0,
  openTickets: 0,
  usersTotal: 0,
};

export default function AdminOverviewScreen() {
  const { ok, isLoading: gateLoading, role } = useAdminGate();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        setData(EMPTY);
        return;
      }
      const res = await platformAdminOverview(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Não foi possível carregar os números.');
        setData(EMPTY);
        return;
      }
      setData(((res as any).overview as Overview) || EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (gateLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={hq.green} />
      </View>
    );
  }
  if (!ok) return null;

  const d = data || EMPTY;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View>
        <Text style={hqStyles.h1}>Overview</Text>
        <Text style={hqStyles.lead}>
          {role === 'ceo' ? 'Visão CEO' : 'Visão Ops'} · números reais do Postgres
        </Text>
      </View>

      {err ? (
        <View style={hqStyles.errBox}>
          <Text style={hqStyles.errText}>{err}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Hoje</Text>
      <View style={hqStyles.row}>
        <Kpi label="Pedidos pagos" value={String(d.today.count)} tone="green" />
        <Kpi label="GMV" value={formatPrice(d.today.gmv)} tone="blue" />
        <Kpi label="Taxa Peça Já" value={formatPrice(d.today.platformFee)} tone="amber" />
        <Kpi label="Entregues" value={String(d.today.delivered)} />
      </View>

      <Text style={hqStyles.h2}>Últimos 7 dias</Text>
      <View style={hqStyles.row}>
        <Kpi label="Pedidos" value={String(d.week7d.count)} />
        <Kpi label="GMV" value={formatPrice(d.week7d.gmv)} />
        <Kpi label="Taxa" value={formatPrice(d.week7d.platformFee)} />
        <Kpi label="Entregues" value={String(d.week7d.delivered)} />
      </View>

      <Text style={hqStyles.h2}>Rede</Text>
      <View style={hqStyles.row}>
        <Kpi label="Lojas ativas" value={String(d.shopsActive)} tone="green" />
        <Kpi label="Suspensas" value={String(d.shopsSuspended)} tone="red" />
        <Kpi label="Tickets abertos" value={String(d.openTickets)} tone="amber" />
        <Kpi label="Usuários" value={String(d.usersTotal)} />
      </View>

      <Text style={hqStyles.h2}>Atalhos</Text>
      <View style={hqStyles.row}>
        <Shortcut label="Lojas" onPress={() => router.push('/admin/shops' as any)} />
        <Shortcut label="Pedidos" onPress={() => router.push('/admin/orders' as any)} />
        <Shortcut label="Tickets" onPress={() => router.push('/admin/tickets' as any)} />
        <Shortcut label="Frota" onPress={() => router.push('/admin/fleet' as any)} />
        {role === 'ceo' ? (
          <Shortcut label="Equipe" onPress={() => router.push('/admin/team' as any)} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'blue' | 'amber' | 'red';
}) {
  const accent =
    tone === 'green'
      ? hq.green
      : tone === 'blue'
        ? hq.blue
        : tone === 'amber'
          ? hq.amber
          : tone === 'red'
            ? hq.red
            : hq.text;
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLbl}>{label}</Text>
      <Text style={[styles.kpiVal, { color: accent }]}>{value}</Text>
    </View>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress}>
      <Text style={styles.shortcutText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kpi: {
    backgroundColor: hq.panel,
    borderRadius: hq.radius,
    padding: 16,
    minWidth: 148,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: hq.line,
  },
  kpiLbl: { color: hq.muted, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  kpiVal: { color: hq.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  shortcut: {
    backgroundColor: hq.panel2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: hq.line,
  },
  shortcutText: { color: hq.text, fontWeight: '700' },
});
