import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
};

/** Checkbox “Salvar login” para telas de autenticação. */
export function SaveLoginToggle({
  checked,
  onChange,
  label = 'Lembrar meu e-mail neste aparelho',
}: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onChange(!checked)}
      activeOpacity={0.85}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>A senha não fica salva</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.md,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  textCol: { flex: 1 },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  hint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
