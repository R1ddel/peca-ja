import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

export type DistanceFilter = 'any' | '1' | '2' | '5';
export type DeliveryFeeFilter = 'any' | '0' | '5' | '15';
export type RatingFilter = 'any' | '4' | '4.5';
export type SortOption = 'relevance' | 'distance' | 'delivery' | 'rating';

export type HomeFilterState = {
  distance: DistanceFilter;
  deliveryFee: DeliveryFeeFilter;
  rating: RatingFilter;
  openOnly: boolean;
  sort: SortOption;
};

export const defaultHomeFilters: HomeFilterState = {
  distance: 'any',
  deliveryFee: 'any',
  rating: 'any',
  openOnly: false,
  sort: 'relevance',
};

type HomeFiltersProps = {
  visible: boolean;
  value: HomeFilterState;
  onChange: (next: HomeFilterState) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  resultCount: number;
};

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

export function HomeFiltersModal({
  visible,
  value,
  onChange,
  onClose,
  onApply,
  onClear,
  resultCount,
}: HomeFiltersProps) {
  function setField<K extends keyof HomeFilterState>(key: K, next: HomeFilterState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filtros</Text>
            <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
              <Text style={styles.clearText}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Section title="Distância">
              <OptionChip label="Qualquer" selected={value.distance === 'any'} onPress={() => setField('distance', 'any')} />
              <OptionChip label="Até 1 km" selected={value.distance === '1'} onPress={() => setField('distance', '1')} />
              <OptionChip label="Até 2 km" selected={value.distance === '2'} onPress={() => setField('distance', '2')} />
              <OptionChip label="Até 5 km" selected={value.distance === '5'} onPress={() => setField('distance', '5')} />
            </Section>

            <Section title="Taxa de entrega">
              <OptionChip label="Qualquer" selected={value.deliveryFee === 'any'} onPress={() => setField('deliveryFee', 'any')} />
              <OptionChip label="Grátis" selected={value.deliveryFee === '0'} onPress={() => setField('deliveryFee', '0')} />
              <OptionChip label="Até R$ 5" selected={value.deliveryFee === '5'} onPress={() => setField('deliveryFee', '5')} />
              <OptionChip label="Até R$ 15" selected={value.deliveryFee === '15'} onPress={() => setField('deliveryFee', '15')} />
            </Section>

            <Section title="Avaliação">
              <OptionChip label="Qualquer" selected={value.rating === 'any'} onPress={() => setField('rating', 'any')} />
              <OptionChip label="4.0+" selected={value.rating === '4'} onPress={() => setField('rating', '4')} />
              <OptionChip label="4.5+" selected={value.rating === '4.5'} onPress={() => setField('rating', '4.5')} />
            </Section>

            <Section title="Ordenar por">
              <OptionChip label="Relevância" selected={value.sort === 'relevance'} onPress={() => setField('sort', 'relevance')} />
              <OptionChip label="Mais perto" selected={value.sort === 'distance'} onPress={() => setField('sort', 'distance')} />
              <OptionChip label="Menor frete" selected={value.sort === 'delivery'} onPress={() => setField('sort', 'delivery')} />
              <OptionChip label="Melhor nota" selected={value.sort === 'rating'} onPress={() => setField('sort', 'rating')} />
            </Section>

            <TouchableOpacity
              style={[styles.toggleRow, value.openOnly && styles.toggleRowOn]}
              onPress={() => setField('openOnly', !value.openOnly)}
              activeOpacity={0.85}
            >
              <View style={styles.toggleLeft}>
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color={value.openOnly ? theme.colors.primary : theme.colors.textSecondary}
                />
                <View>
                  <Text style={styles.toggleTitle}>Somente abertos agora</Text>
                  <Text style={styles.toggleSub}>Esconde comércios fechados</Text>
                </View>
              </View>
              <View style={[styles.switchTrack, value.openOnly && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, value.openOnly && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyBtn} onPress={onApply} activeOpacity={0.9}>
              <Text style={styles.applyText}>Ver {resultCount} resultados</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function countActiveFilters(filters: HomeFilterState): number {
  let count = 0;
  if (filters.distance !== 'any') count += 1;
  if (filters.deliveryFee !== 'any') count += 1;
  if (filters.rating !== 'any') count += 1;
  if (filters.openOnly) count += 1;
  if (filters.sort !== 'relevance') count += 1;
  return count;
}

export function parseDistanceKm(distance: string): number {
  const n = parseFloat(distance.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 999;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 46, 36, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '88%',
    paddingBottom: theme.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  clearText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  chipTextSelected: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  toggleRowOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  toggleTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  toggleSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: theme.colors.primary,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.white,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  applyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
});
