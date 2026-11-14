import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import {
  MerchantShop,
  getShopByApplicationId,
  patchShop,
} from '@/utils/merchantShop';
import { getBusinessCoverSource, getBusinessLogoSource } from '@/utils/businessLogos';
import { confirmReloadApp } from '@/utils/reloadApp';
import {
  DayHours,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  WeekdayKey,
  WeeklyHours,
  formatWeeklyHoursSummary,
  parseHoursToWeekly,
} from '@/utils/weeklyHours';
import { theme } from '@/constants/theme';
import {
  ShopPaymentMethod,
  defaultShopPayments,
  newCustomPayment,
  normalizeShopPayments,
} from '@/utils/paymentMethods';
import { ShopDeliveryMode } from '@/utils/shopDelivery';
import { isValidLatLng } from '@/utils/orderGeo';


export default function MerchantSettingsScreen() {
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [description, setDescription] = useState('');
  const [weekly, setWeekly] = useState<WeeklyHours>(() => parseHoursToWeekly(null));
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [payments, setPayments] = useState<ShopPaymentMethod[]>(() => defaultShopPayments());
  const [deliveryBy, setDeliveryBy] = useState<ShopDeliveryMode>('app');
  const [newPaymentName, setNewPaymentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { app, shop: foundShop } = await resolveOperatorMerchantContext(user?.email);
    if (!app) return;
    setAppId(app.id);
    const s = foundShop ?? (await getShopByApplicationId(app.id));
    if (!s) return;
    setShop(s);
    setDescription(s.description);
    setWeekly(s.weeklyHours ?? parseHoursToWeekly(s.hours));
    setDeliveryTime(s.deliveryTime);
    setDeliveryFee(String(s.deliveryFee).replace('.', ','));
    setMinOrder(String(s.minOrder).replace('.', ','));
    setPayments(normalizeShopPayments(s.acceptedPayments));
    setDeliveryBy(s.deliveryBy === 'store' ? 'store' : 'app');
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  function patchDay(key: WeekdayKey, patch: Partial<DayHours>) {
    setWeekly((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function pick(kind: 'image' | 'coverImage') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotos', 'Permita o acesso à galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      // allowsEditing trava o retorno em vários Android/Expo Go
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri || !appId) return;
    const updated = await patchShop(appId, { [kind]: result.assets[0].uri });
    if (updated) setShop(updated);
  }

  async function save() {
    if (!appId || !shop) return;
    const fee = Number(deliveryFee.replace(',', '.'));
    const min = Number(minOrder.replace(',', '.'));
    const hoursSummary = formatWeeklyHoursSummary(weekly);
    setSaving(true);
    try {
      const updated = await patchShop(appId, {
        description: description.trim() || shop.description,
        hours: hoursSummary,
        weeklyHours: weekly,
        deliveryTime: deliveryTime.trim() || shop.deliveryTime,
        deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : shop.deliveryFee,
        minOrder: Number.isFinite(min) && min >= 0 ? min : shop.minOrder,
      });
      if (updated) {
        setShop(updated);
        Alert.alert('Salvo', 'Dados da loja atualizados no Peça Já.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function persistDelivery(next: ShopDeliveryMode) {
    setDeliveryBy(next);
    if (!appId) return;
    const updated = await patchShop(appId, { deliveryBy: next });
    if (updated) setShop(updated);
  }

  async function persistPayments(next: ShopPaymentMethod[]) {
    const safe = normalizeShopPayments(next);
    setPayments(safe);
    if (!appId) return;
    const updated = await patchShop(appId, { acceptedPayments: safe });
    if (updated) setShop(updated);
  }

  function togglePayment(id: string, enabled: boolean) {
    const next = payments.map((method) => (method.id === id ? { ...method, enabled } : method));
    if (!next.some((method) => method.enabled)) {
      Alert.alert('Pagamento', 'A loja precisa aceitar pelo menos uma forma.');
      return;
    }
    void persistPayments(next);
  }

  function addPayment() {
    const created = newCustomPayment(newPaymentName);
    if (!created) {
      Alert.alert('Pagamento', 'Escreva o nome do método. Ex.: Vale refeição.');
      return;
    }
    const exists = payments.some(
      (method) => method.label.toLowerCase() === created.label.toLowerCase()
    );
    if (exists) {
      Alert.alert('Pagamento', 'Essa forma já está na lista.');
      return;
    }
    setNewPaymentName('');
    void persistPayments([...payments, created]);
  }

  function removePayment(id: string) {
    void persistPayments(payments.filter((method) => method.id !== id));
  }

  async function toggleOpen(value: boolean) {
    if (!appId) return;
    const updated = await patchShop(appId, { isOpen: value });
    if (updated) setShop(updated);
  }

  async function setPinFromGps() {
    if (!appId) return;
    setPinBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'GPS',
          'Permita a localização neste celular (deve estar na loja) para gravar o pin do frete.'
        );
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('gps-timeout')), 12000)
        ),
      ]);
      const { latitude, longitude } = pos.coords;
      if (!isValidLatLng(latitude, longitude)) {
        Alert.alert('GPS', 'Não foi possível ler a posição.');
        return;
      }
      const updated = await patchShop(appId, { latitude, longitude });
      if (updated) {
        setShop(updated);
        Alert.alert(
          'Pin salvo',
          'O frete do cliente agora usa este ponto até a porta dele. Atualize se mudar de endereço.'
        );
      }
    } catch {
      Alert.alert(
        'GPS',
        'Falha ao ler a localização (demorou ou sem sinal). Fique na loja e tente de novo.'
      );
    } finally {
      setPinBusy(false);
    }
  }

  async function clearPin() {
    if (!appId || !shop) return;
    Alert.alert(
      'Remover pin',
      'Sem pin o frete fica menos preciso (ponto aproximado na cidade). Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const updated = await patchShop(appId, {
                latitude: undefined,
                longitude: undefined,
              });
              if (updated) setShop({ ...updated, latitude: undefined, longitude: undefined });
            })();
          },
        },
      ]
    );
  }

  if (!shop) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Loja" fallbackHref="/merchant" />
        <View style={styles.center}>
          <Text style={styles.muted}>Carregando…</Text>
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Loja e horários" fallbackHref="/merchant" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => void pick('coverImage')} activeOpacity={0.9}>
          <Image
            source={getBusinessCoverSource({
              name: shop.name,
              category: shop.category,
              image: shop.image,
              coverImage: shop.coverImage,
            })}
            style={styles.cover}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.coverOverlay}
          >
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={styles.coverHint}>Trocar capa</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoWrap}
          onPress={() => void pick('image')}
          activeOpacity={0.9}
        >
          <Image
            source={getBusinessLogoSource({
              name: shop.name,
              category: shop.category,
              image: shop.image,
            })}
            style={styles.logo}
          />
          <View style={styles.logoBadge}>
            <Ionicons name="pencil" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        <LinearGradient
          colors={
            shop.isOpen
              ? [theme.colors.primaryLight, '#fff']
              : ['#F3F4F6', '#fff']
          }
          style={styles.openRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.openTitle}>
              {shop.isOpen ? 'Loja aberta no app' : 'Loja fechada'}
            </Text>
            <Text style={styles.openHint}>
              {shop.isOpen
                ? 'Clientes podem montar pedidos agora. Fecha sozinha após o horário da grade.'
                : 'Ninguém consegue pedir até você abrir'}
            </Text>
          </View>
          <Switch
            value={shop.isOpen}
            onValueChange={(v) => void toggleOpen(v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
            thumbColor={shop.isOpen ? theme.colors.primary : '#f4f4f4'}
          />
        </LinearGradient>

        <Text style={styles.blockTitle}>Identidade</Text>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Conte o diferencial da casa…"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={styles.blockTitle}>Operação</Text>
        <Text style={styles.label}>Horário por dia</Text>
        <Text style={styles.hoursSummary}>{formatWeeklyHoursSummary(weekly)}</Text>
        <Text style={styles.openHint}>
          Depois do horário de fechamento, a loja fecha sozinha no app (uma vez por dia).
        </Text>
        {WEEKDAY_ORDER.map((key) => {
          const day = weekly[key];
          return (
            <View key={key} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{WEEKDAY_LABEL[key]}</Text>
              <Switch
                value={!day.closed}
                onValueChange={(open) => patchDay(key, { closed: !open })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
                thumbColor={!day.closed ? theme.colors.primary : '#f4f4f4'}
              />
              {day.closed ? (
                <Text style={styles.dayClosed}>Fechado</Text>
              ) : (
                <>
                  <TextInput
                    style={styles.dayInput}
                    value={day.open}
                    onChangeText={(open) => patchDay(key, { open })}
                    placeholder="08:00"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                  <Text style={styles.dayDash}>–</Text>
                  <TextInput
                    style={styles.dayInput}
                    value={day.close}
                    onChangeText={(close) => patchDay(key, { close })}
                    placeholder="22:00"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </>
              )}
            </View>
          );
        })}

        <Text style={styles.label}>Tempo de entrega</Text>
        <TextInput
          style={styles.input}
          value={deliveryTime}
          onChangeText={setDeliveryTime}
          placeholder="30-45 min"
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Frete base (R$)</Text>
            <TextInput
              style={styles.input}
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              keyboardType="decimal-pad"
              placeholder="5"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Mínimo (R$)</Text>
            <TextInput
              style={styles.input}
              value={minOrder}
              onChangeText={setMinOrder}
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
        <Text style={styles.feeHint}>
          Frete no checkout: pin da loja → GPS do cliente (R$ 5 na cidade · R$ 15 até 13 km · depois sobe por km).
        </Text>

        <Text style={styles.blockTitle}>Pin no mapa</Text>
        <Text style={styles.feeHint}>
          Grave a posição real da loja. Sem isso o frete usa um ponto aproximado na cidade e o motoboy pode errar a retirada.
        </Text>
        {shop.address ? (
          <Text style={styles.pinAddress}>{shop.address}</Text>
        ) : null}
        <View style={styles.pinCard}>
          <Ionicons
            name={
              isValidLatLng(shop.latitude, shop.longitude)
                ? 'location'
                : 'location-outline'
            }
            size={22}
            color={
              isValidLatLng(shop.latitude, shop.longitude)
                ? theme.colors.primary
                : theme.colors.textMuted
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinStatus}>
              {isValidLatLng(shop.latitude, shop.longitude)
                ? 'Pin gravado'
                : 'Sem pin — frete aproximado'}
            </Text>
            <Text style={styles.pinCoords}>
              {isValidLatLng(shop.latitude, shop.longitude)
                ? `${(shop.latitude as number).toFixed(5)}, ${(shop.longitude as number).toFixed(5)}`
                : 'Toque em “Usar GPS neste celular” estando na loja'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.pinBtn, pinBusy && styles.pinBtnDisabled]}
          onPress={() => void setPinFromGps()}
          disabled={pinBusy}
          activeOpacity={0.85}
        >
          {pinBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.pinBtnText}>Usar GPS neste celular</Text>
            </>
          )}
        </TouchableOpacity>
        {isValidLatLng(shop.latitude, shop.longitude) ? (
          <TouchableOpacity onPress={() => void clearPin()} style={styles.pinClear}>
            <Text style={styles.pinClearText}>Remover pin</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.label}>Quem entrega</Text>
        <TouchableOpacity
          style={[styles.choice, deliveryBy === 'store' && styles.choiceOn]}
          onPress={() => void persistDelivery('store')}
          activeOpacity={0.85}
        >
          <Text style={styles.payLabel}>A loja tem entregador</Text>
          <Text style={styles.payHint}>O motoboy do app não recebe esses pedidos. No dinheiro, a cédula fica na loja e a taxa Peça Já sai do caixa Pix.</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choice, deliveryBy === 'app' && styles.choiceOn]}
          onPress={() => void persistDelivery('app')}
          activeOpacity={0.85}
        >
          <Text style={styles.payLabel}>Motoboy do Peça Já</Text>
          <Text style={styles.payHint}>
            Só Pix e cartão. O motoboy não leva dinheiro. O frete vai para ele. A loja recebe só a parte dela, depois da entrega.
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Pagamentos que a loja aceita</Text>
        <Text style={styles.feeHint}>
          Pix e cartão cobram na hora. Dinheiro e outras formas na entrega só aparecem se a loja entrega com a equipe dela.
        </Text>
        {payments.map((method) => (
          <View key={method.id} style={styles.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payLabel}>{method.label}</Text>
              {method.custom ? <Text style={styles.payHint}>Criado por esta loja</Text> : null}
            </View>
            {method.custom ? (
              <TouchableOpacity onPress={() => removePayment(method.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            ) : null}
            <Switch
              value={method.enabled}
              onValueChange={(enabled) => togglePayment(method.id, enabled)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
              thumbColor={method.enabled ? theme.colors.primary : theme.colors.surface}
            />
          </View>
        ))}
        <View style={styles.payAdd}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newPaymentName}
            onChangeText={setNewPaymentName}
            placeholder="Adicionar outro. Ex.: Vale refeição"
            placeholderTextColor={theme.colors.textMuted}
            onSubmitEditing={addPayment}
          />
          <TouchableOpacity style={styles.payAddBtn} onPress={addPayment} activeOpacity={0.85}>
            <Text style={styles.payAddBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.idChip}>
          <Ionicons name="finger-print-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.idHint}>{shop.businessId}</Text>
        </View>

        <Button title="Salvar alterações" onPress={() => void save()} loading={saving} size="lg" />

        <TouchableOpacity style={styles.reloadBtn} onPress={confirmReloadApp} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.reloadText}>Recarregar app</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.planNav}
          onPress={() =>
            appId
              ? router.push({ pathname: '/partner/plans' as any, params: { id: appId } })
              : undefined
          }
        >
          <View style={styles.planIcon}>
            <Ionicons name="diamond" size={18} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>Planos e renovação</Text>
            <Text style={styles.planHint}>Upgrade, vigência e pagamento</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: theme.colors.textMuted },
  cover: {
    width: '100%',
    height: 160,
    borderRadius: 22,
    backgroundColor: theme.colors.borderLight,
  },
  coverOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 10,
  },
  coverHint: { color: '#fff', fontWeight: theme.fontWeight.semibold, fontSize: 12 },
  logoWrap: { alignItems: 'center', marginTop: -40, marginBottom: theme.spacing.md },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: theme.colors.background,
    backgroundColor: theme.colors.surface,
  },
  logoBadge: {
    position: 'absolute',
    right: '38%',
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
    gap: 12,
  },
  openTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  openHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  blockTitle: {
    marginTop: theme.spacing.md,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  feeHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
  pinAddress: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 10,
    marginTop: 6,
  },
  pinStatus: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 14,
  },
  pinCoords: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  pinBtnDisabled: { opacity: 0.6 },
  pinBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 15 },
  pinClear: { alignItems: 'center', paddingVertical: 8, marginBottom: theme.spacing.md },
  pinClearText: {
    color: theme.colors.error,
    fontWeight: theme.fontWeight.semibold,
    fontSize: 13,
  },
  hoursSummary: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 8,
    lineHeight: 17,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dayLabel: {
    width: 36,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 13,
  },
  dayClosed: { flex: 1, color: theme.colors.textMuted, fontSize: 13 },
  dayInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  dayDash: { color: theme.colors.textMuted },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
  },
  multi: { minHeight: 88, textAlignVertical: 'top' },
  grid2: { flexDirection: 'row', gap: 10 },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  idHint: { fontSize: 11, color: theme.colors.textMuted },
  planNav: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  reloadBtn: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  reloadText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    fontSize: 14,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  planHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  payLabel: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 14 },
  payHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  payAdd: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  payAddBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  payAddBtnText: { color: theme.colors.white, fontWeight: theme.fontWeight.bold },
  choice: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
    marginBottom: 8,
  },
  choiceOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
});
