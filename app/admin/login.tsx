/**
 * Login HQ — cloud obrigatório, sessão persistente, erros claros (API vs Postgres).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  platformHealth,
  platformRegister,
  platformRequestPasswordReset,
  platformResetPassword,
  platformMe,
  platformAdminClaimCeo,
  asPlatformUser,
  type PlatformHealthStatus,
} from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';
import { getApiBaseUrl } from '@/services/apiBase';
import { hq, hqStyles } from '@/app/admin/_ui';
import { isStaffRole } from '@/services/platformRoles';

type Mode = 'login' | 'recover' | 'register' | 'claim';

const EMAIL_KEY = '@pecaja_hq_login_email';
const REMEMBER_KEY = '@pecaja_hq_remember';

export default function AdminLoginScreen() {
  const { login, updateProfile, logout, cloudAuth, user } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [supportPin, setSupportPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState<{ type: 'err' | 'ok' | 'info'; text: string } | null>(null);
  const [health, setHealth] = useState<PlatformHealthStatus | null>(null);

  const persistEmail = useCallback(async (em: string, keep: boolean) => {
    try {
      if (keep && em.includes('@')) {
        await AsyncStorage.setItem(EMAIL_KEY, em.trim().toLowerCase());
        await AsyncStorage.setItem(REMEMBER_KEY, '1');
      } else {
        await AsyncStorage.removeItem(EMAIL_KEY);
        await AsyncStorage.setItem(REMEMBER_KEY, '0');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const enterIfStaff = useCallback(async (): Promise<boolean> => {
    const token = await getPlatformToken();
    if (!token) {
      setMsg({
        type: 'err',
        text: 'Sessão só local — o HQ exige conta na nuvem. Confira e-mail/senha da conta cloud.',
      });
      return false;
    }
    const me = await platformMe(token);
    const u = me ? asPlatformUser(me) : null;
    if (!u) {
      setMsg({
        type: 'err',
        text: 'Sessão cloud inválida ou banco fora. Restaure o Postgres e entre de novo.',
      });
      return false;
    }
    if (isStaffRole(u.platformRole)) {
      await updateProfile({ platformRole: u.platformRole });
      router.replace('/admin/overview' as any);
      return true;
    }
    setMode('claim');
    setMsg({
      type: 'info',
      text: 'Login ok, sem papel HQ. Aba Ativar HQ → cole o SUPPORT_PIN do Railway.',
    });
    return false;
  }, [updateProfile]);

  const checkApi = useCallback(async () => {
    const h = await platformHealth();
    setHealth(h);
    return h;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedEmail, savedRemember] = await Promise.all([
          AsyncStorage.getItem(EMAIL_KEY),
          AsyncStorage.getItem(REMEMBER_KEY),
        ]);
        if (cancelled) return;
        const keep = savedRemember !== '0';
        setRemember(keep);
        if (keep && savedEmail) setEmail(savedEmail);

        const h = await checkApi();
        if (cancelled) return;

        // Sessão já válida → entra direto (ficar na conta tranquilamente)
        const token = await getPlatformToken();
        if (token && h.online) {
          const me = await platformMe(token);
          const u = me ? asPlatformUser(me) : null;
          if (u && isStaffRole(u.platformRole)) {
            await updateProfile({ platformRole: u.platformRole });
            if (!cancelled) router.replace('/admin/overview' as any);
            return;
          }
          if (u && !isStaffRole(u.platformRole)) {
            setMode('claim');
            setMsg({
              type: 'info',
              text: 'Você já está logado. Ative o HQ com o SUPPORT_PIN.',
            });
          }
        } else if (cloudAuth && user && isStaffRole(user.platformRole) && h.online) {
          if (!cancelled) router.replace('/admin/overview' as any);
          return;
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    const id = setInterval(() => {
      void checkApi();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [checkApi, cloudAuth, updateProfile, user]);

  async function onLogin() {
    setBusy(true);
    setMsg(null);
    try {
      const em = email.trim().toLowerCase();
      if (!em.includes('@') || password.length < 4) {
        setMsg({ type: 'err', text: 'Informe e-mail e senha válidos.' });
        return;
      }
      await persistEmail(em, remember);

      const h = await checkApi();
      if (!h.online) {
        setMsg({
          type: 'err',
          text:
            h.message ||
            (h.processUp
              ? 'Postgres indisponível. Restaure o banco no Supabase e atualize DATABASE_URL no Railway.'
              : `API offline (${getApiBaseUrl()}).`),
        });
        return;
      }

      const res = await login(em, password);
      if (!res.success) {
        setMsg({ type: 'err', text: res.error || 'Não foi possível entrar.' });
        return;
      }
      // Mantém a senha se falhar o papel HQ (claim); limpa só ao entrar no overview
      const ok = await enterIfStaff();
      if (ok) setPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setBusy(true);
    setMsg(null);
    try {
      const em = email.trim().toLowerCase();
      if (!name.trim() || !em.includes('@') || password.length < 6) {
        setMsg({ type: 'err', text: 'Nome, e-mail e senha (mín. 6) são obrigatórios.' });
        return;
      }
      await persistEmail(em, remember);
      const h = await checkApi();
      if (!h.online) {
        setMsg({
          type: 'err',
          text: h.message || 'Nuvem indisponível — não dá para criar conta agora.',
        });
        return;
      }
      const remote = await platformRegister({
        name: name.trim(),
        email: em,
        phone: '',
        password,
        address: '',
      });
      if (!remote) {
        setMsg({ type: 'err', text: 'Falha de rede ao criar conta. Tente de novo.' });
        return;
      }
      if (!remote.ok) {
        if (remote.code === 'EXISTS') {
          setMsg({ type: 'info', text: 'E-mail já existe. Entre ou recupere a senha.' });
          setMode('login');
          return;
        }
        setMsg({ type: 'err', text: remote.message || 'Falha ao criar conta.' });
        return;
      }
      const res = await login(em, password);
      if (!res.success) {
        setMsg({ type: 'ok', text: 'Conta criada. Entre com o mesmo e-mail e senha.' });
        setMode('login');
        return;
      }
      setMsg({ type: 'ok', text: 'Conta criada na nuvem.' });
      const ok = await enterIfStaff();
      if (ok) setPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function onRequestReset() {
    setBusy(true);
    setMsg(null);
    setShownCodeSafe('');
    try {
      const em = email.trim().toLowerCase();
      if (!em.includes('@')) {
        setMsg({ type: 'err', text: 'Informe o e-mail da conta.' });
        return;
      }
      await persistEmail(em, remember);
      const remote = await platformRequestPasswordReset(em);
      if (!remote) {
        setMsg({ type: 'err', text: 'API/banco offline — recuperação indisponível.' });
        return;
      }
      setMsg({
        type: 'info',
        text: 'Se a conta existir, enviaremos as instruções por e-mail.',
      });
    } finally {
      setBusy(false);
    }
  }

  const [shownCode, setShownCodeSafe] = useState('');

  async function onApplyReset() {
    setBusy(true);
    setMsg(null);
    try {
      const em = email.trim().toLowerCase();
      if (!em.includes('@') || newPassword.length < 6 || !resetCode.trim()) {
        setMsg({ type: 'err', text: 'E-mail, código e nova senha (mín. 6) são obrigatórios.' });
        return;
      }
      const remote = await platformResetPassword(em, newPassword, resetCode.trim());
      if (!remote?.ok) {
        setMsg({
          type: 'err',
          text: (remote && !remote.ok && remote.message) || 'Código inválido ou expirado.',
        });
        return;
      }
      setPassword(newPassword);
      setMode('login');
      setMsg({ type: 'ok', text: 'Senha atualizada. Entre com a nova senha.' });
    } finally {
      setBusy(false);
    }
  }

  async function onClaimCeo() {
    setBusy(true);
    setMsg(null);
    try {
      let token = await getPlatformToken();
      if (!token && email.trim().includes('@') && password.length >= 4) {
        const again = await login(email.trim().toLowerCase(), password);
        if (!again.success) {
          setMsg({
            type: 'err',
            text: again.error || 'A sessão caiu. Entre de novo com e-mail e senha.',
          });
          setMode('login');
          return;
        }
        token = await getPlatformToken();
      }
      if (!token) {
        setMsg({
          type: 'err',
          text: 'A sessão da nuvem caiu. Entre de novo com e-mail e senha — o PIN continua valendo depois.',
        });
        setMode('login');
        return;
      }
      const res = await platformAdminClaimCeo(token, supportPin.trim());
      if (!res?.ok && (res as any)?.code === 'AUTH' && email.trim().includes('@') && password.length >= 4) {
        const again = await login(email.trim().toLowerCase(), password);
        token = await getPlatformToken();
        if (again.success && token) {
          const retry = await platformAdminClaimCeo(token, supportPin.trim());
          if (retry?.ok) {
            const u = asPlatformUser(retry);
            if (u?.platformRole === 'ceo') {
              await updateProfile({ platformRole: 'ceo' });
              setSupportPin('');
              setPassword('');
              router.replace('/admin/overview' as any);
              return;
            }
          }
          setMsg({
            type: 'err',
            text: (retry as any)?.message || 'Não foi possível ativar o HQ.',
          });
          return;
        }
      }
      if (!res?.ok) {
        setMsg({
          type: 'err',
          text:
            (res as any)?.message ||
            'PIN inválido. Confira SUPPORT_PIN no Railway (Variables).',
        });
        return;
      }
      const u = asPlatformUser(res);
      if (u?.platformRole === 'ceo') {
        await updateProfile({ platformRole: 'ceo' });
        setSupportPin('');
        router.replace('/admin/overview' as any);
        return;
      }
      setMsg({ type: 'err', text: 'Ativação não retornou papel CEO.' });
    } finally {
      setBusy(false);
    }
  }

  async function onResumeSession() {
    setBusy(true);
    setMsg(null);
    try {
      const h = await checkApi();
      if (!h.online) {
        setMsg({ type: 'err', text: h.message || 'Nuvem indisponível.' });
        return;
      }
      const ok = await enterIfStaff();
      if (!ok && mode !== 'claim') {
        setMsg({ type: 'info', text: 'Sessão encontrada, mas sem papel HQ — use Ativar HQ.' });
      }
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = !health
    ? 'Checando nuvem…'
    : health.online
      ? `Nuvem ok · ${getApiBaseUrl().replace(/^https?:\/\//, '')}`
      : health.processUp
        ? 'API no ar · Postgres fora'
        : 'API offline';

  if (booting) {
    return (
      <View style={[styles.root, styles.boot]}>
        <ActivityIndicator color={hq.green} size="large" />
        <Text style={styles.bootText}>Abrindo HQ…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>PEÇA JÁ</Text>
        <Text style={styles.title}>Command Center</Text>
        <Text style={styles.sub}>
          Operação, financeiro, CRM e auditoria. A sessão fica salva neste navegador.
        </Text>
        <View
          style={[
            styles.apiPill,
            health?.online && styles.apiOn,
            health && !health.online && styles.apiOff,
          ]}
        >
          <Text style={styles.apiPillText}>{statusLabel}</Text>
        </View>
        {health && !health.online && health.message ? (
          <View style={[hqStyles.errBox, { marginTop: 12 }]}>
            <Text style={hqStyles.errText}>{health.message}</Text>
            <Text style={[hqStyles.errText, { marginTop: 8, opacity: 0.9 }]}>
              1) Railway → serviço Postgres precisa estar Online{'\n'}
              2) API → Variables: DATABASE_URL = {'${{Postgres.DATABASE_URL}}'}{'\n'}
              3) FLEET_DATABASE_URL igual{'\n'}
              4) Settings da API: App Sleeping = OFF + Restart ALWAYS
            </Text>
            <TouchableOpacity style={[hqStyles.btnGhost, { marginTop: 10 }]} onPress={() => void checkApi()}>
              <Text style={hqStyles.btnGhostText}>Checar de novo</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          {(
            [
              ['login', 'Entrar'],
              ['recover', 'Recuperar'],
              ['register', 'Criar'],
              ['claim', 'Ativar HQ'],
            ] as const
          ).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.tab, mode === id && styles.tabOn]}
              onPress={() => {
                setMode(id);
                // Não limpa e-mail/senha ao trocar aba — evita “nunca salva”
              }}
            >
              <Text style={[styles.tabText, mode === id && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {msg ? (
          <View
            style={[
              hqStyles.infoBox,
              msg.type === 'err' && hqStyles.errBox,
              msg.type === 'ok' && hqStyles.okBox,
              { marginBottom: 12 },
            ]}
          >
            <Text
              style={[
                hqStyles.infoText,
                msg.type === 'err' && hqStyles.errText,
                msg.type === 'ok' && hqStyles.okText,
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ) : null}

        {mode === 'login' ? (
          <>
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="E-mail"
              placeholderTextColor={hq.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="username"
              textContentType="username"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Senha"
              placeholderTextColor={hq.faint}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void onLogin()}
            />
            <View style={styles.rememberRow}>
              <Text style={styles.rememberLabel}>Lembrar e-mail neste navegador</Text>
              <Switch
                value={remember}
                onValueChange={(v) => {
                  setRemember(v);
                  void persistEmail(email, v);
                }}
                trackColor={{ false: hq.line, true: hq.green }}
              />
            </View>
            <TouchableOpacity
              style={[hqStyles.btn, (busy || health?.online === false) && { opacity: 0.7 }]}
              onPress={() => void onLogin()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#04140c" />
              ) : (
                <Text style={hqStyles.btnText}>Entrar no HQ</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[hqStyles.btnGhost, { marginTop: 10 }]}
              onPress={() => void onResumeSession()}
              disabled={busy}
            >
              <Text style={hqStyles.btnGhostText}>Continuar sessão salva</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'register' ? (
          <>
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Seu nome"
              placeholderTextColor={hq.faint}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="E-mail"
              placeholderTextColor={hq.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Senha (mín. 6)"
              placeholderTextColor={hq.faint}
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={[hqStyles.btn, busy && { opacity: 0.7 }]}
              onPress={() => void onRegister()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#04140c" />
              ) : (
                <Text style={hqStyles.btnText}>Criar conta cloud</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'recover' ? (
          <>
            <Text style={styles.hintBlock}>
              Gera um código na API (piloto). Sem e-mail SMTP — o código aparece aqui na tela.
            </Text>
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="E-mail da conta"
              placeholderTextColor={hq.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity
              style={[hqStyles.btnGhost, styles.gap]}
              onPress={() => void onRequestReset()}
              disabled={busy}
            >
              <Text style={hqStyles.btnGhostText}>Gerar código</Text>
            </TouchableOpacity>
            {shownCode ? (
              <View style={[hqStyles.okBox, styles.gap]}>
                <Text style={hqStyles.okText}>Seu código: {shownCode}</Text>
              </View>
            ) : null}
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Código"
              placeholderTextColor={hq.faint}
              autoCapitalize="characters"
              value={resetCode}
              onChangeText={setResetCode}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Nova senha (mín. 6)"
              placeholderTextColor={hq.faint}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              style={[hqStyles.btn, busy && { opacity: 0.7 }]}
              onPress={() => void onApplyReset()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#04140c" />
              ) : (
                <Text style={hqStyles.btnText}>Salvar nova senha</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'claim' ? (
          <>
            <Text style={styles.hintBlock}>
              Depois do login, use o SUPPORT_PIN do Railway para virar CEO nesta conta. A sessão
              permanece neste navegador.
            </Text>
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="SUPPORT_PIN"
              placeholderTextColor={hq.faint}
              secureTextEntry
              value={supportPin}
              onChangeText={setSupportPin}
            />
            <TouchableOpacity
              style={[hqStyles.btn, busy && { opacity: 0.7 }]}
              onPress={() => void onClaimCeo()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#04140c" />
              ) : (
                <Text style={hqStyles.btnText}>Ativar CEO</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[hqStyles.btnGhost, { marginTop: 10 }]}
              onPress={() =>
                void logout().then(() => {
                  setPassword('');
                  setSupportPin('');
                  setMode('login');
                  setMsg({ type: 'info', text: 'Sessão encerrada neste navegador.' });
                })
              }
            >
              <Text style={hqStyles.btnGhostText}>Sair / trocar conta</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hq.bg },
  boot: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootText: { color: hq.muted, fontWeight: '600' },
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 48,
    alignItems: 'center',
  },
  hero: { width: '100%', maxWidth: 420, marginBottom: 20 },
  kicker: {
    color: hq.green,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: hq.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  sub: { color: hq.muted, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  apiPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: hq.panel2,
    borderWidth: 1,
    borderColor: hq.line,
  },
  apiOn: { borderColor: 'rgba(0,200,83,0.45)', backgroundColor: hq.greenDim },
  apiOff: { borderColor: 'rgba(255,92,92,0.45)', backgroundColor: hq.redDim },
  apiPillText: { color: hq.muted, fontSize: 11, fontWeight: '700' },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: hq.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hq.line,
    padding: 18,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 60px rgba(0,0,0,0.35)' } as any)
      : {}),
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: hq.panel2,
  },
  tabOn: { backgroundColor: hq.greenDim },
  tabText: { color: hq.muted, fontWeight: '700', fontSize: 12 },
  tabTextOn: { color: hq.green },
  gap: { marginBottom: 10 },
  hintBlock: { color: hq.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  rememberLabel: { color: hq.muted, fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 12 },
});
