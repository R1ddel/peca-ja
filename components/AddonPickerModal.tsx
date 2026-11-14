import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem, SelectedAddon } from '@/types';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { getCustomerUnitPrice } from '@/utils/cartLine';
import { customerUnitPrice } from '@/constants/pricing';

type Props = {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (addons: SelectedAddon[], note: string) => void;
};

export function AddonPickerModal({ visible, item, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible || !item) return;
    const initial: Record<string, number> = {};
    for (const group of item.addonGroups ?? []) {
      if (group.required && group.maxSelect === 1 && group.options[0]) {
        initial[group.options[0].id] = 1;
      }
    }
    setSelected(initial);
    setNote('');
  }, [visible, item]);

  const selectedAddons = useMemo((): SelectedAddon[] => {
    if (!item?.addonGroups) return [];
    const list: SelectedAddon[] = [];
    for (const group of item.addonGroups) {
      for (const opt of group.options) {
        const qty = selected[opt.id] ?? 0;
        if (qty > 0) {
          list.push({ id: opt.id, name: opt.name, price: opt.price, quantity: qty });
        }
      }
    }
    return list;
  }, [item, selected]);

  const unitPrice = item ? getCustomerUnitPrice(item, selectedAddons) : 0;

  const missingRequired = useMemo(() => {
    if (!item?.addonGroups) return false;
    return item.addonGroups.some((group) => {
      if (!group.required) return false;
      return !group.options.some((opt) => (selected[opt.id] ?? 0) > 0);
    });
  }, [item, selected]);

  const toggleOption = (groupId: string, optionId: string, maxSelect?: number) => {
    setSelected((prev) => {
      const group = item?.addonGroups?.find((g) => g.id === groupId);
      if (!group) return prev;
      const next = { ...prev };
      const isOn = (next[optionId] ?? 0) > 0;

      if (maxSelect === 1) {
        if (isOn && group.required) return prev;
        for (const opt of group.options) {
          delete next[opt.id];
        }
        if (!isOn) next[optionId] = 1;
        return next;
      }

      if (isOn) {
        delete next[optionId];
        return next;
      }

      const countInGroup = group.options.filter((o) => (next[o.id] ?? 0) > 0).length;
      if (maxSelect && countInGroup >= maxSelect) return prev;
      next[optionId] = 1;
      return next;
    });
  };

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.headerText}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.description} numberOfLines={3}>
                  {item.description}
                </Text>
                <Text style={styles.basePrice}>
                  A partir de {formatPrice(customerUnitPrice(item.promo ?? item.price))}
                </Text>
              </View>
            </View>

            {(item.addonGroups ?? []).map((group) => (
              <View key={group.id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.name}</Text>
                  <Text style={styles.groupHint}>
                    {group.required ? 'Obrigatório' : 'Opcional'}
                    {group.maxSelect === 1
                      ? ' · escolha 1'
                      : group.maxSelect
                        ? ` · até ${group.maxSelect}`
                        : ''}
                  </Text>
                </View>
                {group.options.map((opt) => {
                  const active = (selected[opt.id] ?? 0) > 0;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.option, active && styles.optionActive]}
                      activeOpacity={0.85}
                      onPress={() => toggleOption(group.id, opt.id, group.maxSelect)}
                    >
                      <View style={[styles.check, active && styles.checkActive]}>
                        {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.optionName, active && styles.optionNameActive]}>
                        {opt.name}
                      </Text>
                      <Text style={styles.optionPrice}>
                        {opt.price === 0 ? 'Grátis' : `+ ${formatPrice(opt.price)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.noteBlock}>
              <Text style={styles.groupTitle}>Observação</Text>
              <Text style={styles.groupHint}>Opcional · ex.: sem cebola, bem passado</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Alguma preferência para este item?"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={120}
                multiline
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {missingRequired && (
              <Text style={styles.warning}>Escolha as opções obrigatórias</Text>
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, missingRequired && styles.confirmDisabled]}
              disabled={missingRequired}
              activeOpacity={0.9}
              onPress={() => {
                onConfirm(selectedAddons, note.trim());
                onClose();
              }}
            >
              <Text style={styles.confirmText}>
                Pedir · {formatPrice(unitPrice)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.lg },
  header: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  image: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  headerText: { flex: 1 },
  name: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  basePrice: {
    marginTop: 6,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  group: { marginBottom: theme.spacing.lg },
  groupHeader: { marginBottom: theme.spacing.sm },
  groupTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  groupHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  optionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionName: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.text },
  optionNameActive: { fontWeight: theme.fontWeight.semibold },
  optionPrice: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  noteBlock: { marginBottom: theme.spacing.md },
  noteInput: {
    marginTop: theme.spacing.sm,
    minHeight: 72,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    textAlignVertical: 'top',
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  warning: {
    textAlign: 'center',
    color: theme.colors.warning,
    marginBottom: 8,
    fontSize: theme.fontSize.sm,
  },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
});
