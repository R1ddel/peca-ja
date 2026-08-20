import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import {
  StoreBranchSummary,
  createStoreBranch,
  listStoreBranches,
  resolveActiveMerchantContext,
  setActiveMerchantApplicationId,
} from '@/utils/merchantStores';
import { theme } from '@/constants/theme';

export default function MerchantStoresScreen() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<StoreBranchSummary[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBranches(await listStoreBranches(user?.email));
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function switchTo(applicationId: string) {
    await setActiveMerchantApplicationId(applicationId);
    await refresh();
    Alert.alert('Loja ativa', 'Painel atualizado para esta loja.', [
      { text: 'OK', onPress: () => router.replace('/merchant' as any) },
    ]);
  }

  async function addBranch() {
    const { app } = await resolveActiveMerchantContext(user?.email);
    if (!app || !user?.email) {
      Alert.alert('Lojas', 'Faça login com o e-mail do comércio.');
      return;
    }
    const businessName = name.trim();
    if (!businessName) {
      Alert.alert('Lojas', 'Informe o nome da nova loja.');
      return;
    }
    setBusy(true);
    try {
      const res = await createStoreBranch({
        email: app.email,
        ownerName: app.ownerName,
        phone: app.phone,
        businessName,
        category: app.category,
        address: app.address,
        document: app.document,
        cloneUnlockedFrom: app,
      });
      if (!res.ok) {
        Alert.alert('Lojas', res.error);
        return;
      }
      setName('');
      await refresh();
      Alert.alert(
        'Filial criada',
        res.application.status === 'approved'
          ? `${businessName} já está liberada e ativa.`
          : `${businessName} criada — conclua plano e termo se necessário.`,
        [{ text: 'Abrir painel', onPress: () => router.replace('/merchant' as any) }]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Minhas lojas" fallbackHref="/merchant" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Troque a loja ativa ou crie uma filial. Pedidos, saldo e cardápio são por loja.
        </Text>

        {branches.map((b) => (
          <TouchableOpacity
            key={b.applicationId}
            style={[styles.card, b.isActive && styles.cardActive]}
            activeOpacity={0.88}
            onPress={() => void switchTo(b.applicationId)}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: b.isOpen ? theme.colors.primary : theme.colors.textMuted },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{b.name}</Text>
              <Text style={styles.meta}>
                {b.isActive ? 'Ativa · ' : ''}
                {b.unlocked ? 'Liberada' : 'Pendente'}
                {b.plan ? ` · ${b.plan}` : ''}
                {b.isOpen ? ' · aberta' : ' · fechada'}
              </Text>
            </View>
            {b.isActive ? (
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
            ) : (
              <Ionicons name="swap-horizontal" size={20} color={theme.colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={styles.section}>Nova filial</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Peça Já — Centro"
          placeholderTextColor={theme.colors.textMuted}
        />
        <Button title="Criar loja" onPress={() => void addBranch()} loading={busy} />
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  lead: { color: theme.colors.textSecondary, marginBottom: 14, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  cardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 16 },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  section: {
    marginTop: 20,
    marginBottom: 8,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    marginBottom: 10,
  },
});
