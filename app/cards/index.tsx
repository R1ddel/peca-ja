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
import { router, useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  SavedCard,
  brandLabel,
  loadSavedCards,
  maskCardLabel,
  registerGhostTestCard,
  removeSavedCard,
  setDefaultCard,
} from '@/services/cards';

export default function CardsScreen() {
  const { user } = useAuth();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const refresh = useCallback(async () => {
    const list = await loadSavedCards();
    setCards(list);
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

  function confirmRemove(card: SavedCard) {
    Alert.alert('Remover cartão', `Remover ${maskCardLabel(card)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const next = await removeSavedCard(card.id);
          setCards(next);
        },
      },
    ]);
  }

  async function makeDefault(card: SavedCard) {
    const next = await setDefaultCard(card.id);
    setCards(next);
  }

  async function addGhostCard() {
    if (!user?.email) {
      Alert.alert('Login necessário', 'Entre na conta para cadastrar o cartão de teste.');
      return;
    }
    setSeeding(true);
    try {
      const result = await registerGhostTestCard(user.email);
      if (!result.ok) {
        Alert.alert('Não deu para cadastrar', result.error);
        return;
      }
      await refresh();
      Alert.alert(
        'Cartão fantasma pronto',
        `Mastercard •••• ${result.card.last4}\n\nNo checkout, use o CVV de teste: 123`
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <View style={styles.screen}>
      <BackHeader title="Meus cartões" fallbackHref="/(tabs)/profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <Text style={styles.hint}>
          Cartões ficam salvos neste aparelho sem número completo nem CVV — só o token do
          Mercado Pago. O pedido só confirma depois que o banco aprovar a cobrança.
        </Text>

        {loading ? (
          <Text style={styles.emptyText}>Carregando…</Text>
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum cartão cadastrado</Text>
            <Text style={styles.emptyText}>
              Cadastre um cartão de crédito ou débito para pagar no checkout.
            </Text>
          </View>
        ) : (
          cards.map((card) => (
            <View key={card.id} style={[styles.card, card.isDefault && styles.cardDefault]}>
              <View style={styles.cardTop}>
                <Ionicons name="card" size={22} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardBrand}>
                    {brandLabel(card.brand)}
                    {card.isGhostTest ? ' · teste' : ''}
                  </Text>
                  <Text style={styles.cardNumber}>•••• {card.last4}</Text>
                </View>
                {card.isDefault && (
                  <View style={styles.defaultPill}>
                    <Text style={styles.defaultPillText}>Padrão</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardMeta}>
                {card.holderName} · {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                {' · '}
                {card.kind === 'credit' ? 'Crédito' : 'Débito'}
              </Text>
              <View style={styles.cardActions}>
                {!card.isDefault && (
                  <TouchableOpacity onPress={() => makeDefault(card)} style={styles.actionBtn}>
                    <Text style={styles.actionPrimary}>Definir padrão</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => confirmRemove(card)} style={styles.actionBtn}>
                  <Text style={styles.actionDanger}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {__DEV__ && (
          <Button
            title={seeding ? 'Cadastrando cartão fantasma…' : 'Cadastrar cartão fantasma (teste)'}
            onPress={addGhostCard}
            loading={seeding}
            variant="outline"
            size="lg"
            style={{ marginTop: theme.spacing.lg }}
          />
        )}
        <Button
          title="Cadastrar cartão"
          onPress={() => router.push('/cards/add' as any)}
          size="lg"
          style={{ marginTop: theme.spacing.sm }}
        />
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
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
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
    marginTop: theme.spacing.sm,
    lineHeight: 22,
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardBrand: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardNumber: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
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
  cardMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
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
