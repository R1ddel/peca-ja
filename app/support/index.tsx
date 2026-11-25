import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { theme } from '@/constants/theme';
import {
  BOT_GREETING,
  FAQ_ENTRIES,
  QUICK_TOPICS,
  SUPPORT_EMAIL,
  SupportTopicId,
  replyAsBot,
  replyForTopic,
} from '@/data/supportBot';
import { useAuth } from '@/context/AuthContext';
import {
  asPlatformTickets,
  platformCreateTicket,
  platformListTickets,
} from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';
import type { SupportTicket } from '@/services/platformTypes';
import {
  SUPPORT_REPLY_HOURS,
  SUPPORT_SLA_SHORT,
  SUPPORT_TICKET_OPENED,
} from '@/utils/supportSla';

type ChatMessage = {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  at: number;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ticketStatusLabel(status: SupportTicket['status']) {
  if (status === 'open') return 'Aberto';
  if (status === 'in_progress') return 'Em andamento';
  if (status === 'resolved') return 'Resolvido';
  return 'Fechado';
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(
    QUICK_TOPICS.map((t) => t.label)
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greet',
      sender: 'bot',
      text: BOT_GREETING,
      at: Date.now(),
    },
  ]);
  const [ticketModal, setTicketModal] = useState(false);
  const [ticketDraft, setTicketDraft] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadMine = useCallback(async (silent = false) => {
    const token = await getPlatformToken();
    if (!token) {
      setMyTickets([]);
      return;
    }
    if (!silent) setTicketsLoading(true);
    try {
      const res = await platformListTickets({ token });
      setMyTickets(res?.ok ? asPlatformTickets(res) : []);
    } finally {
      if (!silent) setTicketsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMine();
      const id = setInterval(() => {
        void loadMine(true);
      }, 12_000);
      return () => clearInterval(id);
    }, [loadMine, user?.id])
  );

  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [messages, typing]);

  function pushMessage(sender: 'bot' | 'user', text: string) {
    setMessages((prev) => [...prev, { id: uid(), sender, text, at: Date.now() }]);
  }

  function botThink(then: () => void) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      then();
    }, 450 + Math.random() * 350);
  }

  function openEmail() {
    const subject = encodeURIComponent('Suporte Peça Já');
    const body = encodeURIComponent(
      `Olá, preciso de ajuda.\n\nNome: ${user?.name ?? ''}\nE-mail: ${user?.email ?? ''}\n\nDescreva o problema:\n`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('E-mail', `Escreva para ${SUPPORT_EMAIL}`);
    });
  }

  async function openTicket(presetBody?: string) {
    const email = user?.email?.trim();
    if (!email) {
      Alert.alert('Conta', 'Faça login para abrir um ticket no app.');
      return;
    }

    const submit = async (body: string) => {
      const text = body.trim();
      if (!text) return;
      const token = await getPlatformToken();
      if (!token) {
        Alert.alert('Conta', 'Faça login para abrir um chamado.');
        return;
      }
      const res = await platformCreateTicket({
        token,
        subject: 'Ajuda pelo app',
        body: text,
      });
      if (res?.ok) {
        pushMessage('bot', SUPPORT_TICKET_OPENED);
        await loadMine();
      } else {
        Alert.alert(
          'Ticket',
          res?.message ||
            'API offline — use o e-mail por enquanto, ou rode npm run fleet:server.'
        );
        openEmail();
      }
    };

    const initial = (presetBody || '').trim();
    if (initial && initial.toLowerCase() !== 'abrir ticket') {
      await submit(initial);
      return;
    }

    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Abrir ticket',
        `Descreva o problema. Resposta em até ${SUPPORT_REPLY_HOURS}h:`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Enviar',
            onPress: (text: string | undefined) => {
              void submit(text || '');
            },
          },
        ],
        'plain-text'
      );
      return;
    }

    setTicketDraft('');
    setTicketModal(true);
  }

  async function submitTicketModal() {
    const text = ticketDraft.trim();
    if (!text) {
      Alert.alert('Ticket', 'Descreva o problema.');
      return;
    }
    setTicketBusy(true);
    try {
      await openTicket(text);
      setTicketModal(false);
      setTicketDraft('');
    } finally {
      setTicketBusy(false);
    }
  }

  function handleBotReply(userText: string) {
    const lower = userText.trim().toLowerCase();

    if (
      lower === 'enviar e-mail' ||
      lower.includes('enviar e-mail') ||
      lower === 'falar com atendente' ||
      lower.includes('falar com atendente')
    ) {
      openEmail();
      return;
    }

    if (lower === 'abrir ticket' || lower.startsWith('abrir ticket')) {
      const rest = userText.replace(/abrir ticket/i, '').trim();
      void openTicket(rest || undefined);
      return;
    }

    if (lower === 'voltar aos atalhos' || lower === 'outra dúvida' || lower === 'outra duvida') {
      botThink(() => {
        pushMessage('bot', 'Claro! Escolha um atalho ou digite sua pergunta.');
        setQuickReplies(QUICK_TOPICS.map((t) => t.label));
      });
      return;
    }

    const topic = QUICK_TOPICS.find((t) => t.label.toLowerCase() === lower);
    const faqByLabel = FAQ_ENTRIES.find((e) => e.label.toLowerCase() === lower);

    botThink(() => {
      const reply = topic
        ? replyForTopic(topic.id as SupportTopicId)
        : faqByLabel
          ? {
              text: faqByLabel.answer,
              suggestEmail: faqByLabel.topic === 'cancelar',
              quickReplies: ['Enviar e-mail', 'Abrir ticket', 'Outra dúvida'],
              matchedFaqId: faqByLabel.id,
            }
          : replyAsBot(userText);

      pushMessage('bot', reply.text);
      if (reply.quickReplies?.length) {
        setQuickReplies(reply.quickReplies);
      }
      if (reply.suggestEmail) {
        setQuickReplies((prev) =>
          prev.includes('Enviar e-mail') ? prev : ['Enviar e-mail', 'Abrir ticket', ...prev].slice(0, 4)
        );
      }
    });
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setInput('');
    pushMessage('user', text);
    handleBotReply(text);
  }

  function onQuickReply(label: string) {
    if (label === 'Enviar e-mail') {
      openEmail();
      return;
    }
    if (label === 'Abrir ticket') {
      void openTicket();
      return;
    }
    sendText(label);
  }

  const loggedIn = Boolean(user?.email);

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Ajuda e suporte" fallbackHref="/(tabs)/profile" variant="brand" />

      <View style={styles.slaBanner}>
        <Ionicons name="time-outline" size={16} color={theme.colors.primaryDark} />
        <Text style={styles.slaText}>
          FAQ na hora · pessoa responde em até {SUPPORT_REPLY_HOURS}h (Seus chamados)
        </Text>
      </View>

      <View style={styles.modeBar}>
        <View style={[styles.modePill, styles.modePillOn]}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={14}
            color={theme.colors.primaryDark}
          />
          <Text style={[styles.modeText, styles.modeTextOn]}>Assistente FAQ</Text>
        </View>
        <TouchableOpacity
          style={styles.escalateBtn}
          onPress={() => void openTicket()}
          accessibilityLabel="Abrir ticket"
        >
          <Ionicons name="ticket-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.escalateText}>Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.escalateBtn}
          onPress={openEmail}
          accessibilityLabel="Enviar e-mail ao suporte"
        >
          <Ionicons name="mail-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.escalateText}>E-mail</Text>
        </TouchableOpacity>
        {__DEV__ ? (
          <TouchableOpacity
            style={styles.escalateBtn}
            onPress={() => router.push('/support/tickets' as any)}
            accessibilityLabel="Área interna"
          >
            <Ionicons name="shield-outline" size={14} color={theme.colors.primaryDark} />
            <Text style={styles.escalateText}>Interno</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.mineBox}>
        <View style={styles.mineHeader}>
          <Text style={styles.mineTitle}>Seus chamados</Text>
          <Text style={styles.mineSla}>{SUPPORT_SLA_SHORT}</Text>
        </View>
        {!loggedIn ? (
          <Text style={styles.mineEmpty}>
            Entre na conta para abrir um chamado e ver a resposta da equipe aqui.
          </Text>
        ) : ticketsLoading && myTickets.length === 0 ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
        ) : myTickets.length === 0 ? (
          <TouchableOpacity
            style={styles.mineEmptyCard}
            onPress={() => void openTicket()}
            accessibilityRole="button"
            accessibilityLabel="Abrir primeiro chamado"
          >
            <Text style={styles.mineEmpty}>
              Nenhum chamado ainda. Toque para abrir — resposta em até {SUPPORT_REPLY_HOURS}h.
            </Text>
          </TouchableOpacity>
        ) : (
          myTickets.slice(0, 6).map((t) => {
            const reply = [...(t.messages || [])].reverse().find((m) => m.from === 'support');
            const status = ticketStatusLabel(t.status);
            const open = expandedId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.mineCard}
                onPress={() => setExpandedId(open ? null : t.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.subject}, ${status}`}
              >
                <View style={styles.mineCardTop}>
                  <Text style={styles.mineSubject} numberOfLines={1}>
                    {t.subject} · {status}
                  </Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </View>
                {!open ? (
                  <Text style={styles.mineBody} numberOfLines={2}>
                    {reply ? `Equipe: ${reply.text}` : t.body}
                  </Text>
                ) : (
                  <View style={styles.thread}>
                    {(t.messages?.length ? t.messages : [{ at: t.createdAt, from: 'user' as const, text: t.body }]).map(
                      (m, i) => (
                        <View key={`${t.id}_${i}`} style={styles.threadRow}>
                          <Text style={styles.threadFrom}>
                            {m.from === 'support' ? 'Equipe' : 'Você'}
                          </Text>
                          <Text style={styles.threadText}>{m.text}</Text>
                        </View>
                      )
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <KeyboardAvoid style={styles.flex}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <Bubble message={item} />}
          ListFooterComponent={
            typing ? (
              <View style={[styles.bubble, styles.bubbleBot, styles.typingRow]}>
                <Text style={styles.typingText}>digitando…</Text>
              </View>
            ) : null
          }
        />

        {quickReplies.length > 0 && (
          <View style={styles.chipsWrap}>
            {quickReplies.map((label) => (
              <TouchableOpacity
                key={label}
                style={styles.chip}
                onPress={() => onQuickReply(label)}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={styles.chipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Digite sua dúvida…"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            accessibilityLabel="Mensagem de suporte"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => sendText(input)}
            disabled={!input.trim()}
            accessibilityLabel="Enviar mensagem"
          >
            <Ionicons name="send" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoid>

      <Modal visible={ticketModal} transparent animationType="fade" onRequestClose={() => setTicketModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Abrir ticket</Text>
            <Text style={styles.modalSub}>
              Descreva o problema. A equipe responde em até {SUPPORT_REPLY_HOURS}h em Seus chamados.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={ticketDraft}
              onChangeText={setTicketDraft}
              placeholder="Ex.: meu pedido atrasou"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setTicketModal(false)}
                disabled={ticketBusy}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSend}
                onPress={() => void submitTicketModal()}
                disabled={ticketBusy}
              >
                {ticketBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSendText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
      {!isUser && <Text style={styles.senderLabel}>Assistente Peça Já</Text>}
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  slaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
  },
  slaText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
    lineHeight: 16,
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  mineBox: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: 6,
    maxHeight: 220,
  },
  mineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mineTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mineSla: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  mineEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  mineEmptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderStyle: 'dashed',
  },
  mineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  mineCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mineSubject: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  mineBody: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  thread: { marginTop: 8, gap: 8 },
  threadRow: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 8,
  },
  threadFrom: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  threadText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 18,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderLight,
  },
  modePillOn: { backgroundColor: theme.colors.primaryLight },
  modeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
  modeTextOn: { color: theme.colors.primaryDark },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  escalateText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: 8,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 22,
  },
  bubbleTextUser: { color: theme.colors.white },
  typingRow: { paddingVertical: 12 },
  typingText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  chipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.medium,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  modalInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    color: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: { fontWeight: '700', color: theme.colors.text },
  modalSend: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalSendText: { fontWeight: '800', color: '#fff' },
});
