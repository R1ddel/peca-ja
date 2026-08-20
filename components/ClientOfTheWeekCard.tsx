import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ClientOfTheWeekState,
  getCountdownParts,
  rankHint,
} from '@/data/clientOfTheWeek';
import { activateClientOfTheWeekPerks } from '@/utils/rewards';
import { theme } from '@/constants/theme';

const CLAIM_PREFIX = '@pecaja_weekly_claim_';

type Props = {
  state: ClientOfTheWeekState;
  /** Se o usuário logado é o campeão da semana. */
  canClaim: boolean;
};

export function ClientOfTheWeekCard({ state, canClaim }: Props) {
  const { champion, podium, yourRank, weekLabel, endsAt, reward, weekKey } = state;
  const [claimed, setClaimed] = useState(false);
  const [tick, setTick] = useState(() => getCountdownParts(endsAt));
  const crownPulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    AsyncStorage.getItem(CLAIM_PREFIX + weekKey).then((v) => {
      if (v === '1') setClaimed(true);
    });
  }, [weekKey]);

  useEffect(() => {
    const id = setInterval(() => setTick(getCountdownParts(endsAt)), 30000);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(crownPulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(crownPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    glowLoop.start();
    return () => {
      pulse.stop();
      glowLoop.stop();
    };
  }, [crownPulse, glow]);

  async function claimReward() {
    if (!canClaim || claimed) return;
    Alert.alert(
      'Resgatar Coroa da Semana',
      `${reward.perks.join('\n')}\n\nConfirmar resgate?`,
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Resgatar',
          onPress: async () => {
            await AsyncStorage.setItem(CLAIM_PREFIX + weekKey, '1');
            await activateClientOfTheWeekPerks(reward.bonusPoints);
            setClaimed(true);
            Alert.alert(
              'Coroa resgatada!',
              `Frete grátis liberado no próximo pedido e +${reward.bonusPoints} pts creditados no clube.`
            );
          },
        },
      ]
    );
  }

  if (!champion) return null;

  const isYouChampion = !!champion.isCurrentUser;
  const hint = rankHint(yourRank, isYouChampion);

  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        <Animated.View style={[styles.glowOrb, { opacity: glow }]} />

        <View style={styles.bannerTop}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AO VIVO · {weekLabel}</Text>
          </View>
          <Text style={styles.countdown}>
            {tick.days}d {tick.hours}h {String(tick.minutes).padStart(2, '0')}m
          </Text>
        </View>

        <Text style={styles.kicker}>{reward.tagline}</Text>
        <Text style={styles.title}>Cliente da Semana</Text>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/community/${champion.memberId}` as any)}
          style={styles.championBlock}
        >
          <Animated.View style={{ transform: [{ scale: crownPulse }] }}>
            <View style={styles.crownCircle}>
              <Ionicons name="sparkles" size={16} color="#7C5C00" />
              <Ionicons name="trophy" size={22} color="#F59E0B" />
            </View>
          </Animated.View>

          {champion.photoUrl ? (
            <Image source={{ uri: champion.photoUrl }} style={styles.championPhoto} />
          ) : (
            <View style={[styles.championPhoto, styles.championFallback]}>
              <Text style={styles.championLetter}>{champion.name.charAt(0)}</Text>
            </View>
          )}

          <Text style={styles.championName} numberOfLines={1}>
            {champion.name}
            {champion.isCurrentUser ? ' (você)' : ''}
          </Text>
          <Text style={styles.championCity}>{champion.city}</Text>
          <View style={styles.crownBadge}>
            <Ionicons name="ribbon" size={14} color="#7C5C00" />
            <Text style={styles.crownBadgeText}>Trono da semana</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.podium}>
          {podium.map((p) => (
            <TouchableOpacity
              key={p.memberId}
              style={[styles.podiumSlot, p.rank === 1 && styles.podiumFirst]}
              activeOpacity={0.85}
              onPress={() => router.push(`/community/${p.memberId}` as any)}
            >
              <View
                style={[
                  styles.medal,
                  p.rank === 1 && styles.medalGold,
                  p.rank === 2 && styles.medalSilver,
                  p.rank === 3 && styles.medalBronze,
                ]}
              >
                <Text style={styles.medalText}>{p.rank}º</Text>
              </View>
              {p.photoUrl ? (
                <Image source={{ uri: p.photoUrl }} style={styles.podiumPhoto} />
              ) : (
                <View style={[styles.podiumPhoto, styles.championFallback]}>
                  <Text style={styles.podiumLetter}>{p.name.charAt(0)}</Text>
                </View>
              )}
              <Text style={styles.podiumName} numberOfLines={1}>
                {p.isCurrentUser ? 'Você' : p.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rewardBox}>
          <Text style={styles.rewardTitle}>{reward.title}</Text>
          {reward.perks.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.accent} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        <View style={styles.hintBox}>
          <Ionicons
            name={isYouChampion ? 'flame' : 'flash-outline'}
            size={16}
            color={theme.colors.accent}
          />
          <Text style={styles.hintText}>{hint}</Text>
        </View>

        {canClaim && (
          <TouchableOpacity
            style={[styles.claimBtn, claimed && styles.claimBtnDone]}
            activeOpacity={0.9}
            disabled={claimed}
            onPress={claimReward}
          >
            <Ionicons
              name={claimed ? 'checkmark-done' : 'gift-outline'}
              size={18}
              color={claimed ? theme.colors.primaryDark : theme.colors.secondary}
            />
            <Text style={[styles.claimText, claimed && styles.claimTextDone]}>
              {claimed ? 'Recompensa resgatada' : 'Resgatar minha coroa'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.lg },
  banner: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2F5244',
  },
  glowOrb: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.accent,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 0.4,
  },
  countdown: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
  },
  kicker: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: theme.fontSize.sm,
    marginBottom: 4,
  },
  title: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.extrabold,
    marginBottom: theme.spacing.md,
  },
  championBlock: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  crownCircle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE8A3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.sm,
  },
  championPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.borderLight,
  },
  championFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  championLetter: {
    color: theme.colors.white,
    fontSize: 36,
    fontWeight: theme.fontWeight.bold,
  },
  championName: {
    marginTop: theme.spacing.sm,
    color: theme.colors.white,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
  championCity: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  crownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    backgroundColor: '#FFE8A3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  crownBadgeText: {
    color: '#7C5C00',
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.xs,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 4,
  },
  podiumFirst: {
    backgroundColor: 'rgba(255,184,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.45)',
  },
  medal: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    marginBottom: 6,
  },
  medalGold: { backgroundColor: '#F59E0B' },
  medalSilver: { backgroundColor: '#94A3B8' },
  medalBronze: { backgroundColor: '#CD7F32' },
  medalText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  podiumPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.borderLight,
  },
  podiumLetter: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
  },
  podiumName: {
    marginTop: 6,
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
  },
  rewardBox: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rewardTitle: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.sm,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  perkText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: theme.fontSize.sm,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  hintText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    marginTop: theme.spacing.xs,
  },
  claimBtnDone: {
    backgroundColor: theme.colors.primaryLight,
  },
  claimText: {
    color: theme.colors.secondary,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  claimTextDone: {
    color: theme.colors.primaryDark,
  },
});
