import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import { driverFleetId } from '@/utils/driverOps';
import {
  buildLeagueSnapshot,
  LEAGUE_MILESTONES,
  type LeagueSnapshot,
} from '@/utils/driverLeague';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';

const GOLD = '#FBBF24';
const ACCENT = '#7C3AED';

function medal(rank: number): keyof typeof Ionicons.glyphMap {
  if (rank === 1) return 'trophy';
  if (rank === 2) return 'medal';
  if (rank === 3) return 'ribbon';
  return 'ellipse';
}

function medalColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return '#94A3B8';
  if (rank === 3) return '#D97706';
  return theme.colors.textMuted;
}

export default function DriverLeagueScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [league, setLeague] = useState<LeagueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        setLoading(true);
        const app = await resolveDriverApplication(user?.email);
        const fleetId =
          app?.status === 'approved' ? driverFleetId(app) : null;
        const snap = await buildLeagueSnapshot(orders, fleetId);
        if (alive) {
          setLeague(snap);
          setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [user?.email, orders])
  );

  if (loading || !league) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Liga da Semana" fallbackHref="/driver" />
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  const me = league.me;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Liga da Semana" fallbackHref="/driver" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="trophy" size={28} color={GOLD} />
          <Text style={styles.heroTitle}>Campeonato semanal</Text>
          <Text style={styles.heroSub}>
            {league.weekLabel} · fecha em {league.daysLeft} dia
            {league.daysLeft === 1 ? '' : 's'}
          </Text>
          <Text style={styles.heroMotto}>{league.motivational}</Text>
        </View>

        <View style={styles.myCard}>
          <Text style={styles.myRank}>
            Sua posição · #{me?.rank ?? '—'}
          </Text>
          <Text style={styles.myPts}>{me?.points ?? 0} pontos</Text>
          <View style={styles.myStats}>
            <View style={styles.myStat}>
              <Text style={styles.myStatVal}>{me?.deliveries ?? 0}</Text>
              <Text style={styles.myStatLbl}>entregas</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatVal}>{me?.fastDeliveries ?? 0}</Text>
              <Text style={styles.myStatLbl}>rápidas</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatVal}>{me?.activeDays ?? 0}</Text>
              <Text style={styles.myStatLbl}>dias ativos</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatVal}>
                {formatPrice(me?.earnings ?? 0)}
              </Text>
              <Text style={styles.myStatLbl}>frete</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Como pontuar</Text>
        <View style={styles.rules}>
          <Text style={styles.rule}>+12 pts por entrega concluída</Text>
          <Text style={styles.rule}>+1 pt por R$ de frete</Text>
          <Text style={styles.rule}>+8 pts se entregar em até 55 min</Text>
          <Text style={styles.rule}>+5 pts por dia ativo na semana</Text>
          <Text style={[styles.rule, styles.rulePenalty]}>
            Avaliação do cliente: 5★ 0 · 4★ −3 · 3★ −8 · 2★ −15 · 1★ −22
          </Text>
        </View>

        {me && me.ratingPenalty > 0 ? (
          <View style={styles.penaltyBox}>
            <Ionicons name="trending-down" size={18} color="#DC2626" />
            <Text style={styles.penaltyText}>
              Esta semana: −{me.ratingPenalty} pts por avaliações ruins
              (bruto {me.grossPoints} → líquido {me.points})
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Metas da semana</Text>
        {LEAGUE_MILESTONES.map((m) => {
          const done = (me?.points ?? 0) >= m.pts;
          return (
            <View
              key={m.label}
              style={[styles.milestone, done && styles.milestoneDone]}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={done ? '#059669' : theme.colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.milestoneTitle}>
                  {m.label} · {m.pts} pts
                </Text>
                <Text style={styles.milestoneReward}>{m.reward}</Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.section}>Ranking</Text>
        {league.entries.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum entregador aprovado ainda. Complete entregas para subir.
          </Text>
        ) : (
          league.entries.map((e) => {
            const isMe = me?.fleetId === e.fleetId;
            return (
              <View
                key={e.fleetId}
                style={[styles.row, isMe && styles.rowMe]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    { backgroundColor: medalColor(e.rank) + '33' },
                  ]}
                >
                  <Ionicons
                    name={medal(e.rank)}
                    size={16}
                    color={medalColor(e.rank)}
                  />
                  <Text style={[styles.rankNum, { color: medalColor(e.rank) }]}>
                    {e.rank}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>
                    {e.name}
                    {isMe ? ' (você)' : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    {e.deliveries} entregas · {e.fastDeliveries} rápidas ·{' '}
                    {e.vehicle}
                  </Text>
                </View>
                <Text style={styles.rowPts}>{e.points}</Text>
              </View>
            );
          })
        )}

        <Text style={styles.footnote}>
          A liga não muda a fila justa das corridas. É só motivação e metas —
          quem entrega bem sobe no ranking.
        </Text>
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    backgroundColor: '#2E1065',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  heroTitle: { color: '#fff', fontWeight: '900', fontSize: 20 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  heroMotto: {
    color: '#FDE68A',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  myCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  myRank: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 12 },
  myPts: {
    color: ACCENT,
    fontWeight: '900',
    fontSize: 28,
    marginTop: 2,
    marginBottom: 12,
  },
  myStats: { flexDirection: 'row', flexWrap: 'wrap' },
  myStat: { width: '25%', alignItems: 'center' },
  myStatVal: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },
  myStatLbl: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  section: {
    fontWeight: '800',
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 8,
    marginTop: 4,
  },
  rules: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  rule: { color: '#5B21B6', fontSize: 13, fontWeight: '600' },
  rulePenalty: { color: '#B91C1C', marginTop: 4 },
  penaltyBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  penaltyText: { flex: 1, color: '#991B1B', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  milestoneDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  milestoneTitle: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },
  milestoneReward: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  rowMe: {
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  rankNum: { fontWeight: '900', fontSize: 13 },
  rowName: { fontWeight: '800', color: theme.colors.text, fontSize: 15 },
  rowSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  rowPts: { fontWeight: '900', color: ACCENT, fontSize: 16 },
  empty: { color: theme.colors.textMuted, marginBottom: 12 },
  footnote: {
    marginTop: 12,
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
