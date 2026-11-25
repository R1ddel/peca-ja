import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { useOrders } from '@/context/OrdersContext';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import {
  ChatMessage,
  ChatPeer,
  chatFingerprint,
  ensureWelcomeMessages,
  loadChat,
  markCustomerThreadRead,
  resolveChatPeer,
  sendCustomerMessage,
} from '@/services/orderChat';
import { formatOrderTime } from '@/utils/datetime';
import { pendingLineIssues } from '@/utils/orderLineIssues';

function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isPeer(value: string): value is ChatPeer {
  return value === 'driver' || value === 'merchant' || value === 'driver_merchant';
}

export default function OrderChatScreen() {
  const insets = useSafeAreaInsets();
  const raw = useLocalSearchParams<{ orderId?: string; peer?: string }>();
  const orderId = paramStr(raw.orderId);
  const peerRaw = paramStr(raw.peer);
  const peer: ChatPeer = resolveChatPeer(isPeer(peerRaw) ? peerRaw : 'merchant');

  const { getOrder } = useOrders();
  const { user } = useAuth();
  const rawOrder = getOrder(orderId);
  const order =
    rawOrder && user?.id && rawOrder.userId === user.id ? rawOrder : undefined;
  const openIssues = order ? pendingLineIssues(order) : [];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const fpRef = useRef('');

  const peerName =
    peer === 'driver'
      ? order?.driverName ?? 'Entregador'
      : order?.businessName ?? 'Comércio';

  const title = peer === 'driver' ? `Chat · ${peerName}` : `Chat · ${peerName}`;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const applyList = useCallback(
    (list: ChatMessage[]) => {
      const fp = chatFingerprint(list);
      if (fp !== fpRef.current) {
        fpRef.current = fp;
        setMessages(list);
        scrollToEnd();
      }
      const last = list[list.length - 1];
      if (orderId && last) {
        void markCustomerThreadRead(orderId, peer, last.id);
      }
    },
    [orderId, peer, scrollToEnd]
  );

  const hydrate = useCallback(async () => {
    if (!orderId || !order) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await ensureWelcomeMessages({
      orderId,
      peer,
      peerName: order.driverName ?? 'Entregador',
      businessName: order.businessName,
      pickupCode: order.pickupCode,
    });
    applyList(list);
    setLoading(false);
  }, [
    orderId,
    peer,
    order?.id,
    order?.driverName,
    order?.businessName,
    order?.pickupCode,
    applyList,
  ]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate])
  );

  useEffect(() => {
    if (!orderId) return;
    const tick = setInterval(() => {
      void loadChat(orderId, peer).then(applyList);
    }, 1000);
    return () => clearInterval(tick);
  }, [orderId, peer, applyList]);

  async function handleSend() {
    if (!orderId || !order || sending) return;
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setText('');
    try {
      const next = await sendCustomerMessage({ orderId, peer, text: body });
      applyList(next);
    } finally {
      setSending(false);
    }
  }

  const subtitle = useMemo(
    () =>
      peer === 'driver'
        ? 'Entrega · você, motoboy e loja'
        : 'Comércio do pedido',
    [peer]
  );

  if (!order) {
    return (
      <View style={styles.screen}>
        <BackHeader title="Chat" fallbackHref="/(tabs)/orders" variant="brand" />
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Pedido não encontrado</Text>
        </View>
      </View>
    );
  }

  if (order.status === 'cancelado') {
    return (
      <View style={styles.screen}>
        <BackHeader title={title} fallbackHref={`/order/${order.id}`} variant="brand" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chat indisponível para pedidos cancelados.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <BackHeader title={title} fallbackHref={`/order/${order.id}`} variant="brand" />
      <View style={styles.peerBanner}>
        <View
          style={[
            styles.peerIcon,
            { backgroundColor: peer === 'driver' ? theme.colors.primaryLight : theme.colors.accentSoft },
          ]}
        >
          <Ionicons
            name={peer === 'driver' ? 'bicycle' : 'storefront'}
            size={18}
            color={peer === 'driver' ? theme.colors.primary : theme.colors.warning}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.peerTitle}>{peerName}</Text>
          <Text style={styles.peerSub}>
            Pedido #{order.id.slice(-6).toUpperCase()} · {subtitle}
          </Text>
        </View>
      </View>

      {peer === 'merchant' && openIssues.length > 0 ? (
        <View style={styles.issueStrip}>
          <Ionicons name="alert-circle" size={16} color="#B45309" />
          <Text style={styles.issueStripText}>
            {openIssues.length} item(ns) em falta — troque no cardápio
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/order/replace-item' as any,
                params: {
                  orderId: order.id,
                  lineId: openIssues[0].lineId,
                },
              })
            }
            style={styles.issueStripBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.issueStripBtnText}>Trocar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <KeyboardAvoid style={styles.flex}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={scrollToEnd}
            renderItem={({ item }) => {
              const mine = item.sender === 'customer';
              if (item.sender === 'system') {
                const canSwap =
                  item.kind === 'item_unavailable' &&
                  !!item.meta?.lineId &&
                  openIssues.some((i) => i.lineId === item.meta?.lineId);
                return (
                  <View style={styles.systemWrap}>
                    <Text style={styles.systemText}>{item.text}</Text>
                    {canSwap ? (
                      <TouchableOpacity
                        style={styles.systemBtn}
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push({
                            pathname: '/order/replace-item' as any,
                            params: {
                              orderId: order.id,
                              lineId: item.meta!.lineId!,
                            },
                          })
                        }
                      >
                        <Ionicons name="swap-horizontal" size={16} color="#fff" />
                        <Text style={styles.systemBtnText}>Trocar no cardápio</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              }
              return (
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {!mine && (
                      <Text style={styles.bubbleSender}>
                        {item.sender === 'driver'
                          ? 'Entregador'
                          : item.sender === 'merchant'
                            ? 'Loja'
                            : 'Sistema'}
                      </Text>
                    )}
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.text}
                    </Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatOrderTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={
              peer === 'driver'
                ? 'Escreva para o entregador...'
                : 'Escreva para o comércio...'
            }
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => void handleSend()}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
            accessibilityLabel="Enviar mensagem"
          >
            <Ionicons name="send" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoid>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  peerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  peerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  peerSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  issueStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  issueStripText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
  },
  issueStripBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  issueStripBtnText: {
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
    fontSize: 12,
  },
  systemWrap: {
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
    paddingHorizontal: 12,
  },
  systemText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  systemBtnText: {
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: 8,
  },
  bubbleRow: { marginBottom: 4 },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubbleRowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 20,
  },
  bubbleTextMine: { color: theme.colors.white },
  bubbleTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
