import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { useAuth } from '@/context/AuthContext';
import { resolveActiveMerchantContext } from '@/utils/merchantStores';
import { STAFF_ROLE_LABEL } from '@/utils/merchantTeam';
import {
  buildPunchReport,
  listTodayPunches,
  punchKindOf,
  PunchReportRow,
  StaffPunch,
} from '@/utils/merchantPunch';
import { formatOrderDateTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

/**
 * Relatório de ponto — entradas, saídas e minutos aproximados.
 */
export default function MerchantPunchesScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [report, setReport] = useState<PunchReportRow[]>([]);
  const [today, setToday] = useState<StaffPunch[]>([]);
  const [tab, setTab] = useState<'resumo' | 'hoje'>('resumo');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { shop } = await resolveActiveMerchantContext(user?.email);
      if (!shop) {
        setBusinessId(null);
        setReport([]);
        setToday([]);
        return;
      }
      setBusinessId(shop.businessId);
      setShopName(shop.name);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      setReport(await buildPunchReport(shop.businessId, start.getTime()));
      setToday(await listTodayPunches(shop.businessId));
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const totalMinutes = useMemo(
    () => report.reduce((acc, r) => acc + r.minutesWorkedApprox, 0),
    [report]
  );

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Relatório de ponto" fallbackHref="/merchant" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : !businessId ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nenhuma loja ativa.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.shop}>{shopName}</Text>
          <Text style={styles.sub}>
            Hoje · ~{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min registrados
          </Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'resumo' && styles.tabOn]}
              onPress={() => setTab('resumo')}
            >
              <Text style={[styles.tabText, tab === 'resumo' && styles.tabTextOn]}>Resumo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'hoje' && styles.tabOn]}
              onPress={() => setTab('hoje')}
            >
              <Text style={[styles.tabText, tab === 'hoje' && styles.tabTextOn]}>Linha do tempo</Text>
            </TouchableOpacity>
          </View>

          {tab === 'resumo' ? (
            report.length === 0 ? (
              <Text style={styles.muted}>Sem pontos hoje.</Text>
            ) : (
              report.map((r) => (
                <View key={r.memberId} style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.memberName}</Text>
                    <Text style={styles.meta}>
                      {STAFF_ROLE_LABEL[r.role]} · {r.entries} entrada(s) · {r.exits} saída(s)
                      {r.open ? ' · em turno' : ''}
                    </Text>
                  </View>
                  <Text style={styles.mins}>
                    {Math.floor(r.minutesWorkedApprox / 60)}h{String(r.minutesWorkedApprox % 60).padStart(2, '0')}
                  </Text>
                </View>
              ))
            )
          ) : today.length === 0 ? (
            <Text style={styles.muted}>Sem pontos hoje.</Text>
          ) : (
            today.map((p) => {
              const isIn = punchKindOf(p) === 'in';
              return (
                <View key={p.id} style={styles.row}>
                  <Ionicons
                    name={isIn ? 'log-in-outline' : 'log-out-outline'}
                    size={18}
                    color={isIn ? theme.colors.primary : '#DC2626'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {p.memberName} · {isIn ? 'Entrada' : 'Saída'}
                    </Text>
                    <Text style={styles.meta}>
                      {STAFF_ROLE_LABEL[p.role]} · {formatOrderDateTime(p.punchedAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.auditLink}
            onPress={() => router.push('/merchant/audit' as any)}
          >
            <Ionicons name="list-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.auditLinkText}>Ver auditoria do painel</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  shop: { fontSize: 20, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  tabTextOn: { color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  name: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  mins: { fontWeight: theme.fontWeight.extrabold, color: theme.colors.primary },
  muted: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },
  auditLink: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  auditLinkText: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
});
