import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminTicketList,
  platformAdminTicketUpdate,
} from '@/services/platformClient';
import type { SupportTicket } from '@/services/platformTypes';
import { theme } from '@/constants/theme';

export default function AdminTicketsScreen() {
  const { ok } = useAdminGate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminTicketList(token);
      if (!res?.ok) {
        Alert.alert('Tickets', (res as any)?.message || 'Falha.');
        return;
      }
      setTickets(((res as any).tickets || []) as SupportTicket[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function update(id: string, status: SupportTicket['status']) {
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminTicketUpdate(token, {
      id,
      status,
      reply: reply[id]?.trim() || undefined,
    });
    if (!res?.ok) {
      Alert.alert('Erro', (res as any)?.message || 'Falha.');
      return;
    }
    setReply((p) => ({ ...p, [id]: '' }));
    await load();
  }

  if (!ok) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Tickets</Text>
      {loading && tickets.length === 0 ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.subject}</Text>
            <Text style={styles.meta}>
              {item.status} · {item.email}
              {item.orderId ? ` · pedido ${item.orderId}` : ''}
            </Text>
            <View style={styles.thread}>
              {(item.messages?.length
                ? item.messages
                : [{ at: item.createdAt, from: 'user' as const, text: item.body }]
              ).map((m, i) => (
                <View key={`${item.id}_${i}`} style={styles.threadRow}>
                  <Text style={styles.threadFrom}>
                    {m.from === 'support' ? 'Equipe' : 'Cliente'}
                  </Text>
                  <Text style={styles.threadText}>{m.text}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Resposta ao cliente (aparece em Seus chamados)…"
              placeholderTextColor="#8b949e"
              value={reply[item.id] || ''}
              onChangeText={(t) => setReply((p) => ({ ...p, [item.id]: t }))}
              multiline
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => void update(item.id, 'in_progress')}
              >
                <Text style={styles.btnText}>Em andamento</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnOk]}
                onPress={() => void update(item.id, 'resolved')}
              >
                <Text style={styles.btnText}>Resolver + enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  title: { color: '#fff', fontWeight: '800' },
  meta: { color: '#8b949e', fontSize: 12, marginTop: 4 },
  thread: { marginTop: 10, gap: 6 },
  threadRow: {
    backgroundColor: '#0f1419',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  threadFrom: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  threadText: { color: '#c9d1d9', fontSize: 13, lineHeight: 18 },
  input: {
    marginTop: 10,
    minHeight: 64,
    backgroundColor: '#0f1419',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 10,
    color: '#fff',
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    backgroundColor: '#21262d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnOk: { backgroundColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
