import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { syncPayoutProfile } from '@/services/orderLedgerClient';
import {
  MerchantWallet,
  PixKeyType,
  getWallet,
  savePixKey,
  pixKeyTypeLabel,
} from '@/utils/merchantWallet';
import { theme } from '@/constants/theme';

const TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'phone', 'random'];

export default function MerchantPixScreen() {
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [holder, setHolder] = useState('');
  const [document, setDocument] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { app, shop } = await resolveOperatorMerchantContext(user?.email);
    if (!app || !shop) return;
    setAppId(app.id);
    setBusinessId(shop.businessId);
    const w = await getWallet(shop.businessId);
    setWallet(w);
    if (w?.pixKeyType) setPixKeyType(w.pixKeyType);
    if (w?.pixKey) setPixKey(w.pixKey);
    if (w?.pixHolderName) setHolder(w.pixHolderName);
    else if (app.ownerName) setHolder(app.ownerName);
    else if (app.businessName) setHolder(app.businessName);
    if (w?.pixDocument) setDocument(w.pixDocument);
    else if (app.document) setDocument(String(app.document).replace(/\D/g, ''));
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function save() {
    if (!businessId || !appId) {
      Alert.alert('Chave Pix', 'Abra a carteira da loja e tente de novo.');
      return;
    }
    setSaving(true);
    try {
      const next = await savePixKey({
        businessId,
        applicationId: appId,
        pixKey,
        pixKeyType,
        pixHolderName: holder,
        pixDocument: document,
      });
      if (next.pixKey && next.pixKeyType && next.pixDocument) {
        await syncPayoutProfile({
          ownerType: 'merchant',
          ownerId: businessId,
          pixKey: next.pixKey,
          pixKeyType: next.pixKeyType,
          holderName: next.pixHolderName || holder,
          document: next.pixDocument,
        });
      }
      setWallet(next);
      router.replace('/merchant/wallet' as any);
      return;
    } catch (e: any) {
      Alert.alert('Chave Pix', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Chave Pix" fallbackHref="/merchant/wallet" />
      <KeyboardScreen contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Cadastre uma vez a chave onde a loja recebe os saques. Os valores creditados
            dos pedidos confirmados saem daqui via Pix.
          </Text>

          <Text style={styles.label}>Tipo da chave</Text>
          <View style={styles.types}>
            {TYPES.map((t) => {
              const on = pixKeyType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, on && styles.typeChipOn]}
                  onPress={() => setPixKeyType(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.typeText, on && styles.typeTextOn]}>
                    {pixKeyTypeLabel(t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Chave</Text>
          <TextInput
            style={styles.input}
            value={pixKey}
            onChangeText={setPixKey}
            placeholder={
              pixKeyType === 'email'
                ? 'loja@email.com'
                : pixKeyType === 'phone'
                  ? '11999999999'
                  : pixKeyType === 'cpf'
                    ? '00000000000'
                    : pixKeyType === 'cnpj'
                      ? '00000000000000'
                      : 'chave-aleatoria'
            }
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType={
              pixKeyType === 'email'
                ? 'email-address'
                : pixKeyType === 'phone' || pixKeyType === 'cpf' || pixKeyType === 'cnpj'
                  ? 'number-pad'
                  : 'default'
            }
          />

          <Text style={styles.label}>Nome do titular</Text>
          <TextInput
            style={styles.input}
            value={holder}
            onChangeText={setHolder}
            placeholder="Como no banco / Pix"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>CPF ou CNPJ do titular</Text>
          <TextInput
            style={styles.input}
            value={document}
            onChangeText={setDocument}
            placeholder="Somente números"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
          />
          <Text style={styles.docHint}>
            Obrigatório para o Mercado Pago enviar o Pix-out. Se a chave for CPF/CNPJ, pode repetir
            o mesmo número.
          </Text>

          {wallet?.pixKey ? (
            <Text style={styles.current}>
              Atual: {pixKeyTypeLabel(wallet.pixKeyType!)} · {wallet.pixKey}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.save, saving && styles.saveOff]}
            onPress={() => void save()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar chave Pix'}</Text>
          </TouchableOpacity>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  intro: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
    marginBottom: 4,
  },
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 6 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeChipOn: {
    backgroundColor: theme.colors.primary + '18',
    borderColor: theme.colors.primary,
  },
  typeText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  typeTextOn: { color: theme.colors.primary },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  current: { color: theme.colors.textMuted, fontSize: 12 },
  docHint: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: -4 },
  save: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveOff: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
});
