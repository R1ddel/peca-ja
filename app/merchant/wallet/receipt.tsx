import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveMerchantApplication } from '@/utils/partners';
import { getShopByApplicationId } from '@/utils/merchantShop';
import {
  WalletEntry,
  WithdrawReceipt,
  getWallet,
  findWalletEntry,
  formatReceiptText,
  pixKeyTypeLabel,
  ensureWithdrawalReceipts,
} from '@/utils/merchantWallet';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';
import { formatOrderDateTime } from '@/utils/datetime';

export default function MerchantReceiptScreen() {
  const { user } = useAuth();
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const [entry, setEntry] = useState<WalletEntry | null>(null);
  const [receipt, setReceipt] = useState<WithdrawReceipt | null>(null);

  const refresh = useCallback(async () => {
    if (!entryId) return;
    const app = await resolveMerchantApplication(user?.email);
    if (!app) return;
    const shop = await getShopByApplicationId(app.id);
    if (!shop) return;
    await ensureWithdrawalReceipts(shop.businessId);
    const wallet = await getWallet(shop.businessId);
    const found = findWalletEntry(wallet, entryId);
    setEntry(found);
    setReceipt(found?.receipt ?? null);
  }, [user?.email, entryId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function copy() {
    if (!receipt) return;
    await Clipboard.setStringAsync(formatReceiptText(receipt));
    Alert.alert('Comprovante', 'Texto copiado.');
  }

  async function share() {
    if (!receipt) return;
    await Share.share({ message: formatReceiptText(receipt) });
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Comprovante" fallbackHref="/merchant/wallet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!receipt || !entry ? (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Comprovante não encontrado.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.stamp}>
                <Ionicons name="checkmark-circle" size={28} color="#059669" />
                <Text style={styles.stampTitle}>Transferência concluída</Text>
                <Text style={styles.stampSub}>Comprovante de saque Pix · Peça Já</Text>
              </View>

              <Text style={styles.amount}>{formatPrice(receipt.amount)}</Text>
              <Text style={styles.when}>{formatOrderDateTime(receipt.paidAt)}</Text>

              <View style={styles.divider} />

              <Row label="Comprovante" value={receipt.receiptId} mono />
              <Row label="Autenticação" value={receipt.authCode} mono />
              <Row label="ID da transação" value={receipt.endToEndId} mono />
              <Row label="Pagador" value={receipt.payerName} />
              <Row label="Recebedor" value={receipt.holderName} />
              <Row
                label="Chave Pix"
                value={`${pixKeyTypeLabel(receipt.pixKeyType)} · ${receipt.pixKey}`}
              />
              <Row label="Tipo" value="Saque da carteira do comércio" />

              <Text style={styles.footnote}>
                Este comprovante confirma o envio do valor para a chave Pix cadastrada.
                Guarde o código de autenticação para suas anotações.
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void copy()} activeOpacity={0.85}>
                <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.actionText}>Copiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void share()} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.actionText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </MobileShell>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  stamp: { alignItems: 'center', gap: 4, marginBottom: 4 },
  stampTitle: { fontWeight: '800', fontSize: theme.fontSize.md, color: theme.colors.text },
  stampSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  amount: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.5,
  },
  when: { textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 6,
  },
  row: { gap: 2 },
  rowLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowValue: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.2,
    fontSize: 12,
  },
  footnote: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionText: { color: theme.colors.primary, fontWeight: '700' },
});
