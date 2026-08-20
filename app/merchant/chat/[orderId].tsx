import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useOrders } from '@/context/OrdersContext';
import { theme } from '@/constants/theme';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime } from '@/utils/datetime';
import {
  ChatMessage,
  ChatPeer,
  chatFingerprint,
  ensureWelcomeMessages,
  loadChat,
  markMerchantThreadRead,
  resolveChatPeer,
  sendMerchantMessage,
} from '@/services/orderChat';

const QUICK_CUSTOMER = [
  'Pedido pronto',
  'Motoboy a caminho',
  'Item sem estoque — já avisamos no pedido',
  'Só um instante, por favor',
];

const QUICK_DRIVER = [
  'Pedido pronto para retirada',
  'Código na tela do pedido',
  'Cliente aguardando',
  'Combinado, obrigado',
];

function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isPeer(value: string): value is ChatPeer {
  return value === 'driver' || value === 'merchant' || value === 'driver_merchant';
}

function senderLabel(sender: ChatMessage['sender'], isDriverThread: boolean) {
  if (sender === 'merchant') return 'Você';
  if (sender === 'customer') return 'Cliente';
  if (sender === 'driver') return isDriverThread ? 'Motoboy' : 'Entregador';
  return 'Sistema';
}

export default function MerchantOrderChatScreen() {
  const insets = useSafeAreaInsets();
  const raw = useLocalSearchParams<{ orderId?: string; peer?: string }>();
  const orderId = paramStr(raw.orderId);
  const peerRaw = paramStr(raw.peer);
  const peer: ChatPeer = resolveChatPeer(isPeer(peerRaw) ? peerRaw : 'merchant');

  const { getOrder } = useOrders();
  const order = getOrder(orderId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const fpRef = useRef('');

  const isDriver = peer === 'driver';
  const peerName = isDriver ? order?.driverName ?? 'Motoboy' : 'Cliente';
  const title = isDriver ? `Motoboy · ${peerName}` : 'Chat · Cliente';

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
        void markMerchantThreadRead(orderId, peer, last.id);
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
    const t = setInterval(() => {
      void loadChat(orderId, peer).then(applyList);
    }, 1000);
    return () => clearInterval(t);
  }, [orderId, peer, applyList]);

  async function handleSend(raw?: string) {
    if (!orderId || !order || sending) return;
    const body = (raw ?? text).trim();
    if (!body) return;

    setSending(true);
    if (!raw) setText('');
    try {
      const next = await sendMerchantMessage({ orderId, peer, text: body });
      applyList(next);
      if (raw) setText('');
    } finally {
      setSending(false);
    }
  }

  if (!order) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Chat" fallbackHref="/merchant/chat" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pedido não encontrado.</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title={title} fallbackHref="/merchant/chat" />
      <View style={styles.peerBanner}>
        <View
          style={[
            styles.peerIcon,
            {
              backgroundColor: isDriver ? '#8B5CF622' : theme.colors.accentSoft,
            },
          ]}
        >
          <Ionicons
            name={isDriver ? 'bicycle' : 'person'}
            size={18}
            color={isDriver ? '#8B5CF6' : theme.colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.peerTitle}>{peerName}</Text>
          <Text style={styles.peerSub}>
            Pedido {merchantOrderLabel(order)} ·{' '}
            {isDriver ? 'Entrega · você, cliente e motoboy' : 'Cliente do pedido'}
          </Text>
          {order.status === 'entregue' || order.status === 'cancelado' ? (
            <Text style={styles.peerArchive}>
              Conversa salva · {order.status === 'entregue' ? 'pedido entregue' : 'pedido cancelado'}
            </Text>
          ) : null}
        </View>
      </View>

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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              const mine = item.sender === 'merchant';
              const system = item.sender === 'system';
              if (system) {
                return (
                  <View style={styles.systemRow}>
                    <Text style={styles.systemText}>{item.text}</Text>
                  </View>
                );
              }
              return (
                <View
                  style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {!mine && (
                      <Text style={styles.bubbleSender}>
                        {senderLabel(item.sender, isDriver)}
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
          {order.status !== 'cancelado' ? (
            <View style={styles.chips}>
              {(isDriver ? QUICK_DRIVER : QUICK_CUSTOMER).map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.chip}
                  onPress={() => void handleSend(chip)}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={
                isDriver ? 'Escreva no chat da entrega...' : 'Escreva para o cliente...'
              }
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={500}
              editable={!sending && order.status !== 'cancelado'}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => void handleSend()}
              disabled={!text.trim() || sending || order.status === 'cancelado'}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoid>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: theme.colors.textSecondary, textAlign: 'center' },
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
  peerSub: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  peerArchive: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    marginTop: 4,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: 8 },
  systemRow: { alignItems: 'center', marginVertical: 6 },
  systemText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: '90%',
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
  bubbleTextMine: { color: '#fff' },
  bubbleTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  composer: {
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
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
