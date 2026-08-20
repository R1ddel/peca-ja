import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import {
  MERCHANT_TERMS_TITLE,
  MERCHANT_TERMS_VERSION,
  buildMerchantTermsBody,
} from '@/constants/merchantTerms';
import { MERCHANT_PLANS, formatPlanPrice } from '@/constants/plans';
import {
  MerchantApplication,
  acceptMerchantTerms,
  getApplicationById,
  isMerchantPanelUnlocked,
  merchantOnboardingGate,
} from '@/utils/partners';
import { theme } from '@/constants/theme';

const GOVBR_SIGN_URL = 'https://www.gov.br/pt-br/servicos/assinatura-eletronica';

export default function PartnerTermsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [app, setApp] = useState<MerchantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readOk, setReadOk] = useState(false);
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerDoc, setSignerDoc] = useState('');
  const [govRef, setGovRef] = useState('');
  const [mode, setMode] = useState<'aceite' | 'govbr'>('aceite');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      const found = await getApplicationById(id);
      if (!cancelled && found?.role === 'merchant') {
        setApp(found);
        setSignerName(found.ownerName);
        setSignerDoc(found.document || '');
        const gate = merchantOnboardingGate(found);
        if (gate === 'plan') {
          router.replace({ pathname: '/partner/plans' as any, params: { id } });
        } else if (gate === 'pay') {
          // Ainda não pagou — não fica no termo
          router.replace({ pathname: '/partner/pay' as any, params: { id } });
        }
        // Se já pagou (terms/ready), fica aqui e pode voltar aos planos.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const termsBody = useMemo(() => {
    if (!app?.plan) return '';
    const plan = MERCHANT_PLANS[app.plan];
    return buildMerchantTermsBody({
      businessName: app.businessName,
      ownerName: app.ownerName,
      planLabel: plan.label,
      planPrice: formatPlanPrice(plan.monthlyPrice),
      city: app.planCity || 'sua cidade',
      document: app.document,
    });
  }, [app]);

  async function finish(method: 'aceite_eletronico' | 'govbr') {
    if (!id) return;
    if (!readOk || !agree) {
      Alert.alert('Termo', 'Leia o termo e marque que concorda para continuar.');
      return;
    }
    if (!signerName.trim()) {
      Alert.alert('Identificação', 'Informe o nome completo de quem está aceitando/assinando.');
      return;
    }
    if (method === 'govbr' && !govRef.trim()) {
      Alert.alert(
        'Gov.br',
        'Informe o protocolo/código da assinatura no Gov.br (ou o comprovante) para registrarmos.'
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await acceptMerchantTerms(id, {
        method,
        signerName,
        signerDocument: signerDoc,
        govBrRef: method === 'govbr' ? govRef : undefined,
      });
      if (!updated || !isMerchantPanelUnlocked(updated)) {
        Alert.alert(
          'Quase lá',
          'O termo foi registrado, mas o painel só libera com pagamento confirmado. Volte ao pagamento se necessário.'
        );
        return;
      }
      router.push({
        pathname: '/partner/done' as any,
        params: {
          role: 'merchant',
          id,
          plan: updated.plan,
          city: updated.planCity,
          unlocked: '1',
        },
      });
    } finally {
      setSaving(false);
    }
  }

  async function openGovBr() {
    try {
      await Linking.openURL(GOVBR_SIGN_URL);
    } catch {
      Alert.alert('Gov.br', 'Não foi possível abrir o portal. Tente pelo navegador: gov.br');
    }
  }

  if (loading) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader
          title="Termo de compromisso"
          fallbackHref={id ? `/partner/plans?id=${encodeURIComponent(id)}` : '/partner/plans'}
        />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </MobileShell>
    );
  }

  if (!app?.plan) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Termo de compromisso" fallbackHref="/partner/plans" />
        <View style={styles.center}>
          <Text style={styles.muted}>Complete o cadastro e o pagamento antes do termo.</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title="Termo de compromisso"
        fallbackHref={id ? `/partner/plans?id=${encodeURIComponent(id)}` : '/partner/plans'}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.backPlans}
          onPress={() =>
            router.push({ pathname: '/partner/plans' as any, params: { id } })
          }
        >
          <Ionicons name="grid-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.backPlansText}>Voltar aos planos</Text>
        </TouchableOpacity>

        {app.paymentStatus === 'paid' && (
          <TouchableOpacity
            style={styles.backPay}
            onPress={() =>
              router.push({ pathname: '/partner/pay' as any, params: { id } })
            }
          >
            <Ionicons name="card-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.backPayText}>Ver recibo / pagamento</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.kicker}>Pagamento confirmado · etapa final</Text>
        <Text style={styles.title}>{MERCHANT_TERMS_TITLE}</Text>
        <Text style={styles.version}>Versão {MERCHANT_TERMS_VERSION} · Lei brasileira</Text>
        <Text style={styles.lead}>
          Este termo vincula o comerciante às obrigações legais e operacionais no Peça Já. Sem o
          aceite (ou assinatura Gov.br), o painel não é liberado.
        </Text>

        <View style={styles.termBox}>
          <ScrollView nestedScrollEnabled style={styles.termScroll} showsVerticalScrollIndicator>
            <Text style={styles.termText} selectable>
              {termsBody}
            </Text>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setReadOk((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: readOk }}
        >
          <Ionicons
            name={readOk ? 'checkbox' : 'square-outline'}
            size={22}
            color={theme.colors.primary}
          />
          <Text style={styles.checkText}>Li integralmente o termo acima</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgree((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
        >
          <Ionicons
            name={agree ? 'checkbox' : 'square-outline'}
            size={22}
            color={theme.colors.primary}
          />
          <Text style={styles.checkText}>
            Concordo e me responsabilizo perante a legislação brasileira e o Peça Já
          </Text>
        </TouchableOpacity>

        <Input
          label="Nome completo do responsável *"
          value={signerName}
          onChangeText={setSignerName}
          icon="person-outline"
        />
        <Input
          label="CPF / CNPJ"
          value={signerDoc}
          onChangeText={setSignerDoc}
          icon="document-text-outline"
          keyboardType="number-pad"
        />

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'aceite' && styles.modeChipOn]}
            onPress={() => setMode('aceite')}
          >
            <Text style={[styles.modeChipText, mode === 'aceite' && styles.modeChipTextOn]}>
              Aceite eletrônico
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'govbr' && styles.modeChipOn]}
            onPress={() => setMode('govbr')}
          >
            <Text style={[styles.modeChipText, mode === 'govbr' && styles.modeChipTextOn]}>
              Assinar no Gov.br
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'aceite' ? (
          <>
            <Text style={styles.modeHint}>
              Aceite eletrônico simples (Lei 14.063/2020 / MP 2.200-2): registramos data, hora,
              versão do termo e sua identificação neste dispositivo.
            </Text>
            <Button
              title="Concordo e liberar meu painel"
              onPress={() => void finish('aceite_eletronico')}
              loading={saving}
              size="lg"
              disabled={!readOk || !agree}
            />
          </>
        ) : (
          <>
            <Text style={styles.modeHint}>
              Abra o Gov.br, assine o termo (ou anexe/registre a assinatura eletrônica) e volte
              com o protocolo para gravarmos no Peça Já.
            </Text>
            <Button
              title="Abrir assinatura Gov.br"
              variant="outline"
              onPress={() => void openGovBr()}
              style={{ marginBottom: theme.spacing.sm }}
            />
            <Input
              label="Protocolo / referência Gov.br *"
              placeholder="Código ou comprovante da assinatura"
              value={govRef}
              onChangeText={setGovRef}
              icon="key-outline"
            />
            <Button
              title="Confirmar assinatura Gov.br e liberar painel"
              onPress={() => void finish('govbr')}
              loading={saving}
              size="lg"
              disabled={!readOk || !agree}
            />
          </>
        )}

        <Text style={styles.legalNote}>
          Este documento é um termo operacional baseado na legislação brasileira. Para escala
          nacional, recomenda-se revisão jurídica formal do escritório de sua preferência.
        </Text>
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  backPlans: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
  },
  backPlansText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  backPay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
    paddingVertical: 4,
  },
  backPayText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  kicker: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    lineHeight: 24,
  },
  version: {
    marginTop: 4,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  lead: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  termBox: {
    height: 280,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  termScroll: { padding: theme.spacing.md },
  termText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 18,
    fontFamily: undefined,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  checkText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm, marginTop: 4 },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  modeChipOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  modeChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  modeChipTextOn: { color: theme.colors.primaryDark },
  modeHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginBottom: theme.spacing.md,
  },
  legalNote: {
    marginTop: theme.spacing.lg,
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
  },
});
