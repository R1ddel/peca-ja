/**
 * Login HQ — cloud obrigatório, recuperação com código, ativação CEO via PIN.
 * Sem Alert nativo no fluxo principal (web-friendly).
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
} from 'react-native';
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
} from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';
import { getApiBaseUrl } from '@/services/apiBase';
import { hq, hqStyles } from '@/app/admin/_ui';

type Mode = 'login' | 'recover' | 'register' | 'claim';

export default function AdminLoginScreen() {
  const { login, updateProfile, logout } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [supportPin, setSupportPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'err' | 'ok' | 'info'; text: string } | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [shownCode, setShownCode] = useState('');

  const checkApi = useCallback(async () => {
    const h = await platformHealth();
    setApiOnline(h.online);
  }, []);

  useEffect(() => {
    void checkApi();
  }, [checkApi]);

  async function enterIfStaff() {
    const token = await getPlatformToken();
    if (!token) {
      setMsg({
        type: 'err',
        text:
          'Sessão só local — o HQ exige conta na nuvem. Confira a API e a senha da conta cloud.',
      });
      return false;
    }
    const me = await platformMe(token);
    const u = me ? asPlatformUser(me) : null;
    if (!u) {
      setMsg({ type: 'err', text: 'Sessão inválida na API. Tente de novo.' });
      return false;
    }
    if (u.platformRole === 'ceo' || u.platformRole === 'ops') {
      await updateProfile({ platformRole: u.platformRole });
      router.replace('/admin/overview' as any);
      return true;
    }
    setMode('claim');
    setMsg({
      type: 'info',
      text:
        'Login ok, mas sem papel HQ. Use a aba Ativar HQ com o SUPPORT_PIN, ou coloque seu e-mail em PLATFORM_CEO_EMAILS no Railway.',
    });
    return false;
  }

  async function onLogin() {
    setBusy(true);
    setMsg(null);
    try {
      const em = email.trim().toLowerCase();
      if (!em.includes('@') || password.length < 4) {
        setMsg({ type: 'err', text: 'Informe e-mail e senha válidos.' });
        return;
      }
      if (apiOnline === false) {
        setMsg({
          type: 'err',
          text: `API offline (${getApiBaseUrl()}). Não dá para entrar no HQ sem nuvem.`,
        });
        return;
      }
      const res = await login(em, password);
      if (!res.success) {
        setMsg({ type: 'err', text: res.error || 'Não foi possível entrar.' });
        return;
      }
      await enterIfStaff();
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
      // Prefere API direta via register do Auth (já sobe pra cloud)
      const remote = await platformRegister({
        name: name.trim(),
        email: em,
        phone: '',
        password,
        address: '',
      });
      if (!remote) {
        setMsg({ type: 'err', text: 'API offline — não deu para criar a conta.' });
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
        setMsg({
          type: 'ok',
          text: 'Conta criada. Entre com o mesmo e-mail e senha.',
        });
        setMode('login');
        return;
      }
      setMsg({ type: 'ok', text: 'Conta criada na nuvem.' });
      await enterIfStaff();
    } finally {
      setBusy(false);
    }
  }

  async function onRequestReset() {
    setBusy(true);
    setMsg(null);
    setShownCode('');
    try {
      const em = email.trim().toLowerCase();
      if (!em.includes('@')) {
        setMsg({ type: 'err', text: 'Informe o e-mail da conta.' });
        return;
      }
      const remote = await platformRequestPasswordReset(em);
      if (!remote) {
        setMsg({ type: 'err', text: 'API offline — recuperação indisponível.' });
        return;
      }
      const code =
        (typeof (remote as any).resetToken === 'string' && (remote as any).resetToken) ||
        (typeof (remote as any).devResetToken === 'string' && (remote as any).devResetToken) ||
        '';
      if (code) {
        setShownCode(String(code).toUpperCase());
        setResetCode(String(code).toUpperCase());
        setMsg({
          type: 'ok',
          text: 'Código gerado. Use-o abaixo com a nova senha (válido ~20 min).',
        });
      } else if (remote.ok) {
        setMsg({
          type: 'info',
          text:
            'Pedido ok, mas o servidor não devolveu o código. No Railway: EXPOSE_PASSWORD_RESET_CODE≠0 e redeploy.',
        });
      } else {
        setMsg({ type: 'err', text: remote.message || 'Falha na recuperação.' });
      }
    } finally {
      setBusy(false);
    }
  }

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
      const token = await getPlatformToken();
      if (!token) {
        setMsg({ type: 'err', text: 'Faça login antes de ativar o HQ.' });
        setMode('login');
        return;
      }
      const res = await platformAdminClaimCeo(token, supportPin.trim());
      if (!res?.ok) {
        setMsg({
          type: 'err',
          text: (res as any)?.message || 'PIN inválido. Confira SUPPORT_PIN no Railway e redeploy.',
        });
        return;
      }
      const u = asPlatformUser(res);
      if (u?.platformRole === 'ceo') {
        await updateProfile({ platformRole: 'ceo' });
        router.replace('/admin/overview' as any);
        return;
      }
      setMsg({ type: 'err', text: 'Ativação não retornou papel CEO.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>PEÇA JÁ</Text>
        <Text style={styles.title}>Painel HQ</Text>
        <Text style={styles.sub}>
          Operação da plataforma — lojas, pedidos, frota e equipe.
        </Text>
        <View
          style={[
            styles.apiPill,
            apiOnline === true && styles.apiOn,
            apiOnline === false && styles.apiOff,
          ]}
        >
          <Text style={styles.apiPillText}>
            {apiOnline === null
              ? 'Checando API…'
              : apiOnline
                ? `API online · ${getApiBaseUrl().replace(/^https?:\/\//, '')}`
                : 'API offline — login cloud indisponível'}
          </Text>
        </View>
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
                setMsg(null);
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
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Senha"
              placeholderTextColor={hq.faint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void onLogin()}
            />
            <TouchableOpacity
              style={[hqStyles.btn, busy && { opacity: 0.7 }]}
              onPress={() => void onLogin()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#04140c" />
              ) : (
                <Text style={hqStyles.btnText}>Entrar no HQ</Text>
              )}
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
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[hqStyles.input, styles.gap]}
              placeholder="Senha (mín. 6)"
              placeholderTextColor={hq.faint}
              secureTextEntry
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
              Depois do login, use o SUPPORT_PIN do Railway para virar CEO nesta conta.
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
              onPress={() => void logout().then(() => setMode('login'))}
            >
              <Text style={hqStyles.btnGhostText}>Trocar conta</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hq.bg },
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
});
