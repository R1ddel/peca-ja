import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { buildMerchantInsights } from '@/utils/merchantInsights';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';

export default function MerchantInsightsScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [businessId, setBusinessId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { shop } = await resolveOperatorMerchantContext(user?.email);
        setBusinessId(shop?.businessId ?? null);
      })();
    }, [user?.email])
  );

  const mine = useMemo(
    () => (businessId ? orders.filter((o) => o.businessId === businessId) : []),
    [orders, businessId]
  );
  const insights = useMemo(() => buildMerchantInsights(mine), [mine]);
  const maxHour = Math.max(1, ...insights.hourBars.map((h) => h.sales || h.count));

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Insights" fallbackHref="/merchant" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1E3A2F', '#007A4D']} style={styles.hero}>
          <Text style={styles.heroKicker}>Desempenho</Text>
          <Text style={styles.heroTitle}>{formatPrice(insights.weekSales)}</Text>
          <Text style={styles.heroSub}>
            líquido da loja · 7 dias · {insights.weekOrders} pedido
            {insights.weekOrders !== 1 ? 's' : ''}
          </Text>
        </LinearGradient>

        <View style={styles.row}>
          <Mini label="Líquido hoje" value={formatPrice(insights.todaySales)} />
          <Mini label="Ticket líq." value={formatPrice(insights.todayTicket)} />
          <Mini label="Entregues" value={String(insights.deliveredToday)} />
        </View>

        {(insights.peakHourLabel || insights.avgPrepMinutes != null) && (
          <View style={styles.metaRow}>
            {insights.peakHourLabel ? (
              <View style={styles.metaChip}>
                <Ionicons name="flash" size={14} color="#FFB800" />
                <Text style={styles.metaText}>Pico às {insights.peakHourLabel}</Text>
              </View>
            ) : null}
            {insights.avgPrepMinutes != null ? (
              <View style={styles.metaChip}>
                <Ionicons name="timer" size={14} color={theme.colors.primary} />
                <Text style={styles.metaText}>
                  Saída média {insights.avgPrepMinutes} min
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receita líquida por hora (hoje)</Text>
          <View style={styles.bars}>
            {insights.hourBars.map((h) => {
              const v = h.sales || h.count;
              return (
                <View key={h.label} style={styles.barCol}>
                  <Text style={styles.barVal}>
                    {h.sales > 0 ? Math.round(h.sales) : h.count || ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(6, (v / maxHour) * 100)}%`,
                          backgroundColor: v ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{h.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mais pedidos hoje</Text>
          {insights.topItems.length === 0 ? (
            <Text style={styles.empty}>Ainda sem itens vendidos hoje.</Text>
          ) : (
            insights.topItems.map((item, i) => (
              <View key={item.name} style={styles.topRow}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName}>{item.name}</Text>
                  <Text style={styles.topMeta}>
                    {item.qty} un. · {formatPrice(item.revenue)}
                  </Text>
                </View>
                <Ionicons
                  name={i === 0 ? 'trophy' : 'flame-outline'}
                  size={18}
                  color={i === 0 ? theme.colors.accent : theme.colors.primary}
                />
              </View>
            ))
          )}
        </View>

        <LinearGradient
          colors={[theme.colors.primaryLight, theme.colors.surface]}
          style={styles.tip}
        >
          <Ionicons name="bulb" size={20} color={theme.colors.primary} />
          <Text style={styles.tipText}>{insights.tip}</Text>
        </LinearGradient>

        {insights.canceledToday > 0 && (
          <View style={styles.warn}>
            <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.warnText}>
              {insights.canceledToday} cancelamento(s) hoje — responda pedidos novos em poucos
              minutos.
            </Text>
          </View>
        )}
      </ScrollView>
    </MobileShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  hero: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: 4,
    letterSpacing: -0.8,
  },
  heroSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.md },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  metaText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  mini: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  miniValue: {
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    fontSize: 14,
  },
  miniLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardTitle: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  bars: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barVal: { fontSize: 8, color: theme.colors.textMuted, marginBottom: 2, height: 12 },
  barTrack: {
    width: '100%',
    height: 80,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.borderLight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barLabel: { fontSize: 8, color: theme.colors.textMuted, marginTop: 4 },
  empty: { color: theme.colors.textMuted, fontSize: 13 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontWeight: theme.fontWeight.bold, color: theme.colors.primaryDark, fontSize: 12 },
  topName: { fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  topMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    padding: theme.spacing.md,
    borderRadius: 18,
    marginBottom: theme.spacing.sm,
  },
  tipText: { flex: 1, color: theme.colors.text, lineHeight: 19, fontSize: 13 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: theme.spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  warnText: { flex: 1, fontSize: 13, color: theme.colors.text, lineHeight: 18 },
});
