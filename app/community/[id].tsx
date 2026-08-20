import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { FadeInUp } from '@/components/FadeInUp';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import {
  buildCommunityFeed,
  getCommunityMemberById,
  getMemberTier,
} from '@/data/community';
import {
  buildClientOfTheWeek,
  countUserOrdersThisWeek,
} from '@/data/clientOfTheWeek';
import { calcPointsFromOrders, LOYALTY_TIERS } from '@/constants/loyalty';
import { theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { myOrders } = useOrders();
  const [photoOpen, setPhotoOpen] = useState(false);

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

  const member = useMemo(() => {
    if (!id) return undefined;
    if (id.startsWith('me-') && user) {
      return members.find((m) => m.isCurrentUser);
    }
    return getCommunityMemberById(id) ?? members.find((m) => m.id === id);
  }, [id, user, members]);

  const isWeekChampion = !!member && member.id === weekState.champion?.memberId;

  if (!member) {
    return (
      <View style={styles.screen}>
        <BackHeader title="Perfil" fallbackHref="/community" />
        <View style={styles.notFound}>
          <Ionicons name="person-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.notFoundText}>Usuário não encontrado</Text>
          <TouchableOpacity onPress={() => router.replace('/community' as any)} activeOpacity={0.85}>
            <Text style={styles.link}>Voltar à comunidade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tier = LOYALTY_TIERS[getMemberTier(member)];

  return (
    <View style={styles.screen}>
      <BackHeader
        title={member.isCurrentUser ? 'Seu perfil público' : member.name}
        fallbackHref="/community"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInUp delay={40}>
          <View style={styles.headerCard}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => member.photoUrl && setPhotoOpen(true)}
              disabled={!member.photoUrl}
            >
              {member.photoUrl ? (
                <Image source={{ uri: member.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{member.name.charAt(0)}</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.name}>{member.name}</Text>
            <Text style={styles.city}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />{' '}
              {member.city}
            </Text>

            <View style={[styles.tierBadge, { backgroundColor: tier.color + '22' }]}>
              <Ionicons name={tier.icon as keyof typeof Ionicons.glyphMap} size={16} color={tier.color} />
              <Text style={[styles.tierText, { color: tier.color }]}>Nível {tier.label}</Text>
            </View>

            {isWeekChampion && (
              <View style={styles.weekCrown}>
                <Ionicons name="trophy" size={16} color="#7C5C00" />
                <Text style={styles.weekCrownText}>Cliente da Semana</Text>
              </View>
            )}

            {member.isCurrentUser && (
              <TouchableOpacity
                style={styles.editPublic}
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.85}
              >
                <Text style={styles.editPublicText}>Editar meu perfil</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeInUp>

        <FadeInUp delay={100}>
          <View style={styles.bioCard}>
            <Text style={styles.sectionLabel}>Sobre</Text>
            <Text style={styles.bio}>{member.bio}</Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={140}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{member.memberSince.slice(0, 4)}</Text>
              <Text style={styles.statLabel}>Membro desde</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{member.badges.length}</Text>
              <Text style={styles.statLabel}>Conquistas</Text>
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={180}>
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Categoria favorita</Text>
            <View style={styles.favChip}>
              <Ionicons name="heart" size={16} color={theme.colors.primary} />
              <Text style={styles.favText}>{member.favoriteCategory}</Text>
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={220}>
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Conquistas</Text>
            <View style={styles.badges}>
              {isWeekChampion && (
                <View style={[styles.badge, styles.badgeWeek]}>
                  <Ionicons name="trophy" size={14} color="#7C5C00" />
                  <Text style={[styles.badgeText, styles.badgeWeekText]}>Cliente da Semana</Text>
                </View>
              )}
              {member.badges.map((badge) => (
                <View key={badge} style={styles.badge}>
                  <Ionicons name="ribbon-outline" size={14} color={theme.colors.primaryDark} />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={260}>
          <View style={styles.perkCard}>
            <Text style={styles.perkTitle}>Benefício do nível</Text>
            <Text style={styles.perkText}>{tier.perk}</Text>
          </View>
        </FadeInUp>
      </ScrollView>

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable style={styles.photoOverlay} onPress={() => setPhotoOpen(false)}>
          {member.photoUrl ? (
            <Image source={{ uri: member.photoUrl }} style={styles.photoLarge} />
          ) : null}
          <Text style={styles.photoName}>{member.name}</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  notFoundText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md },
  link: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold, marginTop: theme.spacing.sm },
  headerCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  avatarLetter: { color: theme.colors.white, fontSize: 40, fontWeight: theme.fontWeight.bold },
  name: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  city: { marginTop: 6, color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  tierText: { fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.sm },
  weekCrown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    backgroundColor: '#FFE8A3',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  weekCrownText: {
    color: '#7C5C00',
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  editPublic: { marginTop: theme.spacing.md },
  editPublicText: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  bioCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: theme.spacing.sm,
  },
  bio: { color: theme.colors.text, fontSize: theme.fontSize.md, lineHeight: 22 },
  statsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  statLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: theme.colors.primaryMuted },
  block: { marginTop: theme.spacing.lg },
  favChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  favText: { color: theme.colors.primaryDark, fontWeight: theme.fontWeight.semibold },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  badgeText: { color: theme.colors.text, fontSize: theme.fontSize.sm },
  badgeWeek: {
    backgroundColor: '#FFF8E6',
    borderColor: '#F59E0B',
  },
  badgeWeekText: { color: '#7C5C00', fontWeight: theme.fontWeight.bold },
  perkCard: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  perkTitle: { color: 'rgba(255,255,255,0.7)', fontSize: theme.fontSize.xs },
  perkText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginTop: 4,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,16,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  photoLarge: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: (SCREEN_WIDTH * 0.8) / 2,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  photoName: {
    marginTop: theme.spacing.lg,
    color: theme.colors.white,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
});
