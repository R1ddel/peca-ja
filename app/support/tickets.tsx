/**
 * Painel de tickets de suporte (PIN).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { theme } from '@/constants/theme';
import {
  platformListTickets,
  platformUpdateTicket,
  asPlatformTickets,
} from '@/services/platformClient';
import type { SupportTicket } from '@/services/platformTypes';

function statusLabelPt(status: SupportTicket['status']): string {
  if (status === 'open') return 'Aberto';
  if (status === 'in_progress') return 'Em andamento';
  if (status === 'resolved') return 'Resolvido';
  return 'Fechado';
}

export default function SupportTicketsScreen() {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformListTickets({ pin });
      if (!res?.ok) {
        Alert.alert('Acesso', res?.message || 'API offline ou PIN inválido.');
        setUnlocked(false);
        return;
      }
      setUnlocked(true);
      setTickets(asPlatformTickets(res));
    } finally {
      setLoading(false);
    }
  }, [pin]);

  async function unlock() {
    if (pin.trim().length < 4) {
      Alert.alert('PIN', 'Informe o PIN de suporte.');
      return;
    }
    await refresh();
  }

  async function setStatus(t: SupportTicket, status: SupportTicket['status']) {
    const res = await platformUpdateTicket({
      pin,
      id: t.id,
      status,
      reply: replyDraft[t.id],
    });
    if (!res?.ok) {
      Alert.alert('Erro', res?.message || 'Falha ao atualizar.');
      return;
    }
    setReplyDraft((d) => ({ ...d, [t.id]: '' }));
    await refresh();
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Tickets de suporte" fallbackHref="/support" />
      <ScrollView contentContainerStyle={styles.content}>
        {!unlocked ? (
          <View style={styles.lock}>
            <Ionicons name="ticket-outline" size={36} color={theme.colors.primary} />
            <Text style={styles.lockTitle}>Painel de tickets</Text>
            <Text style={styles.lockSub}>
              Informe o PIN de suporte da equipe Peça Já.
            </Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="PIN"
              secureTextEntry
              autoCapitalize="none"
            />
            <Button title="Entrar" onPress={() => void unlock()} loading={loading} />
          </View>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={styles.count}>{tickets.length} ticket(s)</Text>
              <TouchableOpacity onPress={() => void refresh()} style={styles.refresh}>
                {loading ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            </View>
            {tickets.length === 0 ? (
              <Text style={styles.empty}>Nenhum ticket ainda.</Text>
            ) : (
              tickets.map((t) => (
                <View key={t.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.subject}>{t.subject}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{statusLabelPt(t.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {t.email}
                    {t.orderId ? ` · pedido ${t.orderId}` : ''}
                  </Text>
                  <Text style={styles.body}>{t.body}</Text>
                  {t.messages.slice(1).map((m, i) => (
                    <Text key={`${t.id}_${i}`} style={styles.msg}>
                      [{m.from}] {m.text}
                    </Text>
                  ))}
                  <TextInput
                    style={styles.reply}
                    placeholder="Responder…"
                    value={replyDraft[t.id] || ''}
                    onChangeText={(v) => setReplyDraft((d) => ({ ...d, [t.id]: v }))}
                    multiline
                  />
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => void setStatus(t, 'in_progress')}
                    >
                      <Text style={styles.actionText}>Em andamento</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionOk]}
                      onPress={() => void setStatus(t, 'resolved')}
                    >
                      <Text style={[styles.actionText, { color: '#065F46' }]}>Resolver</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  lock: { gap: 12, alignItems: 'center', paddingTop: 24 },
  lockTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  lockSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontWeight: '700', color: theme.colors.text },
  refresh: { padding: 8 },
  empty: { color: theme.colors.textMuted, marginTop: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1, fontWeight: '800', color: theme.colors.text },
  statusPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: '#3730A3' },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  body: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  msg: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  reply: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionOk: { backgroundColor: '#D1FAE5' },
  actionText: { fontWeight: '700', color: theme.colors.text },
});
