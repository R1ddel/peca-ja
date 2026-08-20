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
import {
  ChatMessage,
  chatFingerprint,
  ensureWelcomeMessages,
  loadChat,
  markDriverThreadRead,
  sendDriverMessage,
} from '@/services/orderChat';
import { formatOrderTime } from '@/utils/datetime';

function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function senderLabel(sender: ChatMessage['sender']) {
  if (sender === 'driver') return 'Você';
  if (sender === 'customer') return 'Cliente';
  if (sender === 'merchant') return 'Loja';
  return 'Sistema';
}

export default function DriverOrderChatScreen() {
  const insets = useSafeAreaInsets();
  const orderId = paramStr(useLocalSearchParams<{ orderId?: string }>().orderId);
  const { getOrder } = useOrders();
  const order = getOrder(orderId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const fpRef = useRef('');

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const applyList = useCallback(
    (list: ChatMessage[]) => {
      const fp = chatFingerprint(list);
      if (fp === fpRef.current) return;
      fpRef.current = fp;
      setMessages(list);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  const hydrate = useCallback(async () => {
    if (!orderId || !order) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await ensureWelcomeMessages({
      orderId,
      peer: 'driver',
      peerName: order.driverName ?? 'Entregador',
      businessName: order.businessName,
      pickupCode: order.pickupCode,
    });
    applyList(list);
    const last = list[list.length - 1];
    if (last) void markDriverThreadRead(orderId, last.id);
    setLoading(false);
  }, [
    orderId,
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
      void loadChat(orderId, 'driver').then((list) => {
        applyList(list);
        const last = list[list.length - 1];
        if (last) void markDriverThreadRead(orderId, last.id);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [orderId, applyList]);

  async function handleSend() {
    if (!orderId || !order || sending) return;
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText('');
    try {
      const next = await sendDriverMessage({ orderId, peer: 'driver', text: body });
      applyList(next);
    } finally {
      setSending(false);
    }
  }

  if (!order) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Chat da entrega" fallbackHref="/driver/chat" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pedido não encontrado.</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Chat da entrega" fallbackHref="/driver/chat" />
      <View style={styles.peerBanner}>
        <View style={[styles.peerIcon, { backgroundColor: '#8B5CF622' }]}>
          <Ionicons name="chatbubbles" size={18} color="#8B5CF6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.peerTitle}>{order.businessName}</Text>
          <Text style={styles.peerSub}>
            Pedido #{order.id.slice(-6).toUpperCase()} · cliente e loja no mesmo chat
          </Text>
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
            renderItem={({ item }) => {
              const mine = item.sender === 'driver';
              if (item.sender === 'system') {
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
                      <Text style={styles.bubbleSender}>{senderLabel(item.sender)}</Text>
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
            placeholder="Responda o cliente ou a loja..."
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
    backgroundColor: '#8B5CF6',
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
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
