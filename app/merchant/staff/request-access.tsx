import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import {
  StaffRole,
  STAFF_ROLE_LABEL,
  roleDescription,
  requestStaffAccess,
} from '@/utils/merchantTeam';
import { getAllMerchantShops, hydratePartnerShops, MerchantShop } from '@/utils/merchantShop';
import { theme } from '@/constants/theme';

const ROLES: Exclude<StaffRole, 'owner'>[] = ['manager', 'kitchen', 'cashier'];

/**
 * Qualquer pessoa pede acesso a uma loja com um cargo.
 * O dono precisa aprovar em Equipe antes de liberar o painel.
 */
export default function RequestStaffAccessScreen() {
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [shopQuery, setShopQuery] = useState('');
  const [selected, setSelected] = useState<MerchantShop | null>(null);
  const [role, setRole] = useState<Exclude<StaffRole, 'owner'>>('kitchen');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await hydratePartnerShops();
        setShops(await getAllMerchantShops());
      })();
    }, [])
  );

  const filtered = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    if (!q) return shops.slice(0, 12);
    return shops
      .filter((s) => s.name.toLowerCase().includes(q) || s.businessId.toLowerCase().includes(q))
      .slice(0, 20);
  }, [shops, shopQuery]);

  async function submit() {
    if (!selected) {
      Alert.alert('Loja', 'Selecione a loja em que você vai trabalhar.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestStaffAccess({
        businessId: selected.businessId,
        shopName: selected.name,
        name,
        email,
        password,
        role,
      });
      if (!res.ok) {
        Alert.alert('Pedido', res.error);
        return;
      }
      Alert.alert(
        'Pedido enviado',
        `Pedido como ${STAFF_ROLE_LABEL[role]} em “${selected.name}”.\n\nE-mail cadastrado: ${email.trim().toLowerCase()}\n\nO dono precisa liberar este e-mail em Equipe. Depois entre em Login da equipe.`,
        [
          {
            text: 'Ir para login',
            onPress: () => router.replace('/merchant/staff/login' as any),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Pedir acesso" fallbackHref="/(tabs)/profile" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="person-add" size={28} color="#fff" />
          <Text style={styles.heroTitle}>Cadastro de funcionário</Text>
          <Text style={styles.heroSub}>
            Cadastre seu e-mail e senha. O dono libera o acesso pelo e-mail no painel Equipe.
          </Text>
        </View>

        <Text style={styles.label}>Loja</Text>
        <Input
          value={shopQuery}
          onChangeText={setShopQuery}
          placeholder="Buscar nome da loja…"
          icon="search-outline"
        />
        {selected ? (
          <View style={styles.selectedShop}>
            <Ionicons name="storefront" size={20} color={theme.colors.primary} />
            <Text style={styles.selectedShopText}>{selected.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={styles.change}>Trocar</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>
            Nenhuma loja cadastrada neste aparelho ainda. Peça ao dono para abrir o painel uma vez
            neste celular, ou para cadastrar você direto em Equipe.
          </Text>
        ) : (
          <View style={styles.shopList}>
            {filtered.map((s) => (
              <TouchableOpacity
                key={s.businessId}
                style={styles.shopRow}
                onPress={() => setSelected(s)}
                activeOpacity={0.85}
              >
                <Text style={styles.shopName}>{s.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Cargo desejado</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, role === r && styles.chipOn]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.chipText, role === r && styles.chipTextOn]}>
                {STAFF_ROLE_LABEL[r]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.desc}>{roleDescription(role)}</Text>

        <Input label="Seu nome" value={name} onChangeText={setName} placeholder="Nome completo" />
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Senha de acesso"
          value={password}
          onChangeText={setPassword}
          placeholder="Mín. 4 caracteres"
          isPassword
        />

        <Button
          title="Enviar pedido ao dono"
          onPress={() => void submit()}
          loading={busy}
          size="lg"
        />
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 48, gap: 4 },
  hero: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: theme.fontWeight.extrabold },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  shopList: { gap: 6, marginBottom: 8 },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  shopName: { fontWeight: theme.fontWeight.semibold, color: theme.colors.text, flex: 1 },
  selectedShop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedShopText: { flex: 1, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  change: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  empty: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: theme.fontWeight.semibold, fontSize: 13 },
  chipTextOn: { color: '#fff' },
  desc: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 17 },
});
