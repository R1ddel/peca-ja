import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { FadeInUp } from '@/components/FadeInUp';
import { ClientOfTheWeekCard } from '@/components/ClientOfTheWeekCard';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { buildCommunityFeed, getMemberTier } from '@/data/community';
import {
  buildClientOfTheWeek,
  countUserOrdersThisWeek,
} from '@/data/clientOfTheWeek';
import { calcPointsFromOrders, LOYALTY_TIERS } from '@/constants/loyalty';
import { theme } from '@/constants/theme';

export default function CommunityScreen() {
  const { user } = useAuth();
  const { myOrders } = useOrders();
  const [query, setQuery] = useState('');

  const points = useMemo(() => calcPointsFromOrders(myOrders), [myOrders]);
  const userWeeklyOrders = useMemo(
    () => countUserOrdersThisWeek(myOrders, user?.id),
    [myOrders, user?.id]
  );

  const members = useMemo(
    () =>
      buildCommunityFeed(
        user
          ? {
              id: user.id,
              name: user.name,
              photoUrl: user.photoUrl,
              points,
              ordersCount: myOrders.length,
              city: user.address?.split(',').slice(-2).join(',').trim() || 'Brasil',
              bio: user.bio,
            }
          : undefined
      ),
    [user, points, myOrders.length]
  );

  const weekState = useMemo(
    () => buildClientOfTheWeek(members, userWeeklyOrders),
    [members, userWeeklyOrders]
  );

  const championId = weekState.champion?.memberId;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.favoriteCategory.toLowerCase().includes(q) ||
        m.badges.some((b) => b.toLowerCase().includes(q))
    );
  }, [members, query]);

  return (
    <View style={styles.screen}>
      <BackHeader title="Comunidade" fallbackHref="/(tabs)/profile" variant="brand" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInUp delay={20}>
          <View style={styles.experimentalBanner}>
            <Ionicons name="flask-outline" size={18} color="#B45309" />
            <Text style={styles.experimentalBannerText}>
              Recurso experimental — ranking e perfis são demonstração. Pontos e benefícios reais ficam no
              Clube Peça Já, no Perfil.
            </Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={40}>
          <ClientOfTheWeekCard
            state={weekState}
            canClaim={!!weekState.champion?.isCurrentUser}
          />
        </FadeInUp>

        <FadeInUp delay={80}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Comunidade Peça Já</Text>
            <Text style={styles.heroSub}>
              Espaço experimental — ranking e perfis ainda são demonstração. O clube de pontos no
              Perfil é o benefício real.
            </Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={120}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, cidade ou badge..."
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </FadeInUp>

        <FadeInUp delay={140}>
          <Text style={styles.count}>{filtered.length} pessoas na comunidade</Text>
        </FadeInUp>

        {filtered.map((member, index) => {
          const tier = LOYALTY_TIERS[getMemberTier(member)];
          const isChampion = member.id === championId;
          return (
            <FadeInUp key={member.id} delay={Math.min(index, 8) * 40}>
              <TouchableOpacity
                style={[
                  styles.card,
                  member.isCurrentUser && styles.cardYou,
                  isChampion && styles.cardChampion,
                ]}
                activeOpacity={0.85}
                onPress={() => router.push(`/community/${member.id}` as any)}
              >
                <View>
                  {member.photoUrl ? (
                    <Image source={{ uri: member.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>{member.name.charAt(0)}</Text>
                    </View>
                  )}
                  {isChampion && (
                    <View style={styles.crownMini}>
                      <Ionicons name="trophy" size={12} color="#7C5C00" />
                    </View>
                  )}
                </View>

                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {member.name}
                      {member.isCurrentUser ? ' (você)' : ''}
                    </Text>
                    {isChampion ? (
                      <View style={styles.weekPill}>
                        <Text style={styles.weekPillText}>Da semana</Text>
                      </View>
                    ) : (
                      <View style={[styles.tierPill, { backgroundColor: tier.color + '22' }]}>
                        <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.city} numberOfLines={1}>
                    {member.city}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {member.favoriteCategory}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </FadeInUp>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md },
  experimentalBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: '#FFF8EB',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  experimentalBannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  hero: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  heroTitle: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
  heroSub: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.md },
  count: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardYou: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  cardChampion: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFF8E6',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.borderLight,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  avatarLetter: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
  },
  crownMini: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFE8A3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  tierText: { fontSize: 10, fontWeight: theme.fontWeight.bold },
  weekPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: '#FFE8A3',
  },
  weekPillText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#7C5C00',
  },
  city: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  meta: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 4 },
});
