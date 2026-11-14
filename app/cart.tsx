import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useCart } from '@/context/CartContext';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { theme } from '@/constants/theme';
import { formatPrice, getBusinessById } from '@/data/businesses';
import { resolveDeliveryFee, countOrderItemUnits, resolvePlatformFee, customerSubtotalFromMerchant } from '@/constants/pricing';
import { formatAddonsLabel, getCustomerLineTotal, getCustomerUnitPrice } from '@/utils/cartLine';
import {
  ActiveBenefits,
  applyBenefitsToTotals,
  loadActiveBenefits,
} from '@/utils/rewards';
import {
  calculateFreeRouteDistance,
  resolveDeliveryPriceFromDistance,
  gpsFreightAdjustMessage,
} from '@/services/payment';
import { resolveMerchantPinForBusinessId } from '@/utils/merchantPin';
import { getClosedBannerText } from '@/utils/businessHours';

export default function CartScreen() {
  const { items, subtotal, businessName, updateQuantity, removeItem, clearCart } = useCart();
  const [benefits, setBenefits] = useState<ActiveBenefits>({});
  const [gpsDeliveryFee, setGpsDeliveryFee] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsAdjustNote, setGpsAdjustNote] = useState<string | null>(null);

  useEffect(() => {
    loadActiveBenefits().then(setBenefits).catch(() => setBenefits({}));
  }, [items.length, subtotal]);

  /** Ao abrir: GPS → cidade R$ 5; fora até 13 km R$ 15; mais longe GPS. */
  useEffect(() => {
    let cancelled = false;

    async function loadGpsFreight() {
      setGpsLoading(true);
      setGpsAdjustNote(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            Alert.alert(
              'Permissão negada',
              'Sem GPS usamos o frete urbano fixo de R$ 5,00 (entregas dentro da cidade).'
            );
            setGpsDeliveryFee(5);
            setGpsLoading(false);
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = currentLocation.coords;

        const merchant = await resolveMerchantPinForBusinessId(items[0]?.businessId || '');

        const distanceInMeters = await calculateFreeRouteDistance(
          merchant.latitude,
          merchant.longitude,
          latitude,
          longitude
        );

        const result = resolveDeliveryPriceFromDistance(distanceInMeters);
        if (!cancelled) {
          setGpsDeliveryFee(result.fee);
          if (result.usedGpsPricing) {
            const msg = gpsFreightAdjustMessage(result);
            setGpsAdjustNote(msg);
            Alert.alert('Frete ajustado pelo GPS', msg);
          }
        }
      } catch {
        if (!cancelled) {
          Alert.alert(
            'GPS indisponível',
            'Não foi possível medir a rota. Usamos o frete urbano fixo de R$ 5,00.'
          );
          setGpsDeliveryFee(5);
        }
      } finally {
        if (!cancelled) setGpsLoading(false);
      }
    }

    loadGpsFreight();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const business = items.length > 0 ? getBusinessById(items[0].businessId) : null;
  /** Enquanto o GPS calcula, não usa frete “chutado” do comércio — evita total mentiroso. */
  const baseDeliveryFee =
    gpsDeliveryFee != null
      ? gpsDeliveryFee
      : gpsLoading
        ? 0
        : resolveDeliveryFee(business?.deliveryFee);
  const itemUnits = useMemo(
    () => countOrderItemUnits(items),
    [items]
  );
  const platformFee = useMemo(
    () => resolvePlatformFee(itemUnits),
    [itemUnits]
  );
  const customerSubtotal = useMemo(
    () => customerSubtotalFromMerchant(subtotal, itemUnits),
    [subtotal, itemUnits]
  );
  const priced = useMemo(
    () => applyBenefitsToTotals(subtotal, baseDeliveryFee, benefits, platformFee),
    [subtotal, baseDeliveryFee, benefits, platformFee]
  );
  const freightPending = gpsLoading && !priced.freeDeliveryApplied;
  const storeClosed = business != null && !business.isOpen;
  const canCheckout = !freightPending && !storeClosed;

  if (items.length === 0) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Carrinho" />
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Carrinho vazio</Text>
          <Text style={styles.emptyText}>Adicione itens de um comércio para começar</Text>
          <Button title="Explorar comércios" onPress={() => router.replace('/(tabs)' as any)} style={{ marginTop: theme.spacing.lg }} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Carrinho" />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.businessHeader}>
            <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.businessName}>{businessName}</Text>
          </View>

          {items.map((line) => {
            const { item, quantity, lineId, selectedAddons, note } = line;
            const addonsLabel = formatAddonsLabel(selectedAddons);
            return (
              <View key={lineId} style={styles.item}>
                <Image source={{ uri: item.image }} style={styles.itemImage} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {!!addonsLabel && (
                    <Text style={styles.itemAddons} numberOfLines={2}>
                      {addonsLabel}
                    </Text>
                  )}
                  {!!note && (
                    <Text style={styles.itemNote} numberOfLines={2}>
                      Obs.: {note}
                    </Text>
                  )}
                  <Text style={styles.itemPrice}>
                    {formatPrice(getCustomerUnitPrice(item, selectedAddons))}
                  </Text>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(lineId, quantity - 1)}
                      accessibilityLabel="Diminuir quantidade"
                    >
                      <Ionicons name="remove" size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, styles.qtyBtnAdd]}
                      onPress={() => updateQuantity(lineId, quantity + 1)}
                      accessibilityLabel="Aumentar quantidade"
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemTotal}>{formatPrice(getCustomerLineTotal(line))}</Text>
                  <TouchableOpacity
                    onPress={() => removeItem(lineId)}
                    accessibilityLabel="Remover item"
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() =>
              router.push({
                pathname: '/business/[id]' as any,
                params: { id: items[0].businessId },
              })
            }
            accessibilityLabel="Adicionar novo item desta loja"
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.addMoreText}>Adicionar novo item</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={clearCart}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
            <Text style={styles.clearText}>Limpar carrinho</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          {storeClosed && business && (
            <View style={styles.closedWarn}>
              <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
              <Text style={styles.closedWarnText}>{getClosedBannerText(business)}</Text>
            </View>
          )}
          {!!gpsAdjustNote && !priced.freeDeliveryApplied && (
            <View style={styles.gpsWarn}>
              <Ionicons name="navigate-outline" size={16} color={theme.colors.warning} />
              <Text style={styles.gpsWarnText}>{gpsAdjustNote}</Text>
            </View>
          )}
          {(priced.freeDeliveryApplied || priced.discountApplied) && (
            <View style={styles.benefitBanner}>
              <Ionicons name="gift-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.benefitBannerText}>
                {[
                  priced.freeDeliveryApplied ? 'Frete grátis do clube' : null,
                  priced.discountApplied ? 'Desconto 10% aplicado' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          )}

          {benefits.freeDelivery && !priced.freeDeliveryApplied && subtotal < 25 && (
            <View style={styles.hintBanner}>
              <Ionicons name="bicycle-outline" size={16} color={theme.colors.warning} />
              <Text style={styles.hintBannerText}>
                Frete grátis libera a partir de R$ 25 (faltam {formatPrice(25 - subtotal)})
              </Text>
            </View>
          )}

          <View style={styles.summary}>
            <SummaryRow label="Subtotal" value={formatPrice(customerSubtotal)} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {priced.freeDeliveryApplied ? 'Taxa de entrega (grátis)' : 'Taxa de entrega'}
              </Text>
              {freightPending ? (
                <View style={styles.calcRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.calcText}>Calculando…</Text>
                </View>
              ) : (
                <Text style={styles.summaryValue}>
                  {priced.freeDeliveryApplied
                    ? formatPrice(0)
                    : formatPrice(priced.deliveryFee)}
                </Text>
              )}
            </View>
            {priced.discountApplied && (
              <SummaryRow label="Desconto do clube" value={`−${formatPrice(priced.discount)}`} />
            )}
            <View style={styles.divider} />
            {freightPending ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.summaryBold]}>Total</Text>
                <Text style={[styles.summaryValue, styles.summaryBold, styles.calcText]}>
                  Aguardando frete…
                </Text>
              </View>
            ) : (
              <SummaryRow label="Total" value={formatPrice(priced.total)} bold />
            )}
          </View>

          <Button
            title={
              storeClosed
                ? 'Comércio fechado'
                : freightPending
                  ? 'Calculando frete…'
                  : `Finalizar pedido • ${formatPrice(priced.total)}`
            }
            onPress={() => router.push('/checkout')}
            disabled={!canCheckout}
            size="lg"
          />
        </View>
      </View>
    </MobileShell>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
  },
  businessName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, color: theme.colors.primaryDark },
  item: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  itemImage: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.borderLight },
  itemInfo: { flex: 1 },
  itemName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  itemAddons: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    marginTop: 2,
    lineHeight: 16,
  },
  itemNote: {
    fontSize: theme.fontSize.xs,
    fontStyle: 'italic',
    color: theme.colors.primaryDark,
    marginTop: 2,
    lineHeight: 16,
  },
  itemPrice: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  qtyText: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, minWidth: 20, textAlign: 'center' },
  itemRight: { alignItems: 'flex-end', gap: theme.spacing.sm },
  itemTotal: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  addMoreText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  clearText: { color: theme.colors.error, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  footer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  benefitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  benefitBannerText: { fontSize: theme.fontSize.sm, color: theme.colors.primaryDark, flex: 1 },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  hintBannerText: { fontSize: theme.fontSize.sm, color: theme.colors.warning, flex: 1 },
  summary: { marginBottom: theme.spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  summaryLabel: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary },
  summaryValue: { fontSize: theme.fontSize.md, color: theme.colors.text },
  summaryBold: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: theme.fontSize.lg },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calcText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  closedWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  closedWarnText: { fontSize: theme.fontSize.sm, color: theme.colors.text, flex: 1, lineHeight: 18 },
  gpsWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  gpsWarnText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 17,
  },
  divider: { height: 1, backgroundColor: theme.colors.borderLight, marginVertical: theme.spacing.sm },
});
