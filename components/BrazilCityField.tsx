import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { formatBrazilCity, searchBrazilCities } from '@/utils/brazilCities';

type Props = {
  label?: string;
  value: string;
  onChange: (cityLabel: string) => void;
};

export function BrazilCityField({ label = 'Cidade de atuação *', value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchBrazilCities(query), [query]);

  function pick(name: string, uf: string) {
    onChange(formatBrazilCity({ name, uf }));
    setQuery('');
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        activeOpacity={0.85}
        onPress={() => setOpen((current) => !current)}
      >
        <Ionicons name="location-outline" size={20} color={theme.colors.textMuted} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || 'Toque para buscar qualquer cidade do Brasil'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Digite a cidade. Ex.: Salvador, Mucugê"
              placeholderTextColor={theme.colors.textMuted}
              autoCorrect={false}
              autoCapitalize="words"
            />
          </View>
          {query.trim().length < 2 ? (
            <Text style={styles.hint}>Digite pelo menos 2 letras para ver as cidades.</Text>
          ) : results.length === 0 ? (
            <Text style={styles.hint}>Nenhuma cidade com esse nome.</Text>
          ) : (
            results.map((city) => (
              <TouchableOpacity
                key={`${city.uf}-${city.name}`}
                style={styles.row}
                activeOpacity={0.85}
                onPress={() => pick(city.name, city.uf)}
              >
                <Text style={styles.rowName}>{city.name}</Text>
                <Text style={styles.rowUf}>{city.uf}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  value: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  panel: {
    marginTop: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  hint: {
    padding: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  rowUf: {
    marginLeft: 12,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
});
