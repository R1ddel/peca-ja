import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { theme } from '@/constants/theme';

export default function PartnerHubScreen() {
  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Seja parceiro" fallbackHref="/(auth)/login" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Trabalhe com o Peça Já</Text>
        <Text style={styles.subtitle}>
          Cadastro simples. Nossa equipe analisa e libera o painel — na cidade onde você estiver.
        </Text>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push('/partner/merchant-apply' as any)}
          accessibilityRole="button"
          accessibilityLabel="Sou comércio"
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons name="storefront-outline" size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou comércio</Text>
            <Text style={styles.cardHint}>
              Cadastre sua loja, cardápio e receba pedidos no painel do comerciante.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push('/driver/login' as any)}
          accessibilityRole="button"
          accessibilityLabel="Sou entregador"
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSoft }]}>
            <Ionicons name="bicycle-outline" size={28} color={theme.colors.warning} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou entregador</Text>
            <Text style={styles.cardHint}>
              Login, cadastro da moto/CNH e termo de responsabilidade no painel.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          O cadastro de cliente (pedir comida) continua em “Cadastre-se” na tela de login.
        </Text>
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  footerNote: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
});
