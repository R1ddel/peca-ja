import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SaveLoginToggle } from '@/components/SaveLoginToggle';
import { loginStaff, staffHomePath } from '@/utils/merchantTeam';
import { recordPunch, PunchRole } from '@/utils/merchantPunch';
import { setActiveMerchantApplicationId } from '@/utils/merchantStores';
import { getShopByBusinessId } from '@/utils/merchantShop';
import { clearSavedLogin, getSavedLogin, saveLogin } from '@/utils/savedLogin';
import { theme } from '@/constants/theme';

/**
 * Login da equipe (gerente / cozinha / caixa).
 * Rota: /merchant/staff/login → painel único do comércio
 */
export default function StaffLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await getSavedLogin('staff');
      if (!saved) return;
      setEmail(saved.email);
      setPassword(saved.password);
      setSaveCredentials(true);
    })();
  }, []);

  async function submit() {
    setBusy(true);
    try {
      const res = await loginStaff({ email, password });
      if (!res.ok) {
        Alert.alert('Login', res.error);
        return;
      }
      if (saveCredentials) {
        await saveLogin('staff', email, password);
      } else {
        await clearSavedLogin('staff');
      }
      const shop = await getShopByBusinessId(res.member.businessId);
      if (shop) await setActiveMerchantApplicationId(shop.applicationId);
      if (res.member.role !== 'owner') {
        await recordPunch({
          businessId: res.member.businessId,
          memberId: res.member.id,
          memberName: res.member.name,
          role: res.member.role as PunchRole,
          kind: 'in',
        });
      }
      router.replace(staffHomePath(res.member.role) as any);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Login da equipe" fallbackHref="/(tabs)/profile" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={28} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Entrar no painel</Text>
          <Text style={styles.heroSub}>
            Use o e-mail liberado pelo dono e a senha (ou o PIN pessoal). No sistema avançado, cada
            função pede PIN + bater ponto.
          </Text>
        </View>

        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
        />
        <Input
          label="Senha ou PIN"
          value={password}
          onChangeText={setPassword}
          placeholder="Sua senha"
          isPassword
          icon="lock-closed-outline"
        />

        <SaveLoginToggle checked={saveCredentials} onChange={setSaveCredentials} />

        <Button title="Entrar agora" onPress={() => void submit()} loading={busy} size="lg" />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/merchant/staff/forgot' as any)}
        >
          <Text style={styles.link}>Esqueci e-mail ou senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/merchant' as any)}
        >
          <Text style={styles.link}>Abrir painel do comércio (sem login da equipe)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/merchant/staff/request-access' as any)}
        >
          <Text style={styles.link}>Ainda não tenho cadastro — pedir acesso</Text>
        </TouchableOpacity>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: 4, paddingBottom: 40 },
  hero: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    lineHeight: 20,
    fontSize: 14,
  },
  linkRow: { marginTop: 16, alignItems: 'center' },
  link: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  linkMuted: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
