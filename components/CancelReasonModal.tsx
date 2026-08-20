/**
 * Modal simples para informar motivo do cancelamento.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  visible: boolean;
  title?: string;
  hint?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function CancelReasonModal({
  visible,
  title = 'Motivo do cancelamento',
  hint = 'Obrigatório — fica salvo no pedido para auditoria.',
  confirmLabel = 'Cancelar pedido',
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');

  function close() {
    setReason('');
    onCancel();
  }

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    onConfirm(trimmed);
    setReason('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Ex.: item sem estoque, cliente pediu…"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={160}
            autoFocus
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btnGhost} onPress={close} activeOpacity={0.85}>
              <Text style={styles.btnGhostText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnDanger, reason.trim().length < 3 && styles.btnDisabled]}
              onPress={submit}
              disabled={reason.trim().length < 3}
              activeOpacity={0.85}
            >
              <Text style={styles.btnDangerText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  hint: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  btnGhostText: { fontWeight: theme.fontWeight.bold, color: theme.colors.textSecondary },
  btnDanger: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.error,
  },
  btnDangerText: { fontWeight: theme.fontWeight.bold, color: '#fff' },
  btnDisabled: { opacity: 0.45 },
});
