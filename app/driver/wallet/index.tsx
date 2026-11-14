import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import { driverFleetId } from '@/utils/driverOps';
import {
  DriverWallet,
  DriverWalletEntry,
  DRIVER_MIN_WITHDRAW,
  driverAvailableBalance,
  driverTotalEarned,
  driverTotalWithdrawn,
  syncDriverWalletFromOrders,
} from '@/utils/driverWallet';
import { executeDriverWithdraw } from '@/services/driverWithdraw';
import { platformLedgerList } from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

export default function DriverWalletScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ledgerBalance, setLedgerBalance] = useState<number | null>(null);
  const [accountMatches, setAccountMatches] = useState(true);

  const refresh = useCallback(async () => {
    const app = await resolveDriverApplication(user?.email);
    if (!app || app.status !== 'approved') {
      setReady(true);
      return;
    }
    const id = driverFleetId(app);
    setDriverId(id);
    setAppId(app.id);
    const w = await syncDriverWalletFromOrders(id, app.id, orders);
    setWallet(w);
    const token = await getPlatformToken();
    const sameAccount =
      !!user?.email &&
      user.email.trim().toLowerCase() === app.email.trim().toLowerCase();
    setAccountMatches(sameAccount);
    if (token && user?.id && sameAccount) {
      const led = await platformLedgerList('driver', user.id, token);
      if (led?.ok && typeof (led as any).balance === 'number') {
        setLedgerBalance((led as any).balance);
      }
    } else {
      setLedgerBalance(null);
    }
    setReady(true);
  }, [user?.email, user?.id, orders]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function withdrawAll() {
    if (!wallet || !driverId || !appId) return;
    if (!accountMatches) {
      Alert.alert(
        'Conta',
        'Esta carteira é do motoboy que entrou no painel. Saia e entre de novo com o e-mail dele para sacar.'
      );
      return;
    }
    const localBal = driverAvailableBalance(wallet);
    const bal =
      ledgerBalance != null && ledgerBalance >= 0
        ? Math.min(localBal, ledgerBalance)
        : localBal;
    if (bal < DRIVER_MIN_WITHDRAW) {
      Alert.alert('Saque', `Mínimo ${formatPrice(DRIVER_MIN_WITHDRAW)}.`);
      return;
    }
    if (!wallet.pixKey || !wallet.pixKeyType) {
      Alert.alert('Chave Pix', 'Cadastre sua chave Pix primeiro.', [
        { text: 'Cadastrar', onPress: () => router.push('/driver/wallet/pix' as any) },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (!wallet.pixHolderName || !wallet.pixDocument) {
      Alert.alert('Chave Pix', 'Complete nome e CPF/CNPJ na chave Pix.', [
        { text: 'Completar', onPress: () => router.push('/driver/wallet/pix' as any) },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Sacar', `Enviar ${formatPrice(bal)} para ${wallet.pixKey}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sacar',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const { wallet: next, api } = await executeDriverWithdraw({
                driverId,
                applicationId: appId,
                amount: bal,
                pixKey: wallet.pixKey!,
                pixKeyType: wallet.pixKeyType!,
                holderName: wallet.pixHolderName || 'Titular Pix',
                document: wallet.pixDocument || '',
              });
              setWallet(next);
              if (!api.ok) {
                Alert.alert('Saque', api.message || 'Falha ao sacar.');
              } else if (api.status === 'paid' || api.simulated) {
                Alert.alert(
                  'Pix enviado',
                  `${formatPrice(api.amount ?? bal)} liquidado para sua chave.`
                );
              } else if (api.status === 'failed') {
                Alert.alert(
                  'Saque falhou',
                  api.message || 'O Mercado Pago recusou o Pix-out. Saldo liberado de novo.'
                );
              } else {
                Alert.alert(
                  'Saque em processamento',
                  'O Mercado Pago ainda está liquidando. O saldo no ledger já foi reservado; confira o extrato em instantes.'
                );
              }
              void refresh();
            } catch (e: any) {
              Alert.alert('Saque', e?.message ?? 'Falha ao sacar.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </MobileShell>
    );
  }

  const localBal = driverAvailableBalance(wallet);
  const bal =
    ledgerBalance != null && Number.isFinite(ledgerBalance)
      ? Math.min(localBal, Math.max(0, ledgerBalance))
      : localBal;
  const earned = driverTotalEarned(wallet);
  const withdrawn = driverTotalWithdrawn(wallet);

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Ganhos" fallbackHref="/driver" />
      <FlatList
        data={wallet?.entries ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroLbl}>Disponível para saque</Text>
              <Text style={styles.heroVal}>{formatPrice(bal)}</Text>
              {ledgerBalance != null ? (
                <Text style={styles.heroStat}>Ledger nuvem {formatPrice(ledgerBalance)}</Text>
              ) : null}
              <View style={styles.heroStats}>
                <Text style={styles.heroStat}>Ganho {formatPrice(earned)}</Text>
                <Text style={styles.heroStat}>Sacado {formatPrice(withdrawn)}</Text>
              </View>
            </View>

            <View style={styles.rowBtns}>
              <Button
                title="Sacar"
                onPress={() => void withdrawAll()}
                loading={busy}
                style={{ flex: 1 }}
              />
              <Button
                title="Chave Pix"
                variant="outline"
                onPress={() => router.push('/driver/wallet/pix' as any)}
                style={{ flex: 1 }}
              />
            </View>

            {wallet?.pixKey ? (
              <Text style={styles.pixHint}>
                Pix · {wallet.pixKeyType} {wallet.pixKey}
              </Text>
            ) : (
              <TouchableOpacity onPress={() => router.push('/driver/wallet/pix' as any)}>
                <Text style={styles.pixWarn}>Cadastre a chave Pix para sacar →</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.section}>Extrato</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Entregue corridas para ver o frete creditado aqui.</Text>
        }
        renderItem={({ item }) => <EntryRow entry={item} />}
      />
    </MobileShell>
  );
}

function EntryRow({ entry }: { entry: DriverWalletEntry }) {
  const sign =
    entry.type === 'credit' ? '+' : entry.type === 'withdrawal' && entry.status === 'failed' ? '' : '−';
  const color =
    entry.type === 'credit'
      ? '#059669'
      : entry.type === 'withdrawal' && entry.status === 'failed'
        ? theme.colors.textMuted
        : '#DC2626';
  return (
    <View style={styles.entry}>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>{entry.description}</Text>
        <Text style={styles.entryMeta}>{formatOrderTime(entry.createdAt)}</Text>
      </View>
      <Text style={[styles.entryAmt, { color }]}>
        {sign}
        {formatPrice(entry.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  heroLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  heroStats: { flexDirection: 'row', gap: 16, marginTop: 12 },
  heroStat: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  rowBtns: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  pixHint: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 12 },
  pixWarn: { color: '#B45309', fontWeight: '600', marginBottom: 12 },
  section: { fontWeight: '800', color: theme.colors.text, marginBottom: 8, marginTop: 4 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  entryTitle: { fontWeight: '600', color: theme.colors.text, fontSize: 13 },
  entryMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  entryAmt: { fontWeight: '800', fontSize: 14 },
});
