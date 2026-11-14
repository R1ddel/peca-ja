import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import { driverFleetId, listDriverActive, driverEarningsOf } from '@/utils/driverOps';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';

function paramStr(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export default function DriverDeliverScreen() {
  const { user } = useAuth();
  const preselect = paramStr(useLocalSearchParams<{ orderId?: string }>().orderId);
  const { orders, confirmDeliveryByCode } = useOrders();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(preselect || null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const app = await resolveDriverApplication(user?.email);
        setFleetId(app?.status === 'approved' ? driverFleetId(app) : null);
        if (preselect) setSelectedId(preselect);
      })();
    }, [user?.email, preselect])
  );

  const ready = useMemo(() => {
    if (!fleetId) return [];
    return listDriverActive(orders, fleetId).filter((o) => o.status === 'saiu_entrega');
  }, [orders, fleetId]);

  async function confirm() {
    if (!selectedId) {
      Alert.alert('Pedido', 'Selecione a entrega na lista.');
      return;
    }
    setBusy(true);
    const res = await confirmDeliveryByCode(selectedId, code);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Código', res.error);
      return;
    }
    setCode('');
    setSelectedId(null);
    const split = res.order.gatewaySplit;
    const detail =
      split?.driverStatus === 'paid' && !split.simulated
        ? 'O gateway enviou o frete para a sua chave Pix. A parte da loja foi para a chave dela. A taxa ficou na Peça Já.'
        : split?.driverStatus === 'missing_key'
          ? 'Entrega confirmada. Cadastre a chave Pix em Ganhos para o gateway enviar o frete.'
          : split?.driverStatus === 'failed' || split?.simulated
            ? 'Entrega confirmada. O Pix do frete ainda não saiu de verdade. O valor continua no app até o gateway aceitar.'
            : res.freightCloud === 'credited'
              ? 'Frete creditado na carteira. O cliente vai avaliar a loja e você — notas baixas reduzem pontos na Liga.'
              : res.freightCloud === 'pending'
                ? 'Entrega confirmada. O frete ainda não entrou na carteira da nuvem. Abra Ganhos daqui a pouco. O cliente já pode avaliar.'
                : 'Entrega confirmada. O cliente vai avaliar a loja e você — notas baixas reduzem pontos na Liga.';
    Alert.alert('Entregue!', detail, [
      { text: 'Ganhos', onPress: () => router.replace('/driver/wallet' as any) },
      { text: 'OK', onPress: () => router.replace('/driver' as any) },
    ]);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Código de entrega" fallbackHref="/driver" />
      <KeyboardAvoid>
        <FlatList
          data={ready}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <LinearGradient
                colors={['#065F46', '#059669', '#1E3A2F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroIcon}>
                  <Ionicons name="keypad" size={28} color="#fff" />
                </View>
                <Text style={styles.heroTitle}>Confirmar entrega</Text>
                <Text style={styles.heroSub}>
                  Peça o código de 4 dígitos que aparece no app do cliente e digite aqui.
                </Text>
                <View style={styles.heroBadge}>
                  <View style={styles.pulse} />
                  <Text style={styles.heroBadgeText}>
                    {ready.length} em rota aguardando código
                  </Text>
                </View>
              </LinearGradient>

              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="0000"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={4}
              />

              <Button
                title="Confirmar entrega"
                onPress={confirm}
                loading={busy}
                disabled={code.length !== 4 || !selectedId}
                size="lg"
                style={{ marginBottom: theme.spacing.md }}
              />

              <Text style={styles.listTitle}>Suas entregas em rota</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="bicycle-outline" size={36} color={theme.colors.primary} />
              <Text style={styles.empty}>
                Nenhuma entrega em rota. Retire o pedido na loja com o código de retirada primeiro.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const on = selectedId === item.id;
            return (
              <TouchableOpacity
                style={[styles.card, on && styles.cardOn]}
                onPress={() => setSelectedId(item.id)}
                activeOpacity={0.88}
              >
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={on ? theme.colors.primary : theme.colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.businessName}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {formatPrice(driverEarningsOf(item))} · {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </KeyboardAvoid>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: theme.spacing.md, paddingBottom: 48 },
  hero: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: theme.fontWeight.extrabold },
  heroSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  heroBadge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFB800' },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.semibold },
  codeInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    padding: 18,
    fontSize: 36,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  listTitle: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontSize: 15,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    marginBottom: 8,
  },
  cardOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  cardTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  cardMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
