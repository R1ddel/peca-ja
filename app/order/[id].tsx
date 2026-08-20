import React, { useEffect, useMemo, useState } from 'react';
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
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useOrders } from '@/context/OrdersContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useReviews } from '@/context/ReviewsContext';
import { BackHeader } from '@/components/BackHeader';
import { OrderStatusTracker } from '@/components/OrderStatusTracker';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { CustomerLiveMap } from '@/components/CustomerLiveMap';
import { isCustomerLiveMapOrder } from '@/utils/customerLiveMap';
import { theme, orderStatusConfig } from '@/constants/theme';
import { formatPrice, getBusinessById } from '@/data/businesses';
import { getShopByBusinessId } from '@/utils/merchantShop';
import { getBusinessLogoSource } from '@/utils/businessLogos';
import { formatAddonsLabel, getCustomerLineTotal, makeLineId, normalizeCartItem } from '@/utils/cartLine';
import { pendingLineIssues } from '@/utils/orderLineIssues';
import { formatOrderDateTime } from '@/utils/datetime';
import { CartItem } from '@/types';
import { CancelReasonModal } from '@/components/CancelReasonModal';
import { OrderPersonCard } from '@/components/OrderPersonCard';
import { isWithinOrderCancelWindow } from '@/utils/orderCancelWindow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrder, cancelOrder, removeUnavailableLine, replaceOrderLine } = useOrders();
  const { replaceCart } = useCart();
  const { user } = useAuth();
  const { hasReviewedOrder, addReview } = useReviews();
  const [order, setOrder] = useState(() => {
    const current = getOrder(id ?? '');
    if (current && user?.id && current.userId !== user.id) return undefined;
    return current;
  });
  const [selectedLine, setSelectedLine] = useState<CartItem | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [rateVisible, setRateVisible] = useState(false);
  const [bizRating, setBizRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [comment, setComment] = useState('');
  const [driverComment, setDriverComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const alreadyReviewed = order ? hasReviewedOrder(order.id) : false;
  const canCancel =
    order != null &&
    !order.pickupVerifiedAt &&
    (order.status === 'pendente' ||
      order.status === 'confirmado' ||
      order.status === 'preparando') &&
    isWithinOrderCancelWindow(order.createdAt, nowMs);
  const openIssues = order ? pendingLineIssues(order) : [];

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = getOrder(id ?? '');
      if (updated && user?.id && updated.userId !== user.id) {
        setOrder(undefined);
        return;
      }
      if (updated) setOrder({ ...updated });
      setNowMs(Date.now());
    }, 2000);
    return () => clearInterval(interval);
  }, [id, getOrder, user?.id]);

  useEffect(() => {
    const current = getOrder(id ?? '');
    if (current && user?.id && current.userId !== user.id) {
      setOrder(undefined);
      return;
    }
    setOrder(current);
  }, [id, getOrder, user?.id]);

  useEffect(() => {
    if (order?.status === 'entregue' && !alreadyReviewed) {
      setRateVisible(true);
    }
  }, [order?.status, alreadyReviewed, order?.id]);

  const dishPhotos = useMemo(() => {
    if (!selectedLine) return [];
    const main = selectedLine.item.image;
    const extras =
      order?.businessImage && order.businessImage !== main ? [order.businessImage] : [];
    return [main, ...extras].filter(Boolean);
  }, [selectedLine, order?.businessImage]);

  if (!order) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Pedido" fallbackHref="/(tabs)/orders" />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.notFoundText}>Pedido não encontrado</Text>
        </View>
      </MobileShell>
    );
  }

  const statusConfig = orderStatusConfig[order.status];
  const isActive = order.status !== 'entregue' && order.status !== 'cancelado';

  const openDish = (line: CartItem) => {
    setSelectedLine(line);
    setPhotoIndex(0);
  };

  const closeDish = () => {
    setSelectedLine(null);
    setPhotoIndex(0);
  };

  function handleCancel() {
    setCancelOpen(true);
  }

  async function confirmCancel(reason: string) {
    setCancelOpen(false);
    const result = await cancelOrder(order!.id, { reason, by: 'customer' });
    if (!result.ok) {
      Alert.alert('Não foi possível cancelar', result.error);
      return;
    }
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            status: 'cancelado',
            cancelReason: reason,
            cancelledBy: 'customer',
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
    Alert.alert('Pedido cancelado', 'Seu pedido foi cancelado com sucesso.');
  }

  function handleReorder() {
    const normalized = order.items.map((raw) => normalizeCartItem(raw));
    replaceCart(normalized);
    router.push('/cart');
  }

  async function handleSubmitReview() {
    if (!order) return;
    if (!user) {
      Alert.alert('Login necessário', 'Entre na conta para avaliar o pedido.');
      return;
    }
    setSubmittingReview(true);
    try {
      const result = await addReview({
        businessId: order.businessId,
        orderId: order.id,
        userId: user.id,
        userName: user.name,
        rating: bizRating,
        comment,
        driverRating,
        driverId: order.driverId,
        driverName: order.driverName,
        driverComment: driverComment.trim() || undefined,
      });
      if (!result.success) {
        Alert.alert('Avaliação', result.error ?? 'Não foi possível enviar.');
        return;
      }
      setRateVisible(false);
      setComment('');
      setDriverComment('');
      const penaltyHint =
        driverRating <= 2
          ? '\n\nNota baixa do entregador reduz pontos dele na Liga da Semana.'
          : '';
      Alert.alert(
        'Obrigado!',
        `Avaliação da loja e do entregador registrada.${penaltyHint}`
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  function openReportDriver() {
    if (!order) return;
    setRateVisible(false);
    router.push({
      pathname: '/order/report-driver' as any,
      params: { orderId: order.id },
    });
  }

  function openChat(peer: 'driver' | 'merchant') {
    if (!order) return;
    router.push({
      pathname: '/chat/[orderId]' as any,
      params: { orderId: order.id, peer },
    });
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title={`Pedido #${order.id}`} fallbackHref="/(tabs)/orders" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {order.status === 'cancelado' && (
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.errorLight }]}>
            <Ionicons name="close-circle" size={28} color={theme.colors.error} />
            <View style={styles.statusBannerText}>
              <Text style={[styles.statusTitle, { color: theme.colors.error }]}>
                Pedido cancelado
              </Text>
              <Text style={styles.statusSub}>Este pedido não será entregue.</Text>
            </View>
          </View>
        )}

        {order.status === 'pendente' && !order.paymentConfirmed && (
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.warning + '22' }]}>
            <Ionicons name="card-outline" size={28} color={theme.colors.warning} />
            <View style={styles.statusBannerText}>
              <Text style={[styles.statusTitle, { color: theme.colors.warning }]}>
                Aguardando pagamento
              </Text>
              <Text style={styles.statusSub}>
                O pedido só entra em preparo depois da confirmação do Pix/cartão.
              </Text>
            </View>
          </View>
        )}

        {isActive && order.paymentConfirmed && (
          <View style={[styles.statusBanner, { backgroundColor: statusConfig.color + '15' }]}>
            <Ionicons
              name={statusConfig.icon as keyof typeof Ionicons.glyphMap}
              size={28}
              color={statusConfig.color}
            />
            <View style={styles.statusBannerText}>
              <Text style={[styles.statusTitle, { color: statusConfig.color }]}>
                {order.status === 'preparando' && !order.pickupVerifiedAt
                  ? 'Aguardando liberação da loja'
                  : order.status === 'saiu_entrega' && !order.deliveryVerifiedAt
                    ? 'A caminho — mostre seu código'
                    : statusConfig.label}
              </Text>
              <Text style={styles.statusSub}>
                {order.status === 'preparando' && !order.pickupVerifiedAt
                  ? 'A loja precisa confirmar o código do entregador antes de liberar a saída.'
                  : order.status === 'saiu_entrega' && !order.deliveryVerifiedAt
                    ? 'Na porta, informe o código abaixo ao motoboy'
                    : order.status === 'confirmado'
                      ? 'A loja recebeu seu pedido e vai começar o preparo.'
                      : `Previsão de entrega: ${order.estimatedDelivery}`}
              </Text>
            </View>
          </View>
        )}

        {isActive && order.paymentConfirmed && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Entrega</Text>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>Tempo estimado</Text>
                <Text style={styles.infoValue}>{order.estimatedDelivery}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>Entregar em</Text>
                <Text style={styles.infoValue}>{order.address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>Comércio</Text>
                <Text style={styles.infoValue}>{order.businessName}</Text>
              </View>
            </View>
          </View>
        )}

        {isCustomerLiveMapOrder(order) && (
            <CustomerLiveMap order={order} viewer="customer" />
          )}

        {order.paymentConfirmed && order.status !== 'cancelado' && !!order.deliveryCode && (
          <View style={styles.codeHero}>
            <View style={styles.codeHeroTop}>
              <Ionicons name="shield-checkmark" size={22} color={theme.colors.primary} />
              <Text style={styles.codeHeroTitle}>Seu código de entrega</Text>
            </View>
            <Text style={styles.codeHeroDigits}>{order.deliveryCode}</Text>
            <Text style={styles.codeHeroHint}>
              Informe este código ao entregador. Ele digita no painel dele — só depois disso o
              pedido é marcado como entregue. Você não digita nenhum código neste app.
            </Text>
            {order.deliveryVerifiedAt ? (
              <View style={styles.codeDonePill}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                <Text style={styles.codeDoneText}>Entrega validada</Text>
              </View>
            ) : order.status === 'saiu_entrega' ? (
              <Text style={styles.codeWaiting}>
                Quando o motoboy chegar, diga este código em voz alta (ou mostre a tela)
              </Text>
            ) : (
              <Text style={styles.codeWaiting}>
                Guarde este código para quando o pedido estiver a caminho
              </Text>
            )}
          </View>
        )}

        {order.paymentConfirmed &&
          order.status !== 'cancelado' &&
          order.status !== 'entregue' && (
            <View style={styles.verifyCard}>
              <Text style={styles.cardTitle}>Como funciona a confirmação</Text>
              <Text style={styles.tapHint}>
                Códigos só são digitados no painel do comércio e no do entregador — nunca aqui.
              </Text>

              <View style={styles.verifyStep}>
                <View style={styles.verifyStepHead}>
                  <Ionicons
                    name={order.pickupVerifiedAt ? 'checkmark-circle' : 'storefront-outline'}
                    size={20}
                    color={order.pickupVerifiedAt ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text style={styles.verifyStepTitle}>1. Retirada no comércio</Text>
                </View>
                <Text style={styles.verifyStepText}>
                  O entregador chega na loja e mostra o código do painel dele. O estabelecimento
                  digita esse código no painel da loja. Só então o pedido sai para entrega.
                </Text>
                {order.pickupVerifiedAt ? (
                  <Text style={styles.verifyOk}>Retirada confirmada pela loja</Text>
                ) : order.status === 'preparando' ? (
                  <Text style={styles.verifyWait}>
                    Aguardando o comércio confirmar a retirada no painel deles
                  </Text>
                ) : (
                  <Text style={styles.verifyWait}>Aguardando o pedido ficar pronto…</Text>
                )}
              </View>

              <View style={styles.verifyStep}>
                <View style={styles.verifyStepHead}>
                  <Ionicons
                    name={order.deliveryVerifiedAt ? 'checkmark-circle' : 'bicycle-outline'}
                    size={20}
                    color={
                      order.deliveryVerifiedAt ? theme.colors.primary : theme.colors.textMuted
                    }
                  />
                  <Text style={styles.verifyStepTitle}>2. Entrega a você</Text>
                </View>
                <Text style={styles.verifyStepText}>
                  Você informa o código acima ao motoboy. Ele digita no painel do entregador e só
                  então entrega o pedido.
                </Text>
                {order.deliveryVerifiedAt ? (
                  <Text style={styles.verifyOk}>Entrega confirmada pelo entregador</Text>
                ) : order.status === 'saiu_entrega' ? (
                  <Text style={styles.verifyWait}>
                    Informe seu código ao entregador na porta
                  </Text>
                ) : (
                  <Text style={styles.verifyWait}>Disponível depois da retirada na loja</Text>
                )}
              </View>
            </View>
          )}

        {order.status !== 'cancelado' && (
          <View style={styles.chatSection}>
            <Text style={styles.cardTitle}>Quem está no pedido</Text>
            <Text style={styles.tapHint}>Perfis e conversas do entregador e da loja</Text>

            {!!order.driverName && (
              <OrderPersonCard
                role="driver"
                name={order.driverName}
                bio={order.driverBio}
                photoUrl={order.driverPhotoUrl}
                phone={order.driverPhone}
                meta={order.driverVehicle || undefined}
                onChat={() => openChat('driver')}
                chatLabel="Chat"
              />
            )}

            <TouchableOpacity
              style={styles.chatRow}
              activeOpacity={0.85}
              onPress={() => openChat('merchant')}
            >
              <View style={[styles.courierIcon, styles.merchantIcon]}>
                <Ionicons name="storefront" size={20} color={theme.colors.warning} />
              </View>
              <View style={styles.courierInfo}>
                <Text style={styles.courierLabel}>Comércio</Text>
                <Text style={styles.courierName}>{order.businessName}</Text>
                <Text style={styles.chatHint}>Dúvidas sobre o pedido</Text>
              </View>
              <View style={[styles.chatBtn, styles.chatBtnMerchant]}>
                <Ionicons name="chatbubble-ellipses" size={16} color={theme.colors.white} />
                <Text style={styles.chatBtnText}>Chat</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {order.status === 'entregue' && (
          <View style={styles.deliveredBanner}>
            <Ionicons name="checkmark-circle" size={32} color={theme.colors.primary} />
            <Text style={styles.deliveredTitle}>Pedido entregue!</Text>
            <Text style={styles.deliveredSub}>
              {alreadyReviewed
                ? 'Obrigado pela sua avaliação'
                : 'Esperamos que tenha gostado — avalie o pedido'}
            </Text>
            <Button
              title="Pedir novamente"
              onPress={handleReorder}
              style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}
            />
          </View>
        )}

        {order.status === 'cancelado' && (
          <Button
            title="Pedir novamente"
            onPress={handleReorder}
            style={{ marginBottom: theme.spacing.md }}
          />
        )}

        {order.status !== 'cancelado' && (
          <View style={styles.trackerCard}>
            <Text style={styles.cardTitle}>Acompanhe seu pedido</Text>
            <OrderStatusTracker status={order.status} />
          </View>
        )}

        <View style={styles.businessCard}>
          <Image
            source={getBusinessLogoSource({
              name: order.businessName,
              category: getBusinessById(order.businessId)?.category ?? 'restaurante',
              image: getBusinessById(order.businessId)?.image ?? order.businessImage,
            })}
            style={styles.businessImage}
          />
          <View>
            <Text style={styles.businessName}>{order.businessName}</Text>
            <Text style={styles.orderId}>Pedido #{order.id}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Itens do pedido</Text>
          <Text style={styles.tapHint}>Toque na foto para ver o prato</Text>

          {openIssues.length > 0 && (
            <View style={styles.issueBanner}>
              <Ionicons name="alert-circle" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.issueTitle}>
                  {openIssues.length === 1
                    ? 'Um item está em falta'
                    : `${openIssues.length} itens em falta`}
                </Text>
                <Text style={styles.issueText}>
                  A loja avisou no chat. Troque por outro do cardápio ou remova o item para o
                  pedido continuar.
                </Text>
                <TouchableOpacity
                  style={styles.issueChatBtn}
                  onPress={() => openChat('merchant')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.issueChatText}>Abrir chat com a loja</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {order.items.map((raw) => {
            const line = normalizeCartItem(raw);
            const addonsLabel = formatAddonsLabel(line.selectedAddons);
            const missing = openIssues.find((i) => i.lineId === line.lineId);
            return (
              <View
                key={line.lineId}
                style={[styles.itemBlock, !!missing && styles.itemBlockMissing]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openDish(line)}
                >
                  <View style={styles.itemRow}>
                    <Image source={{ uri: line.item.image }} style={styles.itemThumb} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {line.quantity}x {line.item.name}
                      </Text>
                      {!!missing && (
                        <Text style={styles.missingTag}>Em falta · {missing.reason}</Text>
                      )}
                      {!!addonsLabel && (
                        <Text style={styles.itemAddons} numberOfLines={2}>
                          {addonsLabel}
                        </Text>
                      )}
                      {!!line.note && (
                        <Text style={styles.itemNote} numberOfLines={2}>
                          Obs.: {line.note}
                        </Text>
                      )}
                      <Text style={styles.itemDescPreview} numberOfLines={1}>
                        {line.item.description}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemPrice}>{formatPrice(getCustomerLineTotal(line))}</Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
                {!!missing && (
                  <View style={styles.swapActions}>
                    {missing.suggestedItemId && missing.suggestedItemName ? (
                      <TouchableOpacity
                        style={styles.swapSuggest}
                        activeOpacity={0.85}
                        onPress={() => {
                          void (async () => {
                            const shop = await getShopByBusinessId(order.businessId);
                            const biz = getBusinessById(order.businessId);
                            const item =
                              shop?.menu.find((m) => m.id === missing.suggestedItemId) ||
                              biz?.menu.find((m) => m.id === missing.suggestedItemId);
                            if (!item) {
                              Alert.alert(
                                'Sugestão',
                                'Item sugerido não está mais no cardápio. Escolha outro.'
                              );
                              return;
                            }
                            const newLine: CartItem = {
                              lineId: makeLineId(item.id, [], undefined),
                              item,
                              quantity: line.quantity,
                              businessId: order.businessId,
                              businessName: order.businessName,
                              selectedAddons: [],
                            };
                            const res = replaceOrderLine(order.id, line.lineId, newLine);
                            if (!res.ok) {
                              Alert.alert('Troca', res.error);
                              return;
                            }
                            setOrder({ ...res.order });
                            Alert.alert(
                              'Trocado',
                              `Pedimos “${item.name}” no lugar de “${missing.itemName}”.`
                            );
                          })();
                        }}
                      >
                        <Ionicons name="sparkles" size={16} color="#fff" />
                        <Text style={styles.swapSuggestText} numberOfLines={1}>
                          Aceitar: {missing.suggestedItemName}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.swapPrimary}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: '/order/replace-item' as any,
                          params: { orderId: order.id, lineId: line.lineId },
                        })
                      }
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#fff" />
                      <Text style={styles.swapPrimaryText}>Trocar no cardápio</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.swapSecondary}
                      activeOpacity={0.85}
                      onPress={() => {
                        Alert.alert(
                          'Remover item?',
                          `Remover “${line.item.name}” do pedido? O total será recalculado.`,
                          [
                            { text: 'Não', style: 'cancel' },
                            {
                              text: 'Remover',
                              style: 'destructive',
                              onPress: () => {
                                const res = removeUnavailableLine(order.id, line.lineId);
                                if (!res.ok) {
                                  Alert.alert('Não foi possível', res.error);
                                  return;
                                }
                                setOrder({ ...res.order });
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.swapSecondaryText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.divider} />

          <DetailRow icon="location-outline" label="Endereço" value={order.address} />
          <DetailRow icon="card-outline" label="Pagamento" value={order.paymentMethod} />
          <DetailRow
            icon="calendar-outline"
            label="Data e hora"
            value={formatOrderDateTime(order.createdAt)}
          />

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total pago</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
          {order.platformFee != null && order.deliveryFee > 0 && (
            <Text style={styles.feeHint}>
              Entrega {formatPrice(order.deliveryFee)}
            </Text>
          )}
        </View>

        {canCancel && (
          <Button
            title="Cancelar pedido"
            variant="outline"
            onPress={handleCancel}
            style={{ marginTop: theme.spacing.md, borderColor: theme.colors.error }}
            textStyle={{ color: theme.colors.error }}
          />
        )}

        {(order.status === 'entregue' || order.status === 'cancelado') && (
          <>
            {order.status === 'entregue' && !alreadyReviewed && (
              <Button
                title="Avaliar loja e entregador"
                onPress={() => setRateVisible(true)}
                style={{ marginTop: theme.spacing.md }}
              />
            )}
            {order.status === 'entregue' && (
              <Button
                title="Denunciar conduta do entregador"
                variant="outline"
                onPress={openReportDriver}
                style={{
                  marginTop: theme.spacing.sm,
                  borderColor: '#FECACA',
                }}
                textStyle={{ color: '#DC2626' }}
              />
            )}
            {order.status === 'entregue' && (
              <Button
                title="Explorar outros comércios"
                variant="ghost"
                onPress={() => router.push('/(tabs)')}
                style={{ marginTop: theme.spacing.sm }}
              />
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={rateVisible} transparent animationType="fade" onRequestClose={() => setRateVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRateVisible(false)}>
          <Pressable style={styles.rateCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={styles.rateTitle}>Como foi a entrega?</Text>
              <Text style={styles.rateSub}>
                Após a confirmação do código, avalie a loja e o entregador.
              </Text>

              <Text style={styles.rateSection}>Estabelecimento</Text>
              <Text style={styles.rateBiz}>{order.businessName}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={`b-${star}`} onPress={() => setBizRating(star)} hitSlop={8}>
                    <Ionicons
                      name={star <= bizRating ? 'star' : 'star-outline'}
                      size={34}
                      color={theme.colors.accent}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.rateSection}>Entregador</Text>
              <Text style={styles.rateBiz}>
                {order.driverName || 'Motoboy da entrega'}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={`d-${star}`}
                    onPress={() => setDriverRating(star)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={star <= driverRating ? 'star' : 'star-outline'}
                      size={34}
                      color="#7C3AED"
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {driverRating <= 3 ? (
                <Text style={styles.penaltyHint}>
                  Nota {driverRating}: desconto na Liga do entregador
                  {driverRating === 1
                    ? ' (−22 pts)'
                    : driverRating === 2
                      ? ' (−15 pts)'
                      : ' (−8 pts)'}
                  .
                </Text>
              ) : null}

              <TextInput
                style={styles.rateInput}
                placeholder="Comentário sobre o pedido / loja..."
                placeholderTextColor={theme.colors.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <TextInput
                style={[styles.rateInput, { marginTop: 8, minHeight: 64 }]}
                placeholder="Opcional: comentário sobre o entregador"
                placeholderTextColor={theme.colors.textMuted}
                value={driverComment}
                onChangeText={setDriverComment}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />

              <Button
                title="Enviar avaliações"
                onPress={handleSubmitReview}
                loading={submittingReview}
                style={{ marginTop: theme.spacing.md }}
              />
              <Button
                title="Agora não"
                variant="ghost"
                onPress={() => setRateVisible(false)}
                style={{ marginTop: theme.spacing.sm }}
              />

              <TouchableOpacity style={styles.reportLink} onPress={openReportDriver}>
                <Ionicons name="warning-outline" size={16} color="#DC2626" />
                <Text style={styles.reportLinkText}>
                  Denunciar delito (racismo, bullying…) com provas
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedLine} transparent animationType="fade" onRequestClose={closeDish}>
        <Pressable style={styles.modalOverlay} onPress={closeDish}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedLine && (
              <>
                <View style={styles.modalImageWrap}>
                  <Image
                    source={{ uri: dishPhotos[photoIndex] ?? selectedLine.item.image }}
                    style={styles.modalImage}
                  />
                  {dishPhotos.length > 1 && (
                    <View style={styles.photoNav}>
                      <TouchableOpacity
                        style={styles.photoNavBtn}
                        onPress={() =>
                          setPhotoIndex((i) => (i - 1 + dishPhotos.length) % dishPhotos.length)
                        }
                      >
                        <Ionicons name="chevron-back" size={20} color={theme.colors.white} />
                      </TouchableOpacity>
                      <Text style={styles.photoCounter}>
                        {photoIndex + 1}/{dishPhotos.length}
                      </Text>
                      <TouchableOpacity
                        style={styles.photoNavBtn}
                        onPress={() => setPhotoIndex((i) => (i + 1) % dishPhotos.length)}
                      >
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.white} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity style={styles.closeBtn} onPress={closeDish}>
                    <Ionicons name="close" size={22} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>{selectedLine.item.name}</Text>
                  <Text style={styles.modalMeta}>
                    {selectedLine.quantity}x · {formatPrice(getCustomerLineTotal(selectedLine))}
                  </Text>
                  <Text style={styles.modalSectionLabel}>Descrição</Text>
                  <Text style={styles.modalDescription}>
                    {selectedLine.item.description || 'Sem descrição disponível.'}
                  </Text>
                  {selectedLine.selectedAddons.length > 0 && (
                    <>
                      <Text style={styles.modalSectionLabel}>Adicionais</Text>
                      <Text style={styles.modalAddons}>
                        {formatAddonsLabel(selectedLine.selectedAddons)}
                      </Text>
                    </>
                  )}
                  {!!selectedLine.note && (
                    <>
                      <Text style={styles.modalSectionLabel}>Observação</Text>
                      <Text style={styles.modalAddons}>{selectedLine.note}</Text>
                    </>
                  )}
                  <Text style={styles.modalShop}>{order.businessName}</Text>
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <CancelReasonModal
        visible={cancelOpen}
        title="Por que cancelar?"
        hint="Informe um motivo curto. A loja vê isso no histórico do pedido."
        onCancel={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
      />
    </MobileShell>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  notFoundText: { fontSize: theme.fontSize.lg, color: theme.colors.textSecondary },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  statusBannerText: { flex: 1 },
  statusTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
  statusSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  deliveredBanner: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  deliveredTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.sm,
  },
  deliveredSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    gap: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  infoTextCol: { flex: 1 },
  infoLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  chatSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  courierIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantIcon: {
    backgroundColor: theme.colors.accentSoft,
  },
  courierInfo: { flex: 1 },
  courierLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  courierName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: 2,
  },
  chatHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  courierPhone: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  callBtnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  chatBtnMerchant: {
    backgroundColor: theme.colors.secondary,
  },
  chatBtnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  trackerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  tapHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  businessImage: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  businessName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  orderId: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
  detailsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  itemBlock: {
    marginBottom: theme.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemBlockMissing: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingTop: 8,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  issueBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  issueTitle: { fontWeight: '800', color: '#92400E', fontSize: 14 },
  issueText: { color: '#92400E', fontSize: 12, marginTop: 4, lineHeight: 17 },
  issueChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  issueChatText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  missingTag: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  swapActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  swapSuggest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  swapSuggestText: { color: '#fff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  swapPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  swapPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  swapSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapSecondaryText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  itemAddons: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
  },
  itemNote: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    fontStyle: 'italic',
    color: theme.colors.primaryDark,
  },
  itemDescPreview: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  detailValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  feeHint: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  rateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    maxHeight: '88%',
  },
  rateTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  rateSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 18,
  },
  rateSection: {
    fontWeight: '800',
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 12,
  },
  rateBiz: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  penaltyHint: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
  },
  reportLinkText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  rateInput: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  codeHero: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    alignItems: 'center',
  },
  codeHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  codeHeroTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  codeHeroDigits: {
    fontSize: 44,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 10,
    color: theme.colors.primaryDark,
    marginVertical: theme.spacing.sm,
  },
  codeHeroHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeDonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  codeDoneText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  codeWaiting: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },
  verifyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  verifyStep: {
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  verifyStepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  verifyStepTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  verifyStepText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  verifyOk: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  verifyWait: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,16,0.72)',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  modalImageWrap: {
    width: '100%',
    height: SCREEN_WIDTH * 0.72,
    backgroundColor: theme.colors.secondary,
  },
  modalImage: { width: '100%', height: '100%' },
  photoNav: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  photoNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCounter: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { maxHeight: 260 },
  modalBodyContent: { padding: theme.spacing.md, paddingBottom: theme.spacing.lg },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalMeta: {
    marginTop: 4,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  modalSectionLabel: {
    marginTop: theme.spacing.md,
    marginBottom: 4,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 22,
  },
  modalAddons: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    lineHeight: 20,
  },
  modalShop: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
});
