import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveMerchantApplication } from '@/utils/partners';
import { getShopByApplicationId } from '@/utils/merchantShop';
import {
  MerchantPromoType,
  getPromoById,
  normalizePromoCode,
  upsertPromo,
} from '@/utils/merchantPromos';
import { theme } from '@/constants/theme';

const TYPES: { key: MerchantPromoType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'free_delivery', label: 'Frete grátis', icon: 'bicycle' },
  { key: 'percent', label: '% off', icon: 'pricetag' },
  { key: 'fixed', label: 'R$ off', icon: 'cash' },
];

export default function MerchantPromoFormScreen() {
  const { promoId } = useLocalSearchParams<{ promoId?: string }>();
  const { user } = useAuth();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MerchantPromoType>('free_delivery');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('25');
  const [useCode, setUseCode] = useState(true);
  const [code, setCode] = useState('');
  const [active, setActive] = useState(true);
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(promoId ?? null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const app = await resolveMerchantApplication(user?.email);
        if (!app) return;
        setApplicationId(app.id);
        const shop = await getShopByApplicationId(app.id);
        if (!shop) return;
        setBusinessId(shop.businessId);

        if (!promoId) {
          setTitle('Frete grátis na loja');
          return;
        }
        const p = await getPromoById(promoId);
        if (!p || p.applicationId !== app.id) return;
        setEditId(p.id);
        setTitle(p.title);
        setType(p.type);
        setValue(p.value ? String(p.value).replace('.', ',') : '');
        setMaxDiscount(
          p.maxDiscount != null ? String(p.maxDiscount).replace('.', ',') : ''
        );
        setMinSubtotal(String(p.minSubtotal).replace('.', ','));
        setUseCode(!!p.code);
        setCode(p.code ?? '');
        setActive(p.active);
        setMaxRedemptions(
          p.maxRedemptions != null ? String(p.maxRedemptions) : ''
        );
      })();
    }, [user?.email, promoId])
  );

  function onPickType(next: MerchantPromoType) {
    setType(next);
    if (!editId) {
      if (next === 'free_delivery') setTitle('Frete grátis na loja');
      else if (next === 'percent') setTitle('Desconto percentual');
      else setTitle('Desconto em reais');
    }
  }

  async function save() {
    if (!applicationId || !businessId) {
      Alert.alert('Loja', 'Não foi possível carregar a loja.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Título', 'Dê um nome à promoção.');
      return;
    }

    const min = Number(minSubtotal.replace(',', '.'));
    const val = Number(value.replace(',', '.'));
    const maxDisc = maxDiscount.trim()
      ? Number(maxDiscount.replace(',', '.'))
      : undefined;
    const maxUses = maxRedemptions.trim()
      ? Number(maxRedemptions.replace(',', '.'))
      : null;

    if (!Number.isFinite(min) || min < 0) {
      Alert.alert('Pedido mínimo', 'Informe um valor válido.');
      return;
    }
    if (type !== 'free_delivery' && (!Number.isFinite(val) || val <= 0)) {
      Alert.alert('Valor', 'Informe o valor do desconto.');
      return;
    }
    if (type === 'percent' && val > 100) {
      Alert.alert('Valor', 'Percentual máximo é 100%.');
      return;
    }
    if (useCode && !normalizePromoCode(code)) {
      Alert.alert('Cupom', 'Informe o código do cupom (ex.: PIZZA10).');
      return;
    }

    setSaving(true);
    try {
      await upsertPromo({
        id: editId ?? undefined,
        businessId,
        applicationId,
        title: title.trim(),
        type,
        value: type === 'free_delivery' ? 0 : val,
        maxDiscount:
          type === 'percent' && maxDisc != null && Number.isFinite(maxDisc)
            ? maxDisc
            : undefined,
        minSubtotal: min,
        code: useCode ? normalizePromoCode(code) : null,
        active,
        maxRedemptions:
          maxUses != null && Number.isFinite(maxUses) && maxUses > 0
            ? Math.floor(maxUses)
            : null,
      });
      Alert.alert(
        'Salvo',
        'Promoção ativa. O custo sai do recebimento da sua loja.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={editId ? 'Editar promoção' : 'Nova promoção'}
        fallbackHref="/merchant/promos"
      />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, on && styles.typeChipOn]}
                onPress={() => onPickType(t.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={t.icon}
                  size={18}
                  color={on ? '#fff' : theme.colors.primary}
                />
                <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Título (cliente vê no cupom)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex.: Frete grátis no fim de semana"
          placeholderTextColor={theme.colors.textMuted}
        />

        {type !== 'free_delivery' && (
          <>
            <Text style={styles.label}>
              {type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={type === 'percent' ? '10' : '8'}
              placeholderTextColor={theme.colors.textMuted}
            />
          </>
        )}

        {type === 'percent' && (
          <>
            <Text style={styles.label}>Teto do desconto (opcional)</Text>
            <TextInput
              style={styles.input}
              value={maxDiscount}
              onChangeText={setMaxDiscount}
              keyboardType="decimal-pad"
              placeholder="Ex.: 15"
              placeholderTextColor={theme.colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>Pedido mínimo (R$)</Text>
        <TextInput
          style={styles.input}
          value={minSubtotal}
          onChangeText={setMinSubtotal}
          keyboardType="decimal-pad"
          placeholder="25"
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Exigir código de cupom</Text>
            <Text style={styles.switchHint}>
              Desligado = aplica sozinho no checkout desta loja
            </Text>
          </View>
          <Switch
            value={useCode}
            onValueChange={setUseCode}
            trackColor={{ false: '#D1D5DB', true: theme.colors.primaryLight }}
            thumbColor={useCode ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        {useCode && (
          <>
            <Text style={styles.label}>Código do cupom</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              placeholder="PIZZA10"
              placeholderTextColor={theme.colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>Limite de usos (opcional)</Text>
        <TextInput
          style={styles.input}
          value={maxRedemptions}
          onChangeText={setMaxRedemptions}
          keyboardType="number-pad"
          placeholder="Ilimitado"
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchTitle}>Ativa agora</Text>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ false: '#D1D5DB', true: theme.colors.primaryLight }}
            thumbColor={active ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.noteText}>
            Desconto e frete grátis reduzem o valor que sua loja recebe no pedido. O
            entregador continua recebendo o frete quando a promoção é frete grátis.
          </Text>
        </View>

        <Button
          title={editId ? 'Salvar alterações' : 'Criar promoção'}
          onPress={() => void save()}
          loading={saving}
          style={{ marginTop: 8 }}
        />
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 48 },
  label: {
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.white,
  },
  typeChipOn: {
    backgroundColor: theme.colors.primary,
  },
  typeText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  typeTextOn: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingVertical: 8,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  switchHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
  },
});
