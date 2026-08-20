import React, { useState } from 'react';
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
import {
  FIXED_PANEL_PIN,
  recoverStaffEmails,
  resetStaffPassword,
  STAFF_ROLE_LABEL,
} from '@/utils/merchantTeam';
import { theme } from '@/constants/theme';

type Mode = 'menu' | 'email' | 'password';

/**
 * Recuperação local de e-mail / senha da equipe (sem e-mail real — MVP).
 */
export default function StaffForgotScreen() {
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [foundEmails, setFoundEmails] = useState<
    { name: string; email: string; role: string }[]
  >([]);

  async function findEmail() {
    setBusy(true);
    try {
      const res = await recoverStaffEmails({ name });
      if (!res.ok) {
        Alert.alert('E-mail', res.error);
        setFoundEmails([]);
        return;
      }
      setFoundEmails(
        res.matches.map((m) => ({
          name: m.name,
          email: m.email,
          role: STAFF_ROLE_LABEL[m.role],
        }))
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    try {
      const res = await resetStaffPassword({
        email,
        newPassword,
        confirmPin,
      });
      if (!res.ok) {
        Alert.alert('Senha', res.error);
        return;
      }
      Alert.alert('Senha atualizada', 'Agora entre com o e-mail e a nova senha.', [
        {
          text: 'Ir para login',
          onPress: () => router.replace('/merchant/staff/login' as any),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Esqueci e-mail ou senha" fallbackHref="/merchant/staff/login" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        {mode === 'menu' ? (
          <>
            <View style={styles.hero}>
              <Ionicons name="help-circle" size={28} color="#fff" />
              <Text style={styles.heroTitle}>Recuperar acesso</Text>
              <Text style={styles.heroSub}>
                Por enquanto a recuperação é local neste aparelho. Confirme com o PIN do painel
                (4 dígitos definidos para a equipe).
              </Text>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => setMode('email')} activeOpacity={0.9}>
              <Ionicons name="mail-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Esqueci o e-mail</Text>
                <Text style={styles.cardSub}>Buscar pelo nome cadastrado</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => setMode('password')}
              activeOpacity={0.9}
            >
              <Ionicons name="key-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Esqueci a senha</Text>
                <Text style={styles.cardSub}>Redefinir com e-mail + PIN do painel</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'email' ? (
          <>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Esqueci o e-mail</Text>
            <Input
              label="Seu nome (como cadastrou)"
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Maria"
            />
            <Button title="Buscar e-mail" onPress={() => void findEmail()} loading={busy} size="lg" />
            {foundEmails.map((m) => (
              <View key={m.email} style={styles.result}>
                <Text style={styles.resultName}>
                  {m.name} · {m.role}
                </Text>
                <Text style={styles.resultEmail}>{m.email}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEmail(m.email);
                    setMode('password');
                  }}
                >
                  <Text style={styles.resultLink}>Usar este e-mail para redefinir senha</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}

        {mode === 'password' ? (
          <>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Esqueci a senha</Text>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Nova senha"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mín. 4 caracteres"
              isPassword
            />
            <Input
              label="Confirmar com PIN do painel"
              value={confirmPin}
              onChangeText={(t) => setConfirmPin(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              keyboardType="number-pad"
              maxLength={4}
              isPassword
            />
            <Button
              title="Salvar nova senha"
              onPress={() => void resetPassword()}
              loading={busy}
              size="lg"
            />
          </>
        ) : null}
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 48, gap: 8 },
  hero: {
    backgroundColor: '#0369A1',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: theme.fontWeight.extrabold },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 15 },
  cardSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  back: { marginBottom: 4 },
  backText: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  title: {
    fontSize: 20,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  result: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  resultName: { fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  resultEmail: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: 15 },
  resultLink: { color: theme.colors.primary, marginTop: 6, fontSize: 13 },
});
