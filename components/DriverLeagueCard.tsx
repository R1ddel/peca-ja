import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { LeagueSnapshot } from '@/utils/driverLeague';

const GOLD = '#FBBF24';
const SILVER = '#E2E8F0';
const BRONZE = '#D97706';

type Props = {
  league: LeagueSnapshot | null;
  loading?: boolean;
};

function medalColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return '#A78BFA';
}

/**
 * Card da Liga Semanal no painel do motoboy.
 */
export function DriverLeagueCard({ league, loading }: Props) {
  if (loading || !league) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <Text style={styles.loadingText}>Carregando Liga da Semana…</Text>
      </View>
    );
  }

  const me = league.me;
  const top = league.entries.slice(0, 3);
  const progress = Math.round((league.milestoneProgress || 0) * 100);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => router.push('/driver/league' as any)}
    >
      <View style={styles.glow} />

      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={18} color={GOLD} />
          </View>
          <View>
            <Text style={styles.title}>Liga da Semana</Text>
            <Text style={styles.week}>
              {league.weekLabel} · {league.daysLeft}d restantes
            </Text>
          </View>
        </View>
        <View style={styles.rankPill}>
          <Text style={styles.rankPillText}>
            {me ? `#${me.rank}` : '—'}
          </Text>
        </View>
      </View>

      {/* Mini pódio: 2º | 1º | 3º */}
      <View style={styles.podium}>
        {[2, 1, 3].map((rank) => {
          const entry = top[rank - 1];
          const barH = rank === 1 ? 70 : rank === 2 ? 54 : 42;
          return (
            <View key={rank} style={styles.podCol}>
              <Text style={styles.podName} numberOfLines={1}>
                {entry?.name ?? '—'}
              </Text>
              <Text style={[styles.podPts, { color: medalColor(rank) }]}>
                {entry ? `${entry.points} pts` : '0'}
              </Text>
              <View
                style={[
                  styles.podBar,
                  {
                    height: barH,
                    backgroundColor:
                      rank === 1
                        ? 'rgba(251,191,36,0.35)'
                        : rank === 2
                          ? 'rgba(226,232,240,0.28)'
                          : 'rgba(217,119,6,0.32)',
                    borderColor: medalColor(rank),
                  },
                ]}
              >
                <Text style={styles.podRank}>#{rank}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Sua meta */}
      <View style={styles.meBox}>
        <View style={styles.meRow}>
          <Text style={styles.meLabel}>Seus pontos</Text>
          <Text style={styles.mePts}>{me?.points ?? 0} pts</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.milestone}>
          {league.nextMilestone
            ? `Próximo: ${league.nextMilestone.label} (${league.nextMilestone.pts} pts) · ${league.nextMilestone.reward}`
            : 'Você atingiu Lenda da semana 🔥'}
        </Text>
      </View>

      <Text style={styles.motto} numberOfLines={2}>
        {league.motivational}
      </Text>

      <View style={styles.footer}>
        <View style={styles.statChip}>
          <Ionicons name="bicycle" size={13} color="#C4B5FD" />
          <Text style={styles.statChipText}>
            {me?.deliveries ?? 0} entregas
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="flash" size={13} color="#FDE68A" />
          <Text style={styles.statChipText}>
            {me?.fastDeliveries ?? 0} rápidas
          </Text>
        </View>
        <Text style={styles.seeAll}>Ver ranking</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#2E1065',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  cardLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  glow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  trophyWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  week: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  rankPill: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
  },
  rankPillText: { color: GOLD, fontWeight: '900', fontSize: 15 },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    minHeight: 110,
  },
  podCol: { flex: 1, alignItems: 'center', gap: 4 },
  podName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    maxWidth: '100%',
  },
  podPts: { fontSize: 11, fontWeight: '700' },
  podBar: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  podRank: { color: '#fff', fontWeight: '900', fontSize: 14 },
  meBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  meRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  meLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  mePts: { color: '#FDE68A', fontWeight: '900', fontSize: 15 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  milestone: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  motto: {
    color: '#E9D5FF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  seeAll: {
    marginLeft: 'auto',
    color: GOLD,
    fontWeight: '800',
    fontSize: 12,
  },
});
