import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import {
  driverOnboardingGate,
  loginDriverApplication,
} from '@/utils/partners';
import {
  setDriverSession,
  maybeForceWipeDriverData,
  wipeAllDriverLocalData,
  getRememberedDriverLogin,
  setRememberedDriverLogin,
  clearRememberedDriverLogin,
} from '@/utils/driverSession';
import { theme } from '@/constants/theme';

const ACCENT = '#7C3AED';
/** Troque o token se precisar forçar limpeza de novo no futuro. */
const WIPE_TOKEN = 'terms-gate-2026-07-30';

export default function DriverLoginScreen() {
  const { login, register, user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wipedNote, setWipedNote] = useState('');

  useEffect(() => {
    void (async () => {
      const wiped = await maybeForceWipeDriverData(WIPE_TOKEN);
      if (wiped) {
        setWipedNote(
          'Cadastro antigo de entregador foi apagado neste aparelho. Crie a conta de novo para ver o termo.'
        );
        setPassword('');
        setRememberLogin(false);
        return;
      }

      const saved = await getRememberedDriverLogin();
      if (saved) {
        setEmail(saved.email);
        setRememberLogin(true);
      }
    })();
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const result = await loginDriverApplication(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const auth = await login(email.trim().toLowerCase(), password);
      if (!auth.success) {
        await register({
          name: result.application.name,
          email: result.application.email,
          phone: result.application.phone,
          password,
          address: result.application.city || 'A informar',
        });
      }

      await setDriverSession({
        applicationId: result.application.id,
        email: result.application.email,
        loggedAt: new Date().toISOString(),
      });

      if (rememberLogin) {
        await setRememberedDriverLogin(result.application.email);
      } else {
        await clearRememberedDriverLogin();
      }

      const gate = driverOnboardingGate(result.application);
      if (gate === 'terms') {
        router.replace({
          pathname: '/driver/terms' as any,
          params: { id: result.application.id },
        });
        return;
      }
      router.replace('/driver' as any);
    } finally {
      setLoading(false);
    }
  }

  function confirmWipe() {
    Alert.alert(
      'Apagar cadastro',
      'Remove o cadastro de entregador neste celular (candidatura, sessão e carteira). Você vai precisar cadastrar tudo de novo e assinar o termo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const { removed } = await wipeAllDriverLocalData();
              setPassword('');
              setRememberLogin(false);
              setWipedNote(
                removed > 0
                  ? `${removed} cadastro(s) apagado(s). Pode criar a conta do zero.`
                  : 'Nenhum cadastro de entregador encontrado. Pode criar a conta.'
              );
              Alert.alert('Pronto', 'Cadastro de entregador limpo neste aparelho.');
            })();
          },
        },
      ]
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Login entregador" fallbackHref="/(tabs)/profile" preferFallback />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="bicycle" size={28} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Painel do entregador</Text>
            <Text style={styles.heroSub}>
              Entre com o e-mail e a senha do cadastro. Sem conta? Cadastre em 3 passos: dados,
              veículo/CNH e termo de responsabilidade.
            </Text>
          </View>

          {!!wipedNote && (
            <View style={styles.wipeBox}>
              <Ionicons name="trash-outline" size={18} color="#92400E" />
              <Text style={styles.wipeText}>{wipedNote}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="E-mail *"
            placeholder="seu@email.com"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Senha *"
            placeholder="Sua senha"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.rememberRow}
            activeOpacity={0.85}
            onPress={() => setRememberLogin((v) => !v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rememberTitle}>Lembrar meu e-mail neste celular</Text>
              <Text style={styles.rememberHint}>
                A senha não fica salva. Na próxima vez só o e-mail volta preenchido.
              </Text>
            </View>
            <Switch
              value={rememberLogin}
              onValueChange={setRememberLogin}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={rememberLogin ? ACCENT : '#f4f4f5'}
            />
          </TouchableOpacity>

          <Button title="Entrar" onPress={() => void handleLogin()} loading={loading} size="lg" />

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push('/driver/register' as any)}
          >
            <Text style={styles.registerText}>Criar conta de entregador</Text>
            <Ionicons name="arrow-forward" size={16} color={ACCENT} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.wipeBtn} onPress={confirmWipe}>
            <Text style={styles.wipeBtnText}>Apagar meu cadastro neste celular</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            No cadastro você informa dados da moto/CNH e assina o termo de responsabilidade.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: '#4C1D95',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
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
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  wipeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  wipeText: { flex: 1, color: '#92400E', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.errorLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: theme.colors.error, fontSize: 13 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  rememberTitle: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 14,
  },
  rememberHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
  },
  registerText: { color: ACCENT, fontWeight: '800', fontSize: 15 },
  wipeBtn: { alignItems: 'center', paddingVertical: 10 },
  wipeBtnText: { color: '#B91C1C', fontWeight: '600', fontSize: 13 },
  hint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
});
