/**
 * Card de perfil (cliente / entregador) nas telas do pedido.
 * Só React Native nativo — sem reanimated.
 */
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

export type OrderPersonCardProps = {
  role: 'customer' | 'driver';
  name: string;
  subtitle?: string;
  bio?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  meta?: string | null;
  onChat?: () => void;
  chatLabel?: string;
};

export function OrderPersonCard({
  role,
  name,
  subtitle,
  bio,
  photoUrl,
  phone,
  meta,
  onChat,
  chatLabel = 'Chat',
}: OrderPersonCardProps) {
  const accent = role === 'driver' ? theme.colors.primary : theme.colors.accent;
  const roleLabel = role === 'driver' ? 'Entregador' : 'Cliente';
  const letter = (name || roleLabel).trim().charAt(0).toUpperCase() || '?';
  const about =
    (bio || '').trim() ||
    (role === 'driver'
      ? 'Sem descrição pública ainda.'
      : 'Cliente sem biografia no perfil.');

  return (
    <View style={[styles.card, { borderColor: accent + '33' }]}>
      <View style={styles.top}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.avatarLetter, { color: accent }]}>{letter}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.role, { color: accent }]}>{roleLabel}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {name || roleLabel}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {phone ? (
            <Text style={styles.phone} numberOfLines={1}>
              <Ionicons name="call-outline" size={12} color={theme.colors.textMuted} /> {phone}
            </Text>
          ) : null}
        </View>
        {onChat ? (
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: accent }]}
            onPress={onChat}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`${chatLabel} com ${name}`}
          >
            <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
            <Text style={styles.chatBtnText}>{chatLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.bioBox}>
        <Text style={styles.bioLabel}>Sobre</Text>
        <Text style={styles.bio}>{about}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...theme.shadow.soft,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
  },
  info: { flex: 1, minWidth: 0 },
  role: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  phone: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chatBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
  },
  bioBox: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
  },
  bioLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.text,
  },
});
