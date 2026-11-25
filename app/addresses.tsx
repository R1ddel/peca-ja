import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { theme } from '@/constants/theme';
import {
  SavedAddress,
  loadAddresses,
  removeAddress,
  setDefaultAddress,
  upsertAddress,
} from '@/utils/addresses';

export default function AddressesScreen() {
  const [list, setList] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [label, setLabel] = useState('Casa');
  const [line, setLine] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadAddresses();
    setList(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleSave() {
    if (!line.trim()) {
      Alert.alert('Endereço obrigatório', 'Informe rua, número e bairro.');
      return;
    }
    setSaving(true);
    try {
      const next = await upsertAddress({
        label: label.trim() || 'Endereço',
        line: line.trim(),
        makeDefault: list.length === 0,
      });
      setList(next);
      setLine('');
      setLabel('Casa');
      Alert.alert('Salvo', 'Endereço adicionado com sucesso.');
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(addr: SavedAddress) {
    Alert.alert('Remover endereço', `Remover "${addr.label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const next = await removeAddress(addr.id);
          setList(next);
        },
      },
    ]);
  }

  async function makeDefault(addr: SavedAddress) {
    const next = await setDefaultAddress(addr.id);
    setList(next);
  }

  return (
    <View style={styles.screen}>
      <BackHeader title="Endereços salvos" fallbackHref="/(tabs)/profile" variant="brand" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Text style={styles.hint}>
          Guarde até 5 endereços neste aparelho para agilizar o checkout.
        </Text>

        <View style={styles.form}>
          <Input
            label="Apelido"
            placeholder="Casa, Trabalho..."
            value={label}
            onChangeText={setLabel}
            icon="pricetag-outline"
          />
          <Input
            label="Endereço"
            placeholder="Rua, número, complemento, bairro"
            value={line}
            onChangeText={setLine}
            icon="location-outline"
          />
          <Button title="Adicionar endereço" onPress={handleSave} loading={saving} />
        </View>

        <Text style={styles.sectionTitle}>Salvos</Text>

        {loading ? (
          <Text style={styles.emptyText}>Carregando…</Text>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={40} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Nenhum endereço</Text>
            <Text style={styles.emptyText}>Adicione um endereço acima para começar.</Text>
          </View>
        ) : (
          list.map((addr) => (
            <View key={addr.id} style={[styles.card, addr.isDefault && styles.cardDefault]}>
              <View style={styles.cardTop}>
                <Ionicons name="home-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{addr.label}</Text>
                  <Text style={styles.cardLine}>{addr.line}</Text>
                </View>
                {addr.isDefault && (
                  <View style={styles.defaultPill}>
                    <Text style={styles.defaultPillText}>Padrão</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardActions}>
                {!addr.isDefault && (
                  <TouchableOpacity onPress={() => makeDefault(addr)} style={styles.actionBtn}>
                    <Text style={styles.actionPrimary}>Definir padrão</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => confirmRemove(addr)} style={styles.actionBtn}>
                  <Text style={styles.actionDanger}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  cardDefault: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  cardLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardLine: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  defaultPill: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  defaultPillText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionBtn: { paddingVertical: 4 },
  actionPrimary: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  actionDanger: {
    color: theme.colors.error,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
});
