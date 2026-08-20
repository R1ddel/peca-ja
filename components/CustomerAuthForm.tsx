import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { navigateAfterAuth, sanitizeAuthReturnTo } from '@/utils/authReturnTo';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SaveLoginToggle } from '@/components/SaveLoginToggle';
import { PecaJaLogo } from '@/components/PecaJaLogo';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { platformHealth } from '@/services/platformClient';
import { isValidEmail, normalizeEmail } from '@/utils/authEmail';
import { clearSavedLogin, getSavedLogin, saveLogin } from '@/utils/savedLogin';

export type AuthMode = 'login' | 'recover' | 'register';

type Props = {
  initialMode?: AuthMode;
};

export function CustomerAuthForm({ initialMode = 'login' }: Props) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { login, register, requestPasswordReset, resetPassword } = useAuth();
  const returnPath = sanitizeAuthReturnTo(returnTo);
  const returnHint = useMemo(() => {
    if (!returnPath) return null;
    if (returnPath === '/checkout') {
      return 'Depois de entrar você volta ao checkout com o carrinho salvo.';
    }
    return 'Depois de entrar você volta para onde estava.';
  }, [returnPath]);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [shownCode, setShownCode] = useState('');
  const [recoverStep, setRecoverStep] = useState<'email' | 'code'>('email');
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await getSavedLogin('customer');
      if (saved) {
        setEmail(saved.email);
        setPassword(saved.password);
        setSaveCredentials(true);
      }
      const h = await platformHealth();
      setApiOnline(h.online);
    })();
  }, []);

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
    setRecoverStep('email');
    setShownCode('');
    setResetCode('');
    if (next !== 'register') {
      setConfirmPassword('');
    }
  }, []);

  async function persistCreds(em: string, pw: string) {
    if (saveCredentials) await saveLogin('customer', em, pw);
    else await clearSavedLogin('customer');
  }

  async function onLogin() {
    const em = normalizeEmail(email);
    if (!isValidEmail(em) || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const result = await login(em, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Não foi possível entrar.');
      return;
    }
    await persistCreds(em, password);
    navigateAfterAuth(returnTo);
  }

  async function onRegister() {
    const em = normalizeEmail(email);
    if (!name.trim() || !isValidEmail(em) || !phone.trim() || !address.trim() || !password) {
      setError('Preencha nome, e-mail, telefone, endereço e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const result = await register({
      name: name.trim(),
      email: em,
      phone: phone.trim(),
      password,
      address: address.trim(),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Não foi possível criar a conta.');
      return;
    }
    await persistCreds(em, password);
    navigateAfterAuth(returnTo);
  }

  async function onRequestCode() {
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) {
      setError('Informe o e-mail da conta.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    setShownCode('');
    const result = await requestPasswordReset(em);
    setLoading(false);
    if (!result.success) {
      const text = (result.error ?? '').toLowerCase();
      const missing =
        text.includes('não encontramos') ||
        text.includes('nao encontramos') ||
        text.includes('não há conta') ||
        text.includes('nao ha conta') ||
        text.includes('crie uma conta');
      if (missing) {
        setError('');
        setInfo(
          'Este e-mail ainda não tem conta na nuvem (a antiga ficou só no celular). Crie agora com o mesmo e-mail — daí o login passa a valer de verdade.'
        );
        setMode('register');
        return;
      }
      setError(result.error ?? 'Não foi possível recuperar esta conta.');
      return;
    }
    const code = result.devResetToken ? String(result.devResetToken).toUpperCase() : '';
    if (code) {
      setShownCode(code);
      setResetCode(code);
      setInfo('Código gerado. Ele vale 20 minutos. Guarde e defina a nova senha abaixo.');
    } else {
      setInfo('Se a conta existir, use o código recebido para criar a nova senha.');
    }
    setRecoverStep('code');
  }

  async function onConfirmReset() {
    const em = normalizeEmail(email);
    if (!isValidEmail(em) || !resetCode.trim() || !password || !confirmPassword) {
      setError('Preencha e-mail, código e a nova senha duas vezes.');
      return;
    }
    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await resetPassword(em, password, resetCode.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Não foi possível redefinir a senha.');
      return;
    }
    await persistCreds(em, password);
    const entered = await login(em, password);
    if (entered.success) {
      router.replace('/(tabs)');
      return;
    }
    setInfo('Senha atualizada. Entre com a nova senha.');
    switchMode('login');
    setPassword(password);
    setInfo('Senha atualizada. Entre com a nova senha.');
  }

  async function copyCode() {
    if (!shownCode) return;
    await Clipboard.setStringAsync(shownCode);
    setInfo('Código copiado.');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            style={styles.hero}
          >
            <View style={styles.logoWrap}>
              <PecaJaLogo size="md" showName={false} />
            </View>
            <Text style={styles.brand}>Peça Já</Text>
            <Text style={styles.heroSub}>Sua conta na cidade — nuvem + este celular</Text>
          </LinearGradient>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(
                [
                  ['login', 'Entrar'],
                  ['recover', 'Recuperar'],
                  ['register', 'Criar'],
                ] as const
              ).map(([id, label]) => {
                const on = mode === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.tab, on && styles.tabOn]}
                    onPress={() => switchMode(id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.status,
                apiOnline === true && styles.statusOk,
                apiOnline === false && styles.statusOff,
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      apiOnline === true
                        ? theme.colors.primary
                        : apiOnline === false
                          ? theme.colors.error
                          : theme.colors.textMuted,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {apiOnline === true
                  ? 'Nuvem online — login e recuperação na conta real'
                  : apiOnline === false
                    ? 'Nuvem offline — dá para entrar se a conta já estiver neste celular'
                    : 'Checando nuvem…'}
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {info ? (
              <View style={styles.infoBox}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                <Text style={styles.infoText}>{info}</Text>
              </View>
            ) : null}

            {returnHint && (mode === 'login' || mode === 'register') ? (
              <View style={styles.returnHintBox}>
                <Ionicons name="arrow-undo-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.returnHintText}>{returnHint}</Text>
              </View>
            ) : null}

            {mode === 'login' ? (
              <>
                <Text style={styles.title}>Bem-vindo de volta</Text>
                <Text style={styles.subtitle}>
                  Use o mesmo e-mail da conta. Se a senha falhar, vá em Recuperar — geramos um código na hora.
                </Text>
                <Input
                  label="E-mail"
                  placeholder="seu@email.com"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="Senha"
                  placeholder="Sua senha"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                />
                <SaveLoginToggle checked={saveCredentials} onChange={setSaveCredentials} />
                <Button title="Entrar" onPress={() => void onLogin()} loading={loading} size="lg" />
              </>
            ) : null}

            {mode === 'recover' ? (
              <>
                <Text style={styles.title}>Recuperar conta</Text>
                <Text style={styles.subtitle}>
                  Procuramos na nuvem e neste celular (incluindo login salvo). Se achar, aparece um código para
                  criar senha nova.
                </Text>
                <Input
                  label="E-mail da conta"
                  placeholder="seu@email.com"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={recoverStep === 'email'}
                />
                {recoverStep === 'code' ? (
                  <>
                    {shownCode ? (
                      <TouchableOpacity style={styles.codeBox} onPress={() => void copyCode()} activeOpacity={0.85}>
                        <Text style={styles.codeLabel}>Seu código (toque para copiar)</Text>
                        <Text style={styles.codeValue}>{shownCode}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Input
                      label="Código"
                      placeholder="8 caracteres"
                      icon="shield-checkmark-outline"
                      value={resetCode}
                      onChangeText={(t) => setResetCode(t.toUpperCase())}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Nova senha"
                      placeholder="Mínimo 6 caracteres"
                      icon="lock-closed-outline"
                      value={password}
                      onChangeText={setPassword}
                      isPassword
                    />
                    <Input
                      label="Confirmar nova senha"
                      placeholder="Repita a senha"
                      icon="lock-closed-outline"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      isPassword
                    />
                    <SaveLoginToggle checked={saveCredentials} onChange={setSaveCredentials} />
                    <Button
                      title="Salvar senha e entrar"
                      onPress={() => void onConfirmReset()}
                      loading={loading}
                      size="lg"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setRecoverStep('email');
                        setShownCode('');
                        setInfo('');
                        setError('');
                      }}
                      style={styles.linkBtn}
                    >
                      <Text style={styles.link}>Voltar e pedir outro código</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Button
                      title="Gerar código de recuperação"
                      onPress={() => void onRequestCode()}
                      loading={loading}
                      size="lg"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const keep = email;
                        setError('');
                        switchMode('register');
                        setEmail(keep);
                        setInfo(
                          'Crie a conta com este e-mail. Depois o login usa a nuvem em qualquer celular.'
                        );
                      }}
                      style={styles.linkBtn}
                    >
                      <Text style={styles.link}>Não achei a conta — criar com este e-mail</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : null}

            {mode === 'register' ? (
              <>
                <Text style={styles.title}>Criar conta</Text>
                <Text style={styles.subtitle}>
                  A conta é gravada na nuvem. Depois você entra neste e em qualquer celular com o mesmo e-mail.
                </Text>
                <Input
                  label="Nome"
                  placeholder="Como quer ser chamado"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                />
                <Input
                  label="E-mail"
                  placeholder="seu@email.com"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="Telefone"
                  placeholder="(75) 99999-9999"
                  icon="call-outline"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <Input
                  label="Endereço de entrega"
                  placeholder="Rua, número, bairro"
                  icon="location-outline"
                  value={address}
                  onChangeText={setAddress}
                />
                <Input
                  label="Senha"
                  placeholder="Mínimo 6 caracteres"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                />
                <Input
                  label="Confirmar senha"
                  placeholder="Repita a senha"
                  icon="lock-closed-outline"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                />
                <SaveLoginToggle checked={saveCredentials} onChange={setSaveCredentials} />
                <Button title="Criar e entrar" onPress={() => void onRegister()} loading={loading} size="lg" />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  hero: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brand: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    marginTop: -18,
    marginHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabOn: { backgroundColor: '#fff' },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextOn: { color: theme.colors.primaryDark },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
    marginBottom: 12,
  },
  statusOk: { backgroundColor: theme.colors.primaryLight },
  statusOff: { backgroundColor: theme.colors.errorLight },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 16 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.errorLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: { color: theme.colors.error, fontSize: 13, flex: 1, lineHeight: 18 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoText: { color: theme.colors.primaryDark, fontSize: 13, flex: 1, lineHeight: 18 },
  returnHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  returnHintText: { color: theme.colors.primaryDark, fontSize: 13, flex: 1, lineHeight: 18 },
  codeBox: {
    backgroundColor: '#0F3D2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  codeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  codeValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
  },
  linkBtn: { marginTop: 14, alignItems: 'center' },
  link: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
});
