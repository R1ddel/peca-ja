import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { getStaffSession, staffCan } from '@/utils/merchantTeam';
import {
  MerchantWallet,
  WALLET_MIN_WITHDRAW,
  availableBalance,
  canRequestWithdraw,
  getWallet,
  findWalletEntry,
  resolvePixDocument,
  pixKeyTypeLabel,
} from '@/utils/merchantWallet';
import { executeMerchantWithdraw, pollWithdrawStatus } from '@/services/merchantWithdraw';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';

function parseBrl(raw: string): number {
  const t = raw.trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function MerchantWithdrawScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const refresh = useCallback(async () => {
    const sess = await getStaffSession();
    const ok = !sess || staffCan(sess.role, 'withdraw');
    setAllowed(ok);
    if (!ok) {
      Alert.alert('Saque', 'Só dono ou gerente podem sacar.', [
        { text: 'Voltar', onPress: () => router.replace('/merchant/wallet' as any) },
      ]);
      return;
    }

    const { app, shop } = await resolveOperatorMerchantContext(user?.email);
    if (!app || !shop) return;
    setAppId(app.id);
    setBusinessId(shop.businessId);
    setWallet(await getWallet(shop.businessId));
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const balance = availableBalance(wallet);
  const document = resolvePixDocument(wallet);

  function fillAll() {
    setAmountStr(balance.toFixed(2).replace('.', ','));
  }

  async function submit() {
    if (!allowed) {
      Alert.alert('Saque', 'Só dono ou gerente podem sacar.');
      return;
    }
    if (!businessId || !appId || !wallet?.pixKey || !wallet.pixKeyType) return;
    if (!document) {
      Alert.alert('Saque', 'Cadastre o CPF/CNPJ do titular na chave Pix.', [
        { text: 'Abrir Pix', onPress: () => router.push('/merchant/wallet/pix' as any) },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    const amount = parseBrl(amountStr);
    const check = canRequestWithdraw(wallet, amount);
    if (!check.ok) {
      Alert.alert('Saque', check.error);
      return;
    }

    Alert.alert(
      'Confirmar saque',
      `Enviar ${formatPrice(amount)} via Pix para ${pixKeyTypeLabel(wallet.pixKeyType)} ${wallet.pixKey}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sacar',
          onPress: () => {
            void (async () => {
              setSubmitting(true);
              try {
                const { wallet: next, entryId, api } = await executeMerchantWithdraw({
                  businessId,
                  applicationId: appId,
                  amount,
                  pixKey: wallet.pixKey!,
                  pixKeyType: wallet.pixKeyType!,
                  holderName: wallet.pixHolderName || 'Titular Pix',
                  document,
                });
                setWallet(next);

                if (!api.ok) {
                  Alert.alert('Saque', api.message || 'Não foi possível sacar.');
                  return;
                }

                let current = next;
                let status = api.status;
                const payoutId =
                  api.payoutId ||
                  findWalletEntry(current, entryId)?.mpPayoutId ||
                  entryId;

                if (status !== 'paid' && status !== 'failed' && payoutId) {
                  for (let i = 0; i < 8; i++) {
                    await sleep(1500);
                    const polled = await pollWithdrawStatus({
                      businessId,
                      entryId,
                      payoutId,
                    });
                    if (polled.wallet) {
                      current = polled.wallet;
                      setWallet(current);
                    }
                    status = polled.api.status || status;
                    if (status === 'paid' || status === 'failed') break;
                  }
                }

                const entry = findWalletEntry(current, entryId);
                if (entry?.status === 'paid' || status === 'paid') {
                  Alert.alert(
                    api.simulated ? 'Pix simulado' : 'Pix enviado',
                    api.simulated
                      ? `${formatPrice(amount)} liquidado em modo simulação (MP_PAYOUT_MODE=simulate).`
                      : `${formatPrice(amount)} enviado via Mercado Pago para ${pixKeyTypeLabel(wallet.pixKeyType!)} ${wallet.pixKey}.`,
                    [
                      {
                        text: 'Ver comprovante',
                        onPress: () =>
                          router.replace({
                            pathname: '/merchant/wallet/receipt' as any,
                            params: { entryId },
                          }),
                      },
                      {
                        text: 'OK',
                        onPress: () => router.replace('/merchant/wallet' as any),
                      },
                    ]
                  );
                  return;
                }

                if (entry?.status === 'failed' || status === 'failed') {
                  Alert.alert(
                    'Saque falhou',
                    entry?.failReason || api.message || 'O Mercado Pago recusou o Pix-out.'
                  );
                  return;
                }

                Alert.alert(
                  'Saque em processamento',
                  'O Mercado Pago ainda está liquidando. Acompanhe no extrato da carteira.',
                  [{ text: 'OK', onPress: () => router.replace('/merchant/wallet' as any) }]
                );
              } catch (e: any) {
                Alert.alert('Saque', e?.message ?? 'Não foi possível sacar.');
              } finally {
                setSubmitting(false);
              }
            })();
          },
        },
      ]
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Pedir saque" fallbackHref="/merchant/wallet" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={styles.balCard}>
          <Text style={styles.balLabel}>Disponível agora</Text>
          <Text style={styles.balValue}>{formatPrice(balance)}</Text>
          <Text style={styles.balHint}>
            Mínimo {formatPrice(WALLET_MIN_WITHDRAW)} · 1 saque por dia · Pix real via Mercado Pago
          </Text>
        </View>

        {!wallet?.pixKey ? (
          <TouchableOpacity
            style={styles.warn}
            onPress={() => router.push('/merchant/wallet/pix' as any)}
          >
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.warnText}>Cadastre sua chave Pix para sacar</Text>
          </TouchableOpacity>
        ) : !document ? (
          <TouchableOpacity
            style={styles.warn}
            onPress={() => router.push('/merchant/wallet/pix' as any)}
          >
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.warnText}>Falta CPF/CNPJ do titular na chave Pix</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.pixBox}>
            <Text style={styles.pixLbl}>Destino</Text>
            <Text style={styles.pixVal}>
              {pixKeyTypeLabel(wallet.pixKeyType!)} · {wallet.pixKey}
            </Text>
            {wallet.pixHolderName ? (
              <Text style={styles.pixName}>{wallet.pixHolderName}</Text>
            ) : null}
            <Text style={styles.pixName}>
              Doc · {document.length === 14 ? 'CNPJ' : 'CPF'} {document}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Valor do saque</Text>
        <View style={styles.inputRow}>
          <Text style={styles.currency}>R$</Text>
          <TextInput
            style={styles.input}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity onPress={fillAll} style={styles.allBtn}>
            <Text style={styles.allBtnText}>Tudo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.submit,
            (submitting || !wallet?.pixKey || !document) && styles.submitOff,
          ]}
          onPress={() => void submit()}
          disabled={submitting || !wallet?.pixKey || !document}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>{submitting ? 'Enviando Pix…' : 'Confirmar saque'}</Text>
        </TouchableOpacity>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  balCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  balLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  balValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 4,
  },
  balHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
  },
  warnText: { flex: 1, color: '#92400E', fontWeight: '600', fontSize: theme.fontSize.sm },
  pixBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  pixLbl: { color: theme.colors.textMuted, fontSize: 11 },
  pixVal: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm },
  pixName: { color: theme.colors.textMuted, fontSize: 12 },
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    gap: 8,
  },
  currency: { fontWeight: '700', color: theme.colors.textMuted },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  allBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '18',
  },
  allBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  submit: {
    marginTop: 8,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitOff: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
});
