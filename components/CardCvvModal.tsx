import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { maskCardLabel, type SavedCard } from '@/services/cards';

type Props = {
  visible: boolean;
  card: SavedCard | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (cvv: string) => void;
};

export function CardCvvModal({ visible, card, loading, onClose, onConfirm }: Props) {
  const [cvv, setCvv] = useState('');

  function handleConfirm() {
    const digits = cvv.replace(/\D/g, '');
    if (digits.length < 3) return;
    onConfirm(digits);
  }

  function handleClose() {
    if (loading) return;
    setCvv('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirmar pagamento</Text>
            <TouchableOpacity onPress={handleClose} disabled={!!loading} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Digite o CVV de {card ? maskCardLabel(card) : 'seu cartão'}. O pedido só é
            confirmado depois que o banco aprovar.
            {card?.isGhostTest ||
            card?.last4 === '6351' ||
            card?.last4 === '5682' ||
            card?.last4 === '3311'
              ? '\n\nCartão de teste: use CVV 123'
              : ''}
          </Text>

          <TextInput
            style={styles.input}
            value={cvv}
            onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, card?.isGhostTest ? 3 : 4))}
            placeholder={card?.isGhostTest ? '123' : 'CVV'}
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={card?.isGhostTest ? 3 : 4}
            editable={!loading}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!!loading || cvv.replace(/\D/g, '').length < 3}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.btnText}>Pagar e aguardar banco</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.fontSize.lg,
    letterSpacing: 4,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
});
