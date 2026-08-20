import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { getStaffSession, staffCan } from '@/utils/merchantTeam';
import {
  MerchantWallet,
  WalletEntry,
  WALLET_MIN_WITHDRAW,
  WALLET_MAX_WITHDRAWS_PER_DAY,
  availableBalance,
  totalCredited,
  totalWithdrawn,
  syncWalletFromOrders,
  withdrawalsToday,
  entrySignedAmount,
  withdrawalStatusLabel,
  pixKeyTypeLabel,
  canRequestWithdraw,
  ensureWithdrawalReceipts,
} from '@/utils/merchantWallet';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';
import { formatOrderDateTime } from '@/utils/datetime';
import { platformLedgerList } from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';

function maskPix(key: string | null) {
  if (!key) return 'Não cadastrada';
  if (key.length <= 6) return key;
  return `${key.slice(0, 3)}••••${key.slice(-3)}`;
}

export default function MerchantWalletScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [shopName, setShopName] = useState('');
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [ledgerBalance, setLedgerBalance] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const sess = await getStaffSession();
    setCanWithdraw(!sess || staffCan(sess.role, 'withdraw'));

    const { app, shop } = await resolveOperatorMerchantContext(user?.email);
    if (!app || !shop) {
      setWallet(null);
      setLedgerBalance(null);
      return;
    }
    setShopName(shop.name);
    const mine = orders.filter((o) => o.businessId === shop.businessId);
    let next = await syncWalletFromOrders(shop.businessId, app.id, mine);
    next = (await ensureWithdrawalReceipts(shop.businessId)) ?? next;
    setWallet(next);

    const token = await getPlatformToken();
    if (token) {
      const led = await platformLedgerList('merchant', shop.businessId, token);
      if (led && led.ok && typeof (led as any).balance === 'number') {
        setLedgerBalance(Number((led as any).balance));
      } else {
        setLedgerBalance(null);
      }
    } else {
      setLedgerBalance(null);
    }
  }, [user?.email, orders]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const balance = availableBalance(wallet);
  const displayBalance = ledgerBalance != null ? ledgerBalance : balance;
  const credited = totalCredited(wallet);
  const withdrawn = totalWithdrawn(wallet);
  const todayCount = withdrawalsToday(wallet);
  const withdrawGate = canRequestWithdraw(
    wallet,
    Math.min(displayBalance, Math.max(WALLET_MIN_WITHDRAW, displayBalance))
  );

  const entries = useMemo(() => wallet?.entries ?? [], [wallet]);

  function onWithdraw() {
    if (!canWithdraw) {
      Alert.alert('Saque', 'Só dono ou gerente podem pedir saque.');
      return;
    }
    if (!wallet?.pixKey) {
      Alert.alert('Chave Pix', 'Cadastre sua chave Pix antes de sacar.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cadastrar',
          onPress: () => router.push('/merchant/wallet/pix' as any),
        },
      ]);
      return;
    }
    if (balance < WALLET_MIN_WITHDRAW) {
      Alert.alert(
        'Saldo baixo',
        `Saque mínimo de ${formatPrice(WALLET_MIN_WITHDRAW)}. Seu saldo é ${formatPrice(displayBalance)}.`
      );
      return;
    }
    if (todayCount >= WALLET_MAX_WITHDRAWS_PER_DAY) {
      Alert.alert('Limite diário', 'Você já fez o saque de hoje. Tente novamente amanhã.');
      return;
    }
    router.push('/merchant/wallet/withdraw' as any);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Saldo e saque" fallbackHref="/merchant" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Saldo disponível</Text>
          <Text style={styles.heroValue}>{formatPrice(displayBalance)}</Text>
          <Text style={styles.heroSub}>
            {ledgerBalance != null
              ? 'Fonte: ledger do servidor (saque usa este saldo)'
              : 'Fonte: carteira local — faça login na API para sincronizar'}
          </Text>
          <Text style={styles.heroShop}>{shopName || 'Sua loja'}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{formatPrice(credited)}</Text>
              <Text style={styles.heroStatLbl}>Creditado</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{formatPrice(withdrawn)}</Text>
              <Text style={styles.heroStatLbl}>Já sacado</Text>
            </View>
          </View>
        </View>

        {canWithdraw ? (
          <>
            <TouchableOpacity
              style={[styles.withdrawBtn, balance < WALLET_MIN_WITHDRAW && styles.withdrawBtnOff]}
              onPress={onWithdraw}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up-circle" size={22} color="#fff" />
              <Text style={styles.withdrawBtnText}>Pedir saque</Text>
            </TouchableOpacity>
            {!withdrawGate.ok && balance >= WALLET_MIN_WITHDRAW ? (
              <Text style={styles.withdrawHint}>{withdrawGate.error}</Text>
            ) : (
              <Text style={styles.withdrawHint}>
                Saque a qualquer momento · mínimo {formatPrice(WALLET_MIN_WITHDRAW)} ·{' '}
                {WALLET_MAX_WITHDRAWS_PER_DAY}x por dia
              </Text>
            )}
          </>
        ) : (
          <View style={styles.lockBox}>
            <Ionicons name="lock-closed" size={18} color="#92400E" />
            <Text style={styles.lockText}>
              Saque liberado só para dono ou gerente. Você pode ver o saldo.
            </Text>
          </View>
        )}

        {canWithdraw ? (
          <TouchableOpacity
            style={styles.pixCard}
            onPress={() => router.push('/merchant/wallet/pix' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.pixIcon}>
              <Ionicons name="qr-code-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pixTitle}>Chave Pix</Text>
              <Text style={styles.pixValue}>
                {wallet?.pixKeyType
                  ? `${pixKeyTypeLabel(wallet.pixKeyType)} · ${maskPix(wallet.pixKey)}`
                  : 'Cadastre para receber saques'}
              </Text>
              {wallet?.pixHolderName ? (
                <Text style={styles.pixHolder}>{wallet.pixHolderName}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.pixCard}>
            <View style={styles.pixIcon}>
              <Ionicons name="qr-code-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pixTitle}>Chave Pix</Text>
              <Text style={styles.pixValue}>
                {wallet?.pixKeyType
                  ? `${pixKeyTypeLabel(wallet.pixKeyType)} · ${maskPix(wallet.pixKey)}`
                  : 'Não cadastrada'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>Como funciona</Text>
          <Rule
            icon="checkmark-circle-outline"
            text="O valor da loja (establishment) entra no saldo assim que o pedido é confirmado para o cliente."
          />
          <Rule
            icon="flash-outline"
            text="Não há depósito: o saldo nasce só das vendas. Saque quando quiser (sem espera D+1)."
          />
          <Rule
            icon="cash-outline"
            text={`Mínimo de ${formatPrice(WALLET_MIN_WITHDRAW)} por saque e no máximo ${WALLET_MAX_WITHDRAWS_PER_DAY} saque por dia.`}
          />
          <Rule
            icon="key-outline"
            text="É preciso ter uma chave Pix cadastrada (uma vez) para pedir saque."
          />
          <Rule
            icon="close-circle-outline"
            text="Se o pedido for cancelado depois de confirmado, o crédito é estornado do saldo."
          />
          <Rule
            icon="list-outline"
            text="Cada saque pago gera um comprovante no extrato (código, autenticação e chave Pix), para copiar ou compartilhar."
          />
        </View>

        <Text style={styles.sectionTitle}>Extrato</Text>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={36} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum lançamento ainda</Text>
            <Text style={styles.emptyText}>
              Quando um pedido for confirmado, o valor da loja aparece aqui.
            </Text>
          </View>
        ) : (
          entries.map((item) => <EntryRow key={item.id} entry={item} />)
        )}
      </ScrollView>
    </MobileShell>
  );
}

function Rule({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

function EntryRow({ entry }: { entry: WalletEntry }) {
  const signed = entrySignedAmount(entry);
  const positive = signed > 0;
  const zero = signed === 0;
  const tone =
    entry.type === 'withdrawal'
      ? entry.status === 'failed'
        ? theme.colors.textMuted
        : '#DC2626'
      : entry.type === 'reversal'
        ? '#DC2626'
        : '#059669';
  const hasReceipt = entry.type === 'withdrawal' && entry.status === 'paid' && !!entry.receipt;

  return (
    <View style={styles.entry}>
      <View
        style={[
          styles.entryIcon,
          {
            backgroundColor:
              entry.type === 'credit'
                ? '#05966918'
                : entry.type === 'withdrawal'
                  ? '#3B82F618'
                  : '#DC262618',
          },
        ]}
      >
        <Ionicons
          name={
            entry.type === 'credit'
              ? 'arrow-down'
              : entry.type === 'withdrawal'
                ? 'arrow-up'
                : 'return-down-back'
          }
          size={18}
          color={
            entry.type === 'credit'
              ? '#059669'
              : entry.type === 'withdrawal'
                ? '#3B82F6'
                : '#DC2626'
          }
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>{entry.description}</Text>
        <Text style={styles.entryWhen}>{formatOrderDateTime(entry.createdAt)}</Text>
        {entry.type === 'withdrawal' && entry.status ? (
          <Text
            style={[
              styles.entryStatus,
              entry.status === 'paid' && { color: '#059669' },
              entry.status === 'failed' && { color: '#DC2626' },
              entry.status === 'pending' && { color: '#D97706' },
            ]}
          >
            {withdrawalStatusLabel(entry.status)}
            {entry.receipt ? ` · ${entry.receipt.receiptId}` : ''}
          </Text>
        ) : null}
        {hasReceipt ? (
          <TouchableOpacity
            style={styles.receiptBtn}
            onPress={() =>
              router.push({
                pathname: '/merchant/wallet/receipt' as any,
                params: { entryId: entry.id },
              })
            }
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.receiptBtnText}>Ver comprovante</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[styles.entryAmount, { color: zero ? theme.colors.textMuted : tone }]}>
        {zero ? formatPrice(0) : `${positive ? '+' : '−'}${formatPrice(Math.abs(signed))}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: theme.fontSize.sm },
  heroValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },
  heroShop: { color: 'rgba(255,255,255,0.75)', fontSize: theme.fontSize.sm, marginBottom: 8 },
  heroStats: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  heroStat: { flex: 1, gap: 2 },
  heroStatDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 12 },
  heroStatVal: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  heroStatLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
  },
  withdrawBtnOff: { opacity: 0.55 },
  withdrawBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  withdrawHint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: -4,
  },
  lockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  lockText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  pixCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pixIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixTitle: { fontWeight: '700', color: theme.colors.text, fontSize: theme.fontSize.sm },
  pixValue: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  pixHolder: { color: theme.colors.text, fontSize: theme.fontSize.xs, marginTop: 2 },
  rules: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rulesTitle: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    marginBottom: 2,
  },
  ruleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleText: { flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm, lineHeight: 20 },
  sectionTitle: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    marginTop: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { fontWeight: '700', color: theme.colors.text },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    paddingHorizontal: 24,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: { fontWeight: '600', color: theme.colors.text, fontSize: theme.fontSize.sm },
  entryWhen: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  entryStatus: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  entryAmount: { fontWeight: '700', fontSize: theme.fontSize.sm },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '14',
  },
  receiptBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
});
