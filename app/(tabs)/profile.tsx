import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ImageBackground,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Tabs, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { FadeInUp } from '@/components/FadeInUp';
import { BackHeader } from '@/components/BackHeader';
import { theme } from '@/constants/theme';
import {
  LOYALTY_TIERS,
  REWARDS,
  calcPointsFromOrders,
  getFavoriteBusiness,
  getNextTier,
  getProgressToNext,
  getTierForPoints,
  getDeliveredOrders,
} from '@/constants/loyalty';
import { getBusinessById } from '@/data/businesses';
import { getBusinessLogoSource } from '@/utils/businessLogos';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useHomeCatalogLayout } from '@/hooks/useHomeCatalogLayout';
import {
  HOME_CATALOG_LAYOUT_LABELS,
  type HomeCatalogLayout,
} from '@/utils/homeCatalogLayout';
import { confirmReloadApp, reloadApp } from '@/utils/reloadApp';
import {
  abandonMerchantApplication,
  isMerchantPanelUnlocked,
  merchantOnboardingGate,
  resolveMerchantApplication,
  type MerchantApplication,
} from '@/utils/partners';
import {
  activateRewardBenefit,
  loadBonusPoints,
  loadRewardsStore,
  saveRewardsStore,
} from '@/utils/rewards';
import {
  DEMO_LOCATIONS,
  DemoLocationId,
  getDemoLocationIdSync,
  hydrateDemoLocation,
  isDemoCityAllowed,
  isSharedPublicWeb,
  setDemoLocation,
} from '@/utils/demoLocation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1000&h=500&q=85';

export default function ProfileScreen() {
  useRequireAuth();
  const { user, logout, updateProfile, cloudAuth } = useAuth();
  const { myOrders } = useOrders();
  const { layout: homeLayout, setHomeCatalogLayout } = useHomeCatalogLayout();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(false);
  /** Alert.alert com botões falha no web / alguns Android — menu próprio. */
  const [photoMenu, setPhotoMenu] = useState<'profile' | 'cover' | null>(null);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [demoLocationId, setDemoLocationId] = useState<DemoLocationId | null>(null);
  const [merchantApp, setMerchantApp] = useState<MerchantApplication | null>(null);
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(0.86)).current;

  const delivered = useMemo(() => getDeliveredOrders(myOrders), [myOrders]);
  const lifetimePoints = useMemo(() => calcPointsFromOrders(myOrders), [myOrders]);
  const tierKey = getTierForPoints(lifetimePoints + bonusPoints);
  const tier = LOYALTY_TIERS[tierKey];
  const nextTier = getNextTier(lifetimePoints + bonusPoints);
  const progress = getProgressToNext(lifetimePoints + bonusPoints);
  const favorite = useMemo(() => getFavoriteBusiness(myOrders), [myOrders]);
  const demoLocationLabel = demoLocationId
    ? DEMO_LOCATIONS[demoLocationId].city
    : 'GPS real';

  const merchantPanelUnlocked = merchantApp ? isMerchantPanelUnlocked(merchantApp) : false;
  const merchantGate = merchantApp ? merchantOnboardingGate(merchantApp) : null;

  function openMerchantFromProfile() {
    if (!merchantApp) return;
    if (merchantPanelUnlocked) {
      router.push('/merchant' as any);
      return;
    }
    const gateHref =
      merchantGate === 'pay'
        ? '/partner/pay'
        : merchantGate === 'terms'
          ? '/partner/terms'
          : '/partner/plans';
    router.push({ pathname: gateHref as any, params: { id: merchantApp.id } });
  }

  function confirmAbandonMerchant() {
    if (!merchantApp || merchantPanelUnlocked) return;
    Alert.alert(
      'Não sou comerciante',
      'Isso remove o rascunho de cadastro da loja neste aparelho. Você continua como cliente normalmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover rascunho',
          style: 'destructive',
          onPress: () => {
            void abandonMerchantApplication(merchantApp.id).then((ok) => {
              if (ok) setMerchantApp(null);
            });
          },
        },
      ]
    );
  }

  useEffect(() => {
    void hydrateDemoLocation().then(() => setDemoLocationId(getDemoLocationIdSync()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void resolveMerchantApplication(user?.email).then((app) => {
        if (alive) setMerchantApp(app);
      });
      return () => {
        alive = false;
      };
    }, [user?.email])
  );

  useEffect(() => {
    (async () => {
      try {
        const store = await loadRewardsStore();
        const bonus = await loadBonusPoints();
        setClaimed(store.claimed);
        setBonusPoints(bonus);
        setAvailablePoints(Math.max(0, lifetimePoints + bonus - store.spentPoints));
      } catch {
        setAvailablePoints(lifetimePoints);
      }
    })();
  }, [lifetimePoints]);

  async function applyDemoLocation(id: DemoLocationId | null) {
    await setDemoLocation(id);
    setDemoLocationId(id);
    // Recarrega na hora: catálogo, GPS e banners são montados no boot
    await reloadApp('demo-location');
  }

  function openDemoLocationPicker() {
    Alert.alert(
      'Simular cidade',
      'Troca GPS, mapas, banners e TODOS os comércios da home.',
      [
        {
          text: 'Vale do Capão',
          onPress: () => {
            void applyDemoLocation('vale-do-capao');
          },
        },
        {
          text: 'Mucugê',
          onPress: () => {
            void applyDemoLocation('mucuge');
          },
        },
        {
          text: 'GPS real (desligar)',
          style: 'destructive',
          onPress: () => {
            void applyDemoLocation(null);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }

  async function persistRewards(nextClaimed: string[], spentPoints: number) {
    await saveRewardsStore({ claimed: nextClaimed, spentPoints });
  }

  async function handleSave() {
    setSaving(true);
    await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      bio: bio.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  }

  function startEditing() {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setBio(user?.bio ?? '');
    setEditing(true);
  }

  function handleLogout() {
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function openPhotoPreview() {
    if (!user?.photoUrl) {
      openPhotoOptions();
      return;
    }
    setPhotoPreview(true);
    previewOpacity.setValue(0);
    previewScale.setValue(0.86);
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(previewScale, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function closePhotoPreview() {
    Animated.timing(previewOpacity, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPhotoPreview(false);
    });
  }

  function openPhotoOptions() {
    setPhotoPreview(false);
    setPhotoMenu('profile');
  }

  async function pickFromGallery() {
    setPhotoMenu(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para continuar.');
      return;
    }

    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // allowsEditing trava o retorno em vários Android/Expo Go
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await updateProfile({ photoUrl: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a foto.');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function pickFromCamera() {
    setPhotoMenu(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o uso da câmera para continuar.');
      return;
    }

    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await updateProfile({ photoUrl: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function removePhoto() {
    setPhotoMenu(null);
    await updateProfile({ photoUrl: null });
  }

  function openCoverOptions() {
    setPhotoMenu('cover');
  }

  async function pickCoverFromGallery() {
    setPhotoMenu(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para continuar.');
      return;
    }

    setCoverLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await updateProfile({ coverUrl: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a capa.');
    } finally {
      setCoverLoading(false);
    }
  }

  async function pickCoverFromCamera() {
    setPhotoMenu(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o uso da câmera para continuar.');
      return;
    }

    setCoverLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await updateProfile({ coverUrl: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível tirar a foto da capa.');
    } finally {
      setCoverLoading(false);
    }
  }

  async function removeCover() {
    setPhotoMenu(null);
    await updateProfile({ coverUrl: null });
  }

  function claimReward(rewardId: string, cost: number, title: string) {
    if (claimed.includes(rewardId)) {
      Alert.alert('Já resgatado', 'Você já pegou essa recompensa.');
      return;
    }
    if (availablePoints < cost) {
      Alert.alert(
        'Pontos insuficientes',
        `Faltam ${cost - availablePoints} pontos para resgatar "${title}".`
      );
      return;
    }

    Alert.alert('Resgatar recompensa', `Usar ${cost} pts em "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resgatar',
        onPress: async () => {
          const nextClaimed = [...claimed, rewardId];
          const spent = lifetimePoints + bonusPoints - (availablePoints - cost);
          setClaimed(nextClaimed);
          setAvailablePoints((p) => p - cost);
          await persistRewards(nextClaimed, spent);
          await activateRewardBenefit(rewardId);
          const tip =
            rewardId === 'frete'
              ? ' Frete grátis será aplicado no próximo pedido (acima de R$ 25).'
              : rewardId === 'desconto10'
                ? ' Desconto de 10% (máx. R$ 15) no próximo pedido.'
                : '';
          Alert.alert('Pronto!', `"${title}" foi adicionada à sua conta.${tip}`);
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Tabs.Screen options={{ headerShown: false }} />
      <BackHeader
        title="Meu perfil"
        subtitle="Gerencie sua conta e pedidos"
        preferFallback
        fallbackHref="/(tabs)"
        variant="brand"
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FadeInUp delay={40}>
        <View style={styles.profileHeader}>
          <View style={styles.coverWrap}>
            <ImageBackground
              source={{ uri: user?.coverUrl || DEFAULT_COVER }}
              style={styles.coverImage}
              imageStyle={styles.coverImageStyle}
            >
              <View style={styles.coverOverlay} />
              <View style={styles.coverLabel}>
                <Ionicons name="leaf" size={14} color={theme.colors.white} />
                <Text style={styles.coverLabelText}>Meu espaço Peça Já</Text>
              </View>

              <TouchableOpacity
                style={styles.coverEditBtn}
                onPress={openCoverOptions}
                activeOpacity={0.85}
                disabled={coverLoading}
              >
                {coverLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={16} color={theme.colors.white} />
                    <Text style={styles.coverEditText}>
                      {user?.coverUrl ? 'Trocar capa' : 'Alterar capa'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ImageBackground>

            <View style={styles.avatarDock} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.avatar, styles.coverAvatar, { borderColor: tier.color }]}
                onPress={openPhotoPreview}
                activeOpacity={0.85}
                disabled={photoLoading}
              >
                {photoLoading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : user?.photoUrl ? (
                  <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color={theme.colors.white} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileIdentity}>
            <TouchableOpacity onPress={openPhotoOptions} activeOpacity={0.7}>
              <Text style={styles.changePhotoText}>
                {user?.photoUrl ? 'Trocar foto' : 'Adicionar foto'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.authPill}>
              <Ionicons
                name={cloudAuth ? 'cloud-done-outline' : 'phone-portrait-outline'}
                size={12}
                color={cloudAuth ? '#065F46' : '#64748B'}
              />
              <Text style={[styles.authPillText, cloudAuth && styles.authPillTextOn]}>
                {cloudAuth ? 'Conta na nuvem' : 'Conta neste aparelho'}
              </Text>
            </View>

            {user?.bio?.trim() ? (
              <Text style={styles.bioPreview}>{user.bio.trim()}</Text>
            ) : (
              <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
                <Text style={styles.bioHint}>Adicionar biografia</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.tierBadge, { backgroundColor: tier.color + '22' }]}>
              <Ionicons name={tier.icon as keyof typeof Ionicons.glyphMap} size={16} color={tier.color} />
              <Text style={[styles.tierText, { color: tier.color }]}>Nível {tier.label}</Text>
            </View>
          </View>
        </View>
      </FadeInUp>

      <FadeInUp delay={100}>
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyTop}>
            <View>
              <Text style={styles.loyaltyLabel}>Clube Peça Já</Text>
              <Text style={styles.loyaltyPoints}>{availablePoints} pts disponíveis</Text>
            </View>
            <View style={styles.lifetimeBox}>
              <Text style={styles.lifetimeNumber}>{lifetimePoints}</Text>
              <Text style={styles.lifetimeLabel}>pts totais</Text>
            </View>
          </View>

          <Text style={styles.perkText}>{tier.perk}</Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: tier.color },
              ]}
            />
          </View>
          <Text style={styles.progressHint}>
            {nextTier
              ? `Faltam ${nextTier.needed} pts para ${LOYALTY_TIERS[nextTier.tier].label}`
              : 'Você chegou ao topo Diamante. Manda ver!'}
          </Text>
        </View>
      </FadeInUp>

      {merchantApp ? (
        <FadeInUp delay={130}>
          <View style={styles.merchantAccess}>
            <View style={styles.merchantAccessTop}>
              <View style={styles.merchantAccessIcon}>
                <Ionicons name="storefront" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchantAccessTitle}>
                  {merchantPanelUnlocked ? 'Painel do comerciante' : 'Cadastrar minha loja'}
                </Text>
                <Text style={styles.merchantAccessSub}>
                  {merchantPanelUnlocked
                    ? 'Pedidos, cardápio, saldo e operação da loja'
                    : merchantGate === 'plan'
                      ? 'Escolha um plano para ativar o comércio'
                      : merchantGate === 'pay'
                        ? 'Assine o plano para liberar o painel'
                        : 'Aceite o termo para concluir o cadastro'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.merchantAccessBtn}
              activeOpacity={0.9}
              onPress={openMerchantFromProfile}
            >
              <Text style={styles.merchantAccessBtnText}>
                {merchantPanelUnlocked ? 'Abrir painel' : 'Continuar cadastro'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#0F766E" />
            </TouchableOpacity>
            {!merchantPanelUnlocked ? (
              <TouchableOpacity
                style={styles.merchantAccessLink}
                activeOpacity={0.85}
                onPress={confirmAbandonMerchant}
              >
                <Text style={styles.merchantAccessLinkText}>Não sou comerciante</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </FadeInUp>
      ) : null}

      <FadeInUp delay={160}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sua atividade</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="receipt-outline" label="Pedidos" value={String(myOrders.length)} />
            <StatCard icon="checkmark-done-outline" label="Entregues" value={String(delivered.length)} />
            <StatCard icon="star-outline" label="Pts disponíveis" value={String(availablePoints)} />
            <StatCard icon="trophy-outline" label="Pts totais" value={String(lifetimePoints)} />
          </View>

          {favorite ? (
            <View style={styles.favoriteCard}>
              <Image
                source={getBusinessLogoSource({
                  name: favorite.name,
                  category:
                    getBusinessById(favorite.id)?.category ?? 'restaurante',
                  image: getBusinessById(favorite.id)?.image ?? favorite.image,
                })}
                style={styles.favoriteImage}
              />
              <View style={styles.favoriteInfo}>
                <Text style={styles.favoriteEyebrow}>Comércio favorito</Text>
                <Text style={styles.favoriteName}>{favorite.name}</Text>
                <Text style={styles.favoriteMeta}>
                  {favorite.count} {favorite.count === 1 ? 'pedido' : 'pedidos'}
                </Text>
              </View>
              <Ionicons name="heart" size={20} color={theme.colors.error} />
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>
                Faça seu primeiro pedido entregue para liberar o painel completo.
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
                <Text style={styles.emptyLink}>Explorar comércios</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </FadeInUp>

      <FadeInUp delay={220}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recompensas</Text>
          <Text style={styles.sectionSub}>Troque pontos por benefícios no app</Text>
          {REWARDS.map((reward) => {
            const done = claimed.includes(reward.id);
            const canClaim = availablePoints >= reward.cost && !done;
            return (
              <TouchableOpacity
                key={reward.id}
                style={[styles.rewardCard, done && styles.rewardCardDone]}
                activeOpacity={0.85}
                onPress={() => claimReward(reward.id, reward.cost, reward.title)}
              >
                <View style={[styles.rewardIcon, done && styles.rewardIconDone]}>
                  <Ionicons
                    name={(done ? 'checkmark' : reward.icon) as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={done ? theme.colors.white : theme.colors.primary}
                  />
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardDesc}>{reward.description}</Text>
                </View>
                <View style={styles.rewardCost}>
                  <Text style={[styles.rewardCostText, canClaim && styles.rewardCostReady]}>
                    {done ? 'OK' : `${reward.cost} pts`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </FadeInUp>

      <FadeInUp delay={280}>
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Comunidade</Text>
            <View style={styles.experimentalPill}>
              <Text style={styles.experimentalPillText}>Experimental</Text>
            </View>
          </View>
          <Text style={styles.sectionSub}>
            Espaço leve para quem pede em {demoLocationLabel === 'GPS real' ? 'sua cidade' : demoLocationLabel}. Ranking e perfis ainda são demonstração —
            o clube de pontos acima é o benefício real.
          </Text>
          <TouchableOpacity
            style={styles.communityTeaser}
            activeOpacity={0.85}
            onPress={() => router.push('/community' as any)}
          >
            <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.communityTeaserText}>Abrir comunidade</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInUp>

      <FadeInUp delay={320}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Meus dados</Text>
            {!editing && (
              <TouchableOpacity onPress={startEditing}>
                <Text style={styles.editLink}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View>
              <Input label="Nome" value={name} onChangeText={setName} icon="person-outline" />
              <Input
                label="Telefone"
                value={phone}
                onChangeText={setPhone}
                icon="call-outline"
                keyboardType="phone-pad"
              />
              <Input label="Endereço" value={address} onChangeText={setAddress} icon="location-outline" />
              <View style={styles.bioField}>
                <Text style={styles.bioLabel}>Biografia</Text>
                <TextInput
                  style={styles.bioInput}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Uma bio curta (opcional)"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  maxLength={160}
                  textAlignVertical="top"
                />
                <Text style={styles.bioCounter}>{bio.length}/160</Text>
              </View>
              <View style={styles.editActions}>
                <Button title="Cancelar" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                <Button title="Salvar" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={styles.infoList}>
              <InfoRow icon="person-outline" label="Nome" value={user?.name ?? ''} />
              <InfoRow icon="mail-outline" label="E-mail" value={user?.email ?? ''} />
              <InfoRow icon="call-outline" label="Telefone" value={user?.phone ?? ''} />
              <InfoRow icon="location-outline" label="Endereço" value={user?.address ?? ''} />
              <InfoRow
                icon="chatbubble-ellipses-outline"
                label="Biografia"
                value={user?.bio?.trim() || 'Ainda não escrita'}
              />
            </View>
          )}
        </View>
      </FadeInUp>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Layout da home</Text>
        <Text style={styles.sectionSub}>
          Vitrine = destaque + categorias (foto de referência). Clássico = layout anterior. A troca
          vale na hora e fica salva neste aparelho.
        </Text>
        <View style={styles.layoutRow}>
          {(['vitrine', 'classic'] as HomeCatalogLayout[]).map((id) => {
            const on = homeLayout === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.layoutChip, on && styles.layoutChipOn]}
                activeOpacity={0.85}
                onPress={() => void setHomeCatalogLayout(id)}
              >
                <Ionicons
                  name={id === 'vitrine' ? 'grid-outline' : 'list-outline'}
                  size={16}
                  color={on ? theme.colors.white : theme.colors.primary}
                />
                <Text style={[styles.layoutChipText, on && styles.layoutChipTextOn]}>
                  {id === 'vitrine' ? 'Vitrine' : 'Clássico'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.layoutHint}>{HOME_CATALOG_LAYOUT_LABELS[homeLayout]}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <MenuItem
          icon="heart-outline"
          label="Favoritos"
          onPress={() => router.push('/favorites' as any)}
        />
        <MenuItem icon="receipt-outline" label="Meus pedidos" onPress={() => router.push('/(tabs)/orders')} />
        <MenuItem
          icon="location-outline"
          label="Endereços salvos"
          onPress={() => router.push('/addresses' as any)}
        />
        <MenuItem icon="card-outline" label="Meus cartões" onPress={() => router.push('/cards' as any)} />
        <MenuItem
          icon="shield-checkmark-outline"
          label="Permissões"
          onPress={() => router.push('/permissions' as any)}
        />
        <MenuItem icon="camera-outline" label="Alterar foto de perfil" onPress={openPhotoOptions} />
        <MenuItem icon="image-outline" label="Alterar foto de capa" onPress={openCoverOptions} />
        <MenuItem
          icon="help-circle-outline"
          label="Ajuda e suporte · até 24h"
          onPress={() => router.push('/support' as any)}
        />
        <MenuItem
          icon="refresh-outline"
          label="Recarregar app"
          onPress={confirmReloadApp}
        />
      </View>

      {isDemoCityAllowed() && !isSharedPublicWeb() && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demo de cidade</Text>
          <MenuItem
            icon="map-outline"
            label={`Simular: ${demoLocationLabel}`}
            onPress={openDemoLocationPicker}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parcerias</Text>
        <Text style={styles.sectionSub}>
          Quer entregar ou cadastrar um comércio? Escolha abaixo. Se você só pede pelo app, pode ignorar esta seção.
        </Text>
        <MenuItem
          icon="briefcase-outline"
          label="Seja parceiro comerciante"
          onPress={() => router.push('/partner' as any)}
        />
        <MenuItem
          icon="bicycle-outline"
          label="Entregador Peça Já"
          onPress={() => router.push('/driver' as any)}
        />
        <MenuItem
          icon="person-add-outline"
          label="Pedir acesso à equipe da loja"
          onPress={() => router.push('/merchant/staff/request-access' as any)}
        />
        {__DEV__ && (
          <>
            <MenuItem
              icon="navigate-outline"
              label="Teste GPS"
              onPress={() => router.push('/test-gps' as any)}
            />
            <MenuItem
              icon="shield-outline"
              label="Área interna (suporte)"
              onPress={() => router.push('/support/tickets' as any)}
            />
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Peça Já · Clube de fidelidade v1</Text>

      <Modal
        visible={photoMenu != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoMenu(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPhotoMenu(null)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>
              {photoMenu === 'cover' ? 'Foto de capa' : 'Foto de perfil'}
            </Text>
            <TouchableOpacity
              style={styles.sheetBtn}
              onPress={() =>
                void (photoMenu === 'cover' ? pickCoverFromGallery() : pickFromGallery())
              }
            >
              <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.sheetBtnText}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetBtn}
              onPress={() =>
                void (photoMenu === 'cover' ? pickCoverFromCamera() : pickFromCamera())
              }
            >
              <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.sheetBtnText}>Câmera</Text>
            </TouchableOpacity>
            {photoMenu === 'profile' && user?.photoUrl ? (
              <TouchableOpacity style={styles.sheetBtnDanger} onPress={() => void removePhoto()}>
                <Text style={styles.sheetBtnDangerText}>Remover foto</Text>
              </TouchableOpacity>
            ) : null}
            {photoMenu === 'cover' && user?.coverUrl ? (
              <TouchableOpacity style={styles.sheetBtnDanger} onPress={() => void removeCover()}>
                <Text style={styles.sheetBtnDangerText}>Usar capa padrão</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setPhotoMenu(null)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={photoPreview}
        transparent
        animationType="none"
        onRequestClose={closePhotoPreview}
      >
        <Animated.View style={[styles.previewOverlay, { opacity: previewOpacity }]}>
          <Pressable style={styles.previewBackdrop} onPress={closePhotoPreview} />

          <Animated.View style={[styles.previewContent, { transform: [{ scale: previewScale }] }]}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.previewImage} />
            ) : null}
            <Text style={styles.previewName}>{user?.name}</Text>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => {
                  closePhotoPreview();
                  setTimeout(openPhotoOptions, 200);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="camera-outline" size={18} color={theme.colors.white} />
                <Text style={styles.previewBtnText}>Trocar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnClose]}
                onPress={closePhotoPreview}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={18} color={theme.colors.text} />
                <Text style={styles.previewBtnCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={22} color={theme.colors.textSecondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxl },
  profileHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  coverWrap: {
    width: '100%',
    height: 190,
    marginBottom: 48,
    overflow: 'visible',
    zIndex: 2,
  },
  avatarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -48,
    alignItems: 'center',
    zIndex: 5,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  coverImageStyle: {
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 55, 40, 0.35)',
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  coverLabel: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  coverLabelText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  coverEditBtn: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 44,
    minHeight: 34,
    justifyContent: 'center',
  },
  coverEditText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  profileIdentity: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  coverAvatar: {
    marginBottom: 0,
    backgroundColor: theme.colors.primary,
    borderWidth: 4,
    elevation: 6,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 36, fontWeight: theme.fontWeight.bold, color: theme.colors.white },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  changePhotoText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  name: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  email: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 4 },
  authPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  authPillText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  authPillTextOn: { color: '#065F46' },
  bioPreview: {
    marginTop: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  bioHint: {
    marginTop: theme.spacing.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
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
  loyaltyCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  merchantAccess: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: '#0F766E',
    gap: 12,
  },
  merchantAccessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  merchantAccessIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantAccessTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: theme.fontWeight.extrabold,
  },
  merchantAccessSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  merchantAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 14,
  },
  merchantAccessBtnText: {
    color: '#0F766E',
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 16,
  },
  merchantAccessLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  merchantAccessLinkText: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: theme.fontWeight.semibold,
    fontSize: 14,
  },
  loyaltyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loyaltyLabel: { color: 'rgba(255,255,255,0.7)', fontSize: theme.fontSize.sm },
  loyaltyPoints: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: 4,
  },
  lifetimeBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  lifetimeNumber: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
  },
  lifetimeLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2 },
  perkText: { color: theme.colors.primaryMuted, marginTop: theme.spacing.md, fontSize: theme.fontSize.sm },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.sm,
  },
  section: { padding: theme.spacing.md, marginTop: theme.spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  experimentalPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  experimentalPillText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: '#B45309',
  },
  sectionSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  layoutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  layoutChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  layoutChipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  layoutChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  layoutChipTextOn: {
    color: theme.colors.white,
  },
  layoutHint: {
    marginTop: 10,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    gap: 4,
  },
  statValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: 4,
  },
  statLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  favoriteImage: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  favoriteInfo: { flex: 1 },
  favoriteEyebrow: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  favoriteName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  favoriteMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  emptyActivity: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  emptyActivityText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
  emptyLink: {
    marginTop: theme.spacing.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  rewardCardDone: {
    borderColor: theme.colors.primaryMuted,
    backgroundColor: theme.colors.primaryLight,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardIconDone: { backgroundColor: theme.colors.primary },
  rewardInfo: { flex: 1 },
  rewardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  rewardDesc: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  rewardCost: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  rewardCostText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
  },
  rewardCostReady: { color: theme.colors.primary },
  communityTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  communityTeaserText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  leaderboard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  leaderRowYou: { backgroundColor: theme.colors.primaryLight },
  leaderRank: {
    width: 28,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leaderAvatarImage: { width: '100%', height: '100%' },
  leaderAvatarText: { color: theme.colors.white, fontWeight: theme.fontWeight.bold },
  leaderInfo: { flex: 1 },
  leaderName: { fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  leaderPts: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  editLink: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  infoList: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: 'hidden' },
  bioField: { marginBottom: theme.spacing.md },
  bioLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  bioInput: {
    minHeight: 96,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  bioCounter: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  infoValue: { fontSize: theme.fontSize.md, color: theme.colors.text, marginTop: 2 },
  editActions: { flexDirection: 'row', gap: theme.spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.soft,
  },
  menuLabel: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.text },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.radius.lg,
  },
  logoutText: {
    color: theme.colors.error,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  version: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.sm,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
  sheetBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  sheetBtnDanger: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetBtnDangerText: {
    color: theme.colors.error,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  sheetCancel: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.semibold,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 16, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    alignItems: 'center',
    zIndex: 2,
  },
  previewImage: {
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.78,
    borderRadius: (SCREEN_WIDTH * 0.78) / 2,
    borderWidth: 4,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.borderLight,
  },
  previewName: {
    marginTop: theme.spacing.lg,
    color: theme.colors.white,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
  previewActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  previewBtnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  previewBtnClose: {
    backgroundColor: theme.colors.white,
  },
  previewBtnCloseText: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
});
