import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  STAFF_ROLE_LABEL,
  StaffAccessRequest,
  approveAccessRequest,
  rejectAccessRequest,
} from '@/utils/merchantTeam';
import { formatOrderDateTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

type Props = {
  requests: StaffAccessRequest[];
  reviewerName: string;
  accent?: string;
  onChanged?: () => void;
};

/**
 * Solicitações de cozinha / caixa / gerente — aceitar ou recusar no painel do dono.
 */
export function StaffAccessRequestsBlock({
  requests,
  reviewerName,
  accent = '#0F766E',
  onChanged,
}: Props) {
  async function approve(req: StaffAccessRequest) {
    Alert.alert(
      'Aceitar solicitação',
      `Liberar ${req.name} como ${STAFF_ROLE_LABEL[req.role]}?\n\nE-mail: ${req.email}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: () =>
            void (async () => {
              const res = await approveAccessRequest(req.id, reviewerName);
              if (!res.ok) {
                Alert.alert('Solicitação', res.error);
                return;
              }
              Alert.alert(
                'Membro aceito',
                `${res.member.name} já pode entrar como ${STAFF_ROLE_LABEL[res.member.role]} com o e-mail ${res.member.email}.\nPIN pessoal: ${res.member.pin}`
              );
              onChanged?.();
            })(),
        },
      ]
    );
  }

  async function reject(req: StaffAccessRequest) {
    Alert.alert('Recusar', `Recusar o pedido de ${req.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            const res = await rejectAccessRequest(req.id, reviewerName);
            if (!res.ok) {
              Alert.alert('Solicitação', res.error);
              return;
            }
            onChanged?.();
          })(),
      },
    ]);
  }

  return (
    <View style={[styles.block, requests.length > 0 && styles.blockAlert]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Solicitações de equipe</Text>
          <Text style={styles.hint}>
            Aceite pedidos de cozinha, caixa ou gerência
          </Text>
        </View>
        {requests.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests.length}</Text>
          </View>
        ) : null}
      </View>

      {requests.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={24} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Nenhuma solicitação pendente.</Text>
        </View>
      ) : (
        requests.map((req) => (
          <View key={req.id} style={styles.card}>
            <View style={[styles.roleDot, { backgroundColor: accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{req.name}</Text>
              <Text style={styles.meta}>
                {STAFF_ROLE_LABEL[req.role]} · {req.email}
              </Text>
              <Text style={styles.date}>{formatOrderDateTime(req.createdAt)}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: accent }]}
                onPress={() => void approve(req)}
                activeOpacity={0.88}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptText}>Aceitar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => void reject(req)}
                activeOpacity={0.88}
              >
                <Ionicons name="close" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  blockAlert: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFFBEB',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.bold },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 14, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  meta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  date: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  actions: { alignItems: 'flex-end', gap: 6 },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.bold },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
