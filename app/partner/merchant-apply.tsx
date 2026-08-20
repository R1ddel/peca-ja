import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { getApplicationById, submitMerchantApplication } from '@/utils/partners';
import { theme } from '@/constants/theme';
import { PLATFORM_FEE_MERCHANT_NOTICE } from '@/constants/pricing';

const CATEGORIES = [
  'Restaurante',
  'Mercado',
  'Farmácia',
  'Padaria',
  'Bebidas',
  'Conveniência',
  'Outro',
];

export default function MerchantApplyScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [ownerName, setOwnerName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Restaurante');
  const [address, setAddress] = useState(user?.address ?? '');
  const [document, setDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(!editId);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const app = await getApplicationById(editId);
      if (cancelled || !app || app.role !== 'merchant') {
        if (!cancelled) setHydrated(true);
        return;
      }
      setOwnerName(app.ownerName);
      setEmail(app.email);
      setPhone(app.phone);
      setBusinessName(app.businessName);
      setCategory(app.category || 'Restaurante');
      setAddress(app.address);
      setDocument(app.document || '');
      setNotes(app.notes || '');
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const result = await submitMerchantApplication({
      ownerName,
      email,
      phone,
      businessName,
      category,
      address,
      document,
      notes,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!isEdit) {
      Alert.alert('Cadastro recebido', PLATFORM_FEE_MERCHANT_NOTICE, [
        {
          text: 'Entendi',
          onPress: () => {
            router.push({
              pathname: '/partner/plans' as any,
              params: { id: result.application.id },
            });
          },
        },
      ]);
      return;
    }
    router.push({
      pathname: '/partner/plans' as any,
      params: { id: result.application.id },
    });
  }

  const isEdit = !!editId;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={isEdit ? 'Alterar cadastro' : 'Cadastro comércio'}
        fallbackHref="/partner"
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            {isEdit
              ? 'Ajuste os dados da loja e volte aos planos e termos quando quiser.'
              : 'Preencha os dados da loja. Em seguida você vê os planos Peça Já e o termo de compromisso.'}
          </Text>

          {!hydrated ? (
            <Text style={styles.loading}>Carregando dados…</Text>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Input
                label="Seu nome *"
                placeholder="Responsável pela loja"
                icon="person-outline"
                value={ownerName}
                onChangeText={setOwnerName}
              />
              <Input
                label="E-mail *"
                placeholder="loja@email.com"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="WhatsApp / telefone *"
                placeholder="(75) 99999-9999"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Nome do comércio *"
                placeholder="Ex.: Cantina da Praça"
                icon="storefront-outline"
                value={businessName}
                onChangeText={setBusinessName}
              />

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <Button
                      key={c}
                      title={c}
                      variant={on ? 'primary' : 'outline'}
                      size="sm"
                      onPress={() => setCategory(c)}
                      style={styles.chip}
                    />
                  );
                })}
              </View>

              <Input
                label="Endereço da loja *"
                placeholder="Rua, número, bairro"
                icon="location-outline"
                value={address}
                onChangeText={setAddress}
              />
              <Input
                label="CPF ou CNPJ"
                placeholder="Somente números"
                icon="document-text-outline"
                value={document}
                onChangeText={setDocument}
                keyboardType="number-pad"
              />
              <Input
                label="Observações"
                placeholder="Horário, especialidade, etc. (opcional)"
                icon="chatbubble-outline"
                value={notes}
                onChangeText={setNotes}
              />

              <View style={styles.feeNote}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.feeNoteText}>{PLATFORM_FEE_MERCHANT_NOTICE}</Text>
              </View>

              <Button
                title={isEdit ? 'Salvar e voltar aos planos' : 'Continuar para planos e termos'}
                onPress={() => void handleSubmit()}
                loading={loading}
                size="lg"
                style={styles.submit}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  lead: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  loading: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  chip: { marginBottom: 0 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: { color: theme.colors.error, fontSize: theme.fontSize.sm, flex: 1 },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  feeNoteText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
  submit: { marginTop: theme.spacing.sm },
});
