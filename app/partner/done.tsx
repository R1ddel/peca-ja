import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { MERCHANT_PLANS, MerchantPlan } from '@/constants/plans';
import { theme } from '@/constants/theme';

export default function PartnerDoneScreen() {
  const { role, plan, city, unlocked } = useLocalSearchParams<{
    role?: string;
    plan?: string;
    city?: string;
    unlocked?: string;
  }>();
  const isMerchant = role === 'merchant';
  const planKey = plan as MerchantPlan | undefined;
  const planInfo = planKey && MERCHANT_PLANS[planKey] ? MERCHANT_PLANS[planKey] : null;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={isMerchant && unlocked === '1' ? 'Painel liberado' : 'Candidatura enviada'}
        fallbackHref={isMerchant ? '/merchant' : '/driver'}
      />
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={isMerchant && unlocked === '1' ? 'rocket' : 'checkmark-circle'}
            size={48}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.title}>
          {isMerchant && unlocked === '1'
            ? 'Tudo certo — pode trabalhar'
            : isMerchant
              ? 'Cadastro registrado'
              : 'Recebemos seu cadastro'}
        </Text>
        <Text style={styles.text}>
          {isMerchant && unlocked === '1'
            ? 'Pagamento confirmado e termo aceito. Seu painel do comércio já está liberado — sem espera de aprovação manual.'
            : isMerchant
              ? 'Conclua pagamento e termo para liberar o painel automaticamente.'
              : 'Seu cadastro de entregador está em análise. Depois da aprovação, o painel de entregas é liberado.'}
        </Text>

        {isMerchant && planInfo && (
          <View style={styles.planBox}>
            <Text style={styles.planLabel}>Plano</Text>
            <Text style={styles.planName}>{planInfo.label}</Text>
            {!!city && <Text style={styles.planCity}>Cidade: {city}</Text>}
          </View>
        )}

        <Button
          title={isMerchant ? 'Abrir painel do comércio' : 'Abrir painel do entregador'}
          onPress={() =>
            router.replace((isMerchant ? '/merchant' : '/driver') as any)
          }
          size="lg"
          style={styles.btn}
        />
        <Button
          title="Voltar ao início"
          variant="outline"
          onPress={() => router.replace('/(tabs)')}
          size="lg"
        />
      </View>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  body: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  iconCircle: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  text: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  planBox: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  planLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  planName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  planCity: {
    marginTop: 4,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  btn: { marginBottom: theme.spacing.sm },
});
