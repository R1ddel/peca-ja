import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { CustomerLiveMap } from '@/components/CustomerLiveMap';
import { useOrders } from '@/context/OrdersContext';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import { getLineTotal } from '@/utils/cartLine';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { isMockFleetDriverId } from '@/utils/driverOps';
import {
  copyKitchenTicket,
  printKitchenTicketPdf,
  shareKitchenTicket,
} from '@/utils/kitchenTicket';
import { CancelReasonModal } from '@/components/CancelReasonModal';
import { OrderPersonCard } from '@/components/OrderPersonCard';
import { isWithinOrderCancelWindow } from '@/utils/orderCancelWindow';

const STEPS = [
  { key: 'novo', label: 'Novo', icon: 'notifications' as const },
  { key: 'preparo', label: 'Preparo', icon: 'flame' as const },
  { key: 'pronto', label: 'Pronto', icon: 'checkmark-done' as const },
  { key: 'saiu', label: 'Saiu', icon: 'bicycle' as const },
] as const;

function kitchenStep(order: {
  status: string;
  kitchenReadyAt?: string;
  pickupVerifiedAt?: string;
}): number {
  if (order.status === 'entregue' || order.status === 'saiu_entrega' || order.pickupVerifiedAt) {
    return 3;
  }
  if (order.kitchenReadyAt) return 2;
  if (order.status === 'preparando') return 1;
  return 0;
}

export default function MerchantOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getOrder,
    markOrderPreparing,
    markOrderKitchenReady,
    togglePreparedLine,
    confirmPickupByCode,
    cancelOrder,
    flagOrderLineUnavailable,
  } = useOrders();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const order = getOrder(id || '');
  const cfg = order ? orderStatusConfig[order.status] : null;
  const canCancel =
    !!order &&
    !order.pickupVerifiedAt &&
    (order.status === 'pendente' ||
      order.status === 'confirmado' ||
      order.status === 'preparando') &&
    isWithinOrderCancelWindow(order.createdAt, nowMs);

  useEffect(() => {
    if (!canCancel) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [canCancel]);
  const lines = useMemo(() => order?.items ?? [], [order]);
  const prepared = order?.preparedLineIds ?? [];
  const step = order ? kitchenStep(order) : 0;
  const allPrepared =
    lines.length > 0 &&
    lines.every((l) => {
      const missing = order?.lineIssues?.some(
        (i) => i.lineId === l.lineId && i.status === 'awaiting_customer'
      );
      return missing || prepared.includes(l.lineId);
    });
  const pendingIssues =
    order?.lineIssues?.filter((i) => i.status === 'awaiting_customer') ?? [];
  const canFlagIssue =
    !!order &&
    !order.kitchenReadyAt &&
    !order.pickupVerifiedAt &&
    (order.status === 'confirmado' ||
      order.status === 'preparando' ||
      (order.status === 'pendente' && order.paymentConfirmed));

  if (!order || !cfg) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Pedido" fallbackHref="/merchant/orders" />
        <View style={styles.center}>
          <Text style={styles.muted}>Pedido não encontrado.</Text>
        </View>
      </MobileShell>
    );
  }

  function acceptPreparing() {
    const res = markOrderPreparing(order!.id);
    if (!res.ok) {
      Alert.alert('Preparar', res.error);
      return;
    }
    Alert.alert('Em preparo', 'Separe os itens abaixo e marque cada um quando estiver pronto.');
  }

  function markReady() {
    const res = markOrderKitchenReady(order!.id);
    if (!res.ok) {
      Alert.alert('Pronto', res.error);
      return;
    }
    Alert.alert('Pronto!', 'Aguardando o entregador. Digite o código de retirada quando chegar.');
  }

  function toggleLine(lineId: string) {
    const res = togglePreparedLine(order!.id, lineId);
    if (!res.ok) Alert.alert('Item', res.error);
  }

  function submitPickup() {
    setBusy(true);
    const res = confirmPickupByCode(order!.id, code);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Código inválido', res.error);
      return;
    }
    setCode('');
    Alert.alert('Retirada liberada', 'Pedido saiu para entrega.');
  }

  function handleCancel() {
    setCancelOpen(true);
  }

  async function confirmCancel(reason: string) {
    setCancelOpen(false);
    const res = await cancelOrder(order!.id, { reason, by: 'merchant' });
    if (!res.ok) {
      Alert.alert('Não foi possível', res.error);
      return;
    }
    router.back();
  }

  function flagMissing(lineId: string, itemName: string) {
    Alert.alert(
      'Item em falta',
      `“${itemName}” está indisponível. Quer sugerir outro do cardápio para o cliente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Só avisar',
          onPress: () => {
            const res = flagOrderLineUnavailable(order!.id, lineId, 'Item em falta no estoque');
            if (!res.ok) {
              Alert.alert('Não foi possível', res.error);
              return;
            }
            Alert.alert('Cliente avisado', 'Enviamos a mensagem no chat.');
          },
        },
        {
          text: 'Sugerir troca',
          onPress: () =>
            router.push({
              pathname: '/merchant/order/flag-missing' as any,
              params: { orderId: order!.id, lineId },
            }),
        },
      ]
    );
  }

  const statusLabel =
    order.status === 'preparando' && order.kitchenReadyAt
      ? 'Pronto para retirada'
      : cfg.label;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={merchantOrderLabel(order)}
        fallbackHref="/merchant/orders"
      />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[
            order.kitchenReadyAt && order.status === 'preparando' ? '#00A86B' : cfg.color,
            theme.colors.secondary,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <Ionicons
              name={(order.kitchenReadyAt ? 'checkmark-done' : cfg.icon) as any}
              size={28}
              color="#fff"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroStatus}>{statusLabel}</Text>
              <Text style={styles.heroTime}>
                Feito às {formatOrderTime(order.createdAt)} · {formatWaitLabel(order.createdAt)} ·{' '}
                {formatPrice(order.total)} · {lines.reduce((s, l) => s + l.quantity, 0)} itens
              </Text>
            </View>
          </View>

          <View style={styles.stepper}>
            {STEPS.map((s, i) => {
              const done = i <= step;
              const current = i === step;
              return (
                <View key={s.key} style={styles.stepCol}>
                  <View
                    style={[
                      styles.stepDot,
                      done && styles.stepDotOn,
                      current && styles.stepDotCurrent,
                    ]}
                  >
                    <Ionicons
                      name={s.icon}
                      size={14}
                      color={done ? '#fff' : 'rgba(255,255,255,0.45)'}
                    />
                  </View>
                  <Text style={[styles.stepLabel, done && styles.stepLabelOn]}>{s.label}</Text>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, i < step && styles.stepLineOn]} />
                  )}
                </View>
              );
            })}
          </View>
        </LinearGradient>

        <Text style={styles.section}>O que o cliente pediu</Text>
        <Text style={styles.sectionHint}>
          Toque no item para marcar como separado · use “Em falta” se não tiver o produto
        </Text>

        {pendingIssues.length > 0 && (
          <View style={styles.issueBanner}>
            <Ionicons name="alert-circle" size={18} color="#B45309" />
            <Text style={styles.issueBannerText}>
              {pendingIssues.length} item(ns) em falta — aguardando o cliente trocar no
              cardápio. Não marque o pedido como pronto até resolver.
            </Text>
          </View>
        )}

        {lines.map((line) => {
          const done = prepared.includes(line.lineId);
          const missing = order.lineIssues?.find(
            (i) => i.lineId === line.lineId && i.status === 'awaiting_customer'
          );
          const canToggle =
            order.status === 'preparando' && !order.kitchenReadyAt && !missing;
          return (
            <View
              key={line.lineId}
              style={[
                styles.lineCard,
                done && styles.lineCardDone,
                !!missing && styles.lineCardMissing,
              ]}
            >
              <TouchableOpacity
                style={styles.lineMain}
                onPress={() => (canToggle ? toggleLine(line.lineId) : undefined)}
                activeOpacity={canToggle ? 0.85 : 1}
                disabled={!canToggle}
              >
                <Image
                  source={{ uri: line.item.image || order.businessImage }}
                  style={styles.lineImg}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.lineTop}>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>{line.quantity}×</Text>
                    </View>
                    <Text
                      style={[styles.lineName, done && styles.lineNameDone]}
                      numberOfLines={2}
                    >
                      {line.item.name}
                    </Text>
                  </View>
                  {!!missing && (
                    <Text style={styles.missingLabel}>Em falta · aguardando cliente</Text>
                  )}
                  {!!line.item.description && (
                    <Text style={styles.lineDesc} numberOfLines={2}>
                      {line.item.description}
                    </Text>
                  )}
                  {line.selectedAddons?.length > 0 && (
                    <Text style={styles.lineAddons}>
                      + {line.selectedAddons.map((a) => a.name).join(', ')}
                    </Text>
                  )}
                  {!!line.note && (
                    <View style={styles.noteBox}>
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={12}
                        color={theme.colors.accent}
                      />
                      <Text style={styles.lineNote}>{line.note}</Text>
                    </View>
                  )}
                  <Text style={styles.linePrice}>{formatPrice(getLineTotal(line))}</Text>
                </View>
                <View style={[styles.check, done && styles.checkOn]}>
                  <Ionicons
                    name={missing ? 'alert' : done ? 'checkmark' : 'ellipse-outline'}
                    size={18}
                    color={missing ? '#B45309' : done ? '#fff' : theme.colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
              {canFlagIssue && !missing ? (
                <TouchableOpacity
                  style={styles.missingBtn}
                  onPress={() => flagMissing(line.lineId, line.item.name)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#B45309" />
                  <Text style={styles.missingBtnText}>Em falta</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.totals}>
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          <Row label="Frete" value={formatPrice(order.deliveryFee)} />
          {!!order.discount && order.discount > 0 && (
            <Row label="Desconto" value={`- ${formatPrice(order.discount)}`} />
          )}
          <Row label="Total" value={formatPrice(order.total)} bold />
        </View>

        <Text style={styles.section}>Entrega</Text>
        {order.driverId &&
        !isMockFleetDriverId(order.driverId) &&
        order.status !== 'cancelado' &&
        order.status !== 'entregue' ? (
          <CustomerLiveMap order={order} viewer="merchant" height={240} />
        ) : null}
        <View style={styles.addrCard}>
          <Ionicons name="location" size={18} color={theme.colors.primary} />
          <Text style={styles.addr}>{order.address}</Text>
        </View>
        <Text style={styles.pay}>
          {order.paymentMethod}
          {order.paymentConfirmed ? ' · pago' : ' · pendente'}
          {order.driverName ? ` · ${order.driverName}` : ''}
        </Text>

        <Text style={styles.section}>Impressão</Text>
        <View style={styles.printRow}>
          <TouchableOpacity
            style={styles.printBtn}
            activeOpacity={0.88}
            onPress={() =>
              void printKitchenTicketPdf(order, order.businessName).then((r) => {
                if (!r.ok) Alert.alert('Impressão', r.error);
              })
            }
          >
            <Ionicons name="print" size={18} color="#fff" />
            <Text style={styles.printBtnText}>Imprimir cupom</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.printBtnOutline}
            activeOpacity={0.88}
            onPress={() => void shareKitchenTicket(order, order.businessName)}
          >
            <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.printBtnOutlineText}>Compartilhar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.printBtnOutline}
            activeOpacity={0.88}
            onPress={() =>
              void copyKitchenTicket(order, order.businessName).then(() =>
                Alert.alert('Cupom', 'Texto copiado — cole na impressora ou WhatsApp.')
              )
            }
          >
            <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.printBtnOutlineText}>Copiar</Text>
          </TouchableOpacity>
        </View>

        {order.status !== 'cancelado' && (
          <>
            <Text style={styles.section}>Quem está no pedido</Text>
            <OrderPersonCard
              role="customer"
              name={order.customerName || 'Cliente'}
              bio={order.customerBio}
              photoUrl={order.customerPhotoUrl}
              phone={order.customerPhone}
              onChat={() =>
                router.push({
                  pathname: '/merchant/chat/[orderId]' as any,
                  params: { orderId: order.id, peer: 'merchant' },
                })
              }
              chatLabel="Chat"
            />

            {!!order.driverName && (
              <OrderPersonCard
                role="driver"
                name={order.driverName}
                bio={order.driverBio}
                photoUrl={order.driverPhotoUrl}
                phone={order.driverPhone}
                meta={order.driverVehicle || undefined}
                onChat={() =>
                  router.push({
                    pathname: '/merchant/chat/[orderId]' as any,
                    params: { orderId: order.id, peer: 'driver' },
                  })
                }
                chatLabel="Chat"
              />
            )}
          </>
        )}

        <Text style={styles.section}>Atualizar status</Text>

        {(order.status === 'confirmado' ||
          (order.status === 'pendente' && order.paymentConfirmed)) && (
          <Button
            title="1. Aceitar e começar preparo"
            onPress={acceptPreparing}
            size="lg"
          />
        )}

        {order.status === 'preparando' && !order.kitchenReadyAt && (
          <View style={styles.actionBlock}>
            <Text style={styles.progressText}>
              Itens separados: {prepared.length}/{lines.length}
              {allPrepared ? ' · pode marcar pronto' : ''}
            </Text>
            <Button
              title="2. Marcar pedido pronto"
              onPress={markReady}
              size="lg"
              variant={allPrepared ? 'primary' : 'outline'}
            />
            {!allPrepared && (
              <Text style={styles.actionHint}>
                Você pode marcar pronto mesmo sem checar todos — o checklist é só para ajudar.
              </Text>
            )}
          </View>
        )}

        {order.status === 'preparando' && !!order.kitchenReadyAt && (
          <View style={styles.pickupBox}>
            <LinearGradient
              colors={[theme.colors.primaryLight, '#fff']}
              style={styles.pickupInner}
            >
              <View style={styles.readyBanner}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.readyText}>Pronto — aguardando entregador</Text>
              </View>
              <Text style={styles.pickupTitle}>3. Código de retirada</Text>
              <Text style={styles.pickupHint}>
                {order.driverName
                  ? `Confira se é ${order.driverName} e digite o código de 4 dígitos da tela dele.`
                  : 'Digite o código de 4 dígitos que o entregador mostrar para liberar este pedido.'}
              </Text>
              <View style={styles.pickupIdRow}>
                <Text style={styles.pickupIdBig}>{merchantOrderLabel(order)}</Text>
                <Text style={styles.pickupIdItems} numberOfLines={2}>
                  {order.items
                    .slice(0, 3)
                    .map((l) => `${l.quantity}× ${l.item.name}`)
                    .join(' · ')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pickupShortcut}
                onPress={() =>
                  router.push({
                    pathname: '/merchant/pickup' as any,
                    params: { orderId: order.id },
                  })
                }
              >
                <Ionicons name="keypad" size={16} color="#7C3AED" />
                <Text style={styles.pickupShortcutText}>Abrir fila de retirada com este pedido</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="0000"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={4}
              />
              <Button
                title="Confirmar retirada · sai para entrega"
                onPress={submitPickup}
                loading={busy}
                disabled={code.length !== 4}
                size="lg"
              />
            </LinearGradient>
          </View>
        )}

        {(order.status === 'saiu_entrega' || order.status === 'entregue') && (
          <View style={styles.doneBox}>
            <Ionicons
              name={order.status === 'entregue' ? 'checkmark-done-circle' : 'bicycle'}
              size={28}
              color={theme.colors.primary}
            />
            <Text style={styles.doneTitle}>
              {order.status === 'entregue' ? 'Pedido entregue' : 'A caminho do cliente'}
            </Text>
            <Text style={styles.doneSub}>{cfg.label}</Text>
          </View>
        )}

        {canCancel && (
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancelar pedido</Text>
          </TouchableOpacity>
        )}

        {order.status === 'cancelado' && order.cancelReason ? (
          <View style={styles.cancelReasonBox}>
            <Text style={styles.cancelReasonTitle}>Motivo do cancelamento</Text>
            <Text style={styles.cancelReasonText}>{order.cancelReason}</Text>
          </View>
        ) : null}
      </KeyboardScreen>

      <CancelReasonModal
        visible={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        hint="Obrigatório — o cliente é notificado e o motivo fica salvo."
      />
    </MobileShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: theme.colors.textMuted },
  hero: { borderRadius: 22, padding: theme.spacing.lg, marginBottom: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroStatus: { color: '#fff', fontWeight: theme.fontWeight.extrabold, fontSize: 20 },
  heroTime: { color: 'rgba(255,255,255,0.85)', marginTop: 2, fontSize: 13 },
  stepper: {
    flexDirection: 'row',
    marginTop: 18,
    justifyContent: 'space-between',
  },
  stepCol: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotOn: { backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotCurrent: {
    backgroundColor: '#FFB800',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: theme.fontWeight.semibold,
  },
  stepLabelOn: { color: '#fff' },
  stepLine: {
    position: 'absolute',
    top: 13,
    left: '55%',
    width: '90%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepLineOn: { backgroundColor: 'rgba(255,255,255,0.5)' },
  section: {
    marginTop: theme.spacing.lg,
    marginBottom: 4,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  lineCard: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    marginBottom: 10,
    gap: 10,
  },
  lineCardDone: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  lineCardMissing: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  lineMain: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  issueBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  issueBannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: theme.fontWeight.medium,
  },
  missingLabel: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    marginTop: 4,
  },
  missingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'stretch',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  missingBtnText: {
    color: '#B45309',
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
  lineImg: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.borderLight,
  },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  qtyBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qtyText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 12 },
  lineName: {
    flex: 1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 15,
  },
  lineNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  lineDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, lineHeight: 16 },
  lineAddons: { fontSize: 12, color: theme.colors.primary, marginTop: 4, fontWeight: theme.fontWeight.semibold },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lineNote: { fontSize: 12, color: '#92400E', fontWeight: theme.fontWeight.semibold },
  linePrice: {
    marginTop: 6,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  checkOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  totals: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { color: theme.colors.textSecondary },
  rowValue: { color: theme.colors.text },
  bold: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  addrCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  addr: { flex: 1, color: theme.colors.text, lineHeight: 20 },
  pay: { marginTop: 8, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  printRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  printBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 13 },
  printBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  printBtnOutlineText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 8,
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  chatHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  actionBlock: { gap: 10 },
  progressText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  actionHint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
  pickupBox: { borderRadius: 22, overflow: 'hidden' },
  pickupInner: { padding: theme.spacing.md, gap: 10 },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
  },
  readyText: { fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  pickupTitle: {
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
  },
  pickupHint: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, lineHeight: 19 },
  pickupIdRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  pickupIdBig: {
    fontSize: 26,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  pickupIdItems: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  pickupShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pickupShortcutText: {
    color: '#7C3AED',
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
  codeInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  doneBox: {
    alignItems: 'center',
    gap: 6,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 18,
  },
  doneTitle: { fontWeight: theme.fontWeight.bold, fontSize: 16, color: theme.colors.text },
  doneSub: { color: theme.colors.textSecondary, fontSize: 13 },
  cancelLink: { marginTop: theme.spacing.lg, alignItems: 'center', padding: 12 },
  cancelText: { color: theme.colors.error, fontWeight: theme.fontWeight.semibold },
  cancelReasonBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelReasonTitle: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.error,
    marginBottom: 4,
  },
  cancelReasonText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
});
