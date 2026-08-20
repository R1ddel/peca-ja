import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import {
  StaffRole,
  STAFF_ROLE_LABEL,
  createStaffAccount,
  roleDescription,
  resolveStaffSession,
  staffCan,
} from '@/utils/merchantTeam';
import { theme } from '@/constants/theme';

const ROLES: Exclude<StaffRole, 'owner'>[] = ['manager', 'kitchen', 'cashier'];

/**
 * Cadastro direto de funcionário pelo dono/gerente.
 * Rota: /merchant/team/create
 */
export default function CreateStaffScreen() {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [role, setRole] = useState<Exclude<StaffRole, 'owner'>>('kitchen');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { app, shop } = await resolveOperatorMerchantContext(user?.email);
        if (!app || !shop) {
          setBusinessId(null);
          setAllowed(false);
          return;
        }
        const sess = await resolveStaffSession({
          businessId: shop.businessId,
          ownerName: app.ownerName,
          ownerEmail: app.email,
        });
        setBusinessId(shop.businessId);
        setAllowed(!!sess && staffCan(sess.role, 'team'));
      })();
    }, [user?.email])
  );

  async function submit() {
    if (!businessId) return;
    if (!allowed) {
      Alert.alert('Permissão', 'Só dono ou gerente podem cadastrar a equipe.');
      return;
    }
    setBusy(true);
    try {
      const res = await createStaffAccount({
        businessId,
        name,
        email,
        password,
        role,
      });
      if (!res.ok) {
        Alert.alert('Cadastro', res.error);
        return;
      }
      Alert.alert(
        'Acesso liberado',
        `${res.member.name} (${STAFF_ROLE_LABEL[res.member.role]}) já pode entrar.\n\nE-mail: ${res.member.email}\nSenha: a que você definiu\nPIN pessoal (ponto): ${res.member.pin}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Cadastrar funcionário" fallbackHref="/merchant/team" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Cadastre o e-mail, a senha e o sistema gera um PIN pessoal de 4 dígitos para bater ponto.
        </Text>

        <Text style={styles.label}>Função</Text>
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

        <Input label="Nome" value={name} onChangeText={setName} placeholder="Nome do funcionário" />
        <Input
          label="E-mail de acesso"
          value={email}
          onChangeText={setEmail}
          placeholder="func@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 4 caracteres"
          isPassword
        />

        <Button
          title="Liberar acesso"
          onPress={() => void submit()}
          loading={busy}
          disabled={!allowed}
          size="lg"
        />
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: 6, paddingBottom: 40 },
  lead: { color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { color: theme.colors.text, fontWeight: theme.fontWeight.semibold },
  chipTextOn: { color: '#fff' },
  desc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
});
