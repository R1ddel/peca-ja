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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SaveLoginToggle } from '@/components/SaveLoginToggle';
import { PecaJaLogo } from '@/components/PecaJaLogo';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { platformHealth } from '@/services/platformClient';
import { suggestStrongPassword } from '@/utils/suggestPassword';
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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [recoverStep, setRecoverStep] = useState<'email' | 'code'>('email');
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      if (initialMode === 'register') {
        await clearSavedLogin('customer');
        setEmail('');
        setPassword('');
        setSaveCredentials(false);
      } else if (initialMode === 'login') {
        const saved = await getSavedLogin('customer');
        if (saved?.email) {
          setEmail(saved.email);
          setSaveCredentials(true);
        }
        setPassword('');
      }
      const h = await platformHealth();
      setApiOnline(h.online);
    })();
  }, [initialMode]);

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
    setRecoverStep('email');
    setShownCode('');
    setResetCode('');
    setPassword('');
    setConfirmPassword('');
    setPasswordOpen(false);
    if (next === 'register') {
      setEmail('');
      setName('');
      setPhone('');
      setAddress('');
      setSaveCredentials(false);
      void clearSavedLogin('customer');
    }
  }, []);

  async function persistEmail(em: string) {
    if (mode !== 'login') {
      await clearSavedLogin('customer');
      return;
    }
    if (saveCredentials) await saveLogin('customer', em);
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
    await persistEmail(em);
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
    await persistEmail(em);
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
    await requestPasswordReset(em);
    setLoading(false);
    setInfo('Se a conta existir, enviaremos as instruções por e-mail.');
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
    await persistEmail(em);
    const entered = await login(em, password);
    if (entered.success) {
      router.replace('/(tabs)');
      return;
    }
    setInfo('Senha atualizada. Entre com a nova senha.');
    switchMode('login');
    setPassword(password);
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
                  ['register', 'Criar conta'],
                ] as const
              ).map(([id, label]) => {
                const on = mode === id || (id === 'login' && mode === 'recover');
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
                  autoComplete="email"
                  textContentType="username"
                />
                <Input
                  label="Senha"
                  placeholder="Sua senha"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  autoComplete="current-password"
                  textContentType="password"
                />
                <SaveLoginToggle checked={saveCredentials} onChange={setSaveCredentials} />
                <Button title="Entrar" onPress={() => void onLogin()} loading={loading} size="lg" />
                <TouchableOpacity onPress={() => switchMode('recover')} style={styles.linkBtn}>
                  <Text style={styles.link}>Esqueci minha senha</Text>
                </TouchableOpacity>
                <View style={styles.otherAccess}>
                  <Text style={styles.otherLabel}>Outro acesso</Text>
                  <TouchableOpacity
                    style={styles.otherRow}
                    onPress={() => router.push('/partner/merchant-apply' as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="storefront-outline" size={22} color={theme.colors.primary} />
                    <View style={styles.otherText}>
                      <Text style={styles.otherTitle}>Cadastrar seu comércio</Text>
                      <Text style={styles.otherHint}>Abra a loja e receba pedidos</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.otherRow}
                    onPress={() => router.push('/driver/login' as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="bicycle-outline" size={22} color="#7C3AED" />
                    <View style={styles.otherText}>
                      <Text style={styles.otherTitle}>Entrar como entregador</Text>
                      <Text style={styles.otherHint}>Painel de corridas e ganhos</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {mode === 'recover' ? (
              <>
                <Text style={styles.title}>Recuperar conta</Text>
                <Text style={styles.subtitle}>
                  Se a conta existir, enviaremos as instruções por e-mail. Use o código recebido para criar uma senha nova.
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
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      passwordRules=""
                      onFocus={() => setPasswordOpen(true)}
                      editable={passwordOpen}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const next = suggestStrongPassword();
                        setPasswordOpen(true);
                        setPassword(next);
                        setConfirmPassword(next);
                      }}
                      style={styles.linkBtn}
                    >
                      <Text style={styles.link}>Sugerir uma senha forte (opcional)</Text>
                    </TouchableOpacity>
                    <Input
                      label="Confirmar nova senha"
                      placeholder="Repita a senha"
                      icon="lock-closed-outline"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      isPassword
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      passwordRules=""
                      onFocus={() => setPasswordOpen(true)}
                      editable={passwordOpen}
                    />
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
                  autoComplete="off"
                  textContentType="none"
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
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  passwordRules=""
                  onFocus={() => setPasswordOpen(true)}
                  editable={passwordOpen}
                />
                <TouchableOpacity
                  onPress={() => {
                    const next = suggestStrongPassword();
                    setPasswordOpen(true);
                    setPassword(next);
                    setConfirmPassword(next);
                  }}
                  style={styles.linkBtn}
                >
                  <Text style={styles.link}>Sugerir uma senha forte (opcional)</Text>
                </TouchableOpacity>
                <Input
                  label="Confirmar senha"
                  placeholder="Repita a senha"
                  icon="lock-closed-outline"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  passwordRules=""
                  onFocus={() => setPasswordOpen(true)}
                  editable={passwordOpen}
                />
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
    ...theme.shadow.card,
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
  otherAccess: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  otherLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  otherText: { flex: 1 },
  otherTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  otherHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
