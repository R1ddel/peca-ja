import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { obrasTheme } from '@/constants/obrasTheme';
import { loginObras } from '@/utils/obrasStore';

const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

const DEMO_ACCOUNTS = [
  { email: 'engenheiro@obras.app', role: 'admin' as const, label: 'Engenheiro / Dono' },
  { email: 'encarregado@obras.app', role: 'foreman' as const, label: 'Encarregado' },
  { email: 'pedro@obras.app', role: 'worker' as const, label: 'Funcionário' },
];

export default function ObrasLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const result = await loginObras(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace('/obras/projects' as any);
  }

  function quickLogin(demoEmail: string) {
    if (!DEMO_MODE) return;
    setEmail(demoEmail);
    setPassword('');
  }

  return (
    <MobileShell style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={obrasTheme.colors.textMuted} />
            <Text style={styles.backText}>Voltar ao app</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={styles.logoBox}>
              <Ionicons name="business" size={36} color={obrasTheme.colors.white} />
            </View>
            <Text style={styles.heroTitle}>Obras</Text>
            <Text style={styles.heroSub}>Engenharia · Planejamento · Controle</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="E-mail"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Senha"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              isPassword
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Entrar" onPress={handleLogin} loading={loading} style={styles.btn} />
          </View>

          {DEMO_MODE ? <Text style={styles.demoTitle}>Ambiente demo — use as contas de teste</Text> : null}
          {DEMO_MODE ? DEMO_ACCOUNTS.map((acc) => (
            <TouchableOpacity
              key={acc.email}
              style={styles.demoCard}
              onPress={() => quickLogin(acc.email)}
            >
              <Ionicons
                name={acc.role === 'admin' ? 'shield-checkmark' : acc.role === 'foreman' ? 'hammer' : 'person'}
                size={22}
                color={obrasTheme.colors.primary}
              />
              <View style={styles.demoBody}>
                <Text style={styles.demoLabel}>{acc.label}</Text>
                <Text style={styles.demoEmail}>{acc.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={obrasTheme.colors.textMuted} />
            </TouchableOpacity>
          )) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obrasTheme.colors.background },
  scroll: { padding: obrasTheme.spacing.lg, paddingBottom: 48 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: obrasTheme.spacing.lg },
  backText: { color: obrasTheme.colors.textMuted, fontSize: obrasTheme.fontSize.sm },
  hero: { alignItems: 'center', marginBottom: obrasTheme.spacing.xl },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: obrasTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: obrasTheme.fontSize.hero, fontWeight: '900', color: obrasTheme.colors.text },
  heroSub: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 4 },
  form: { marginBottom: obrasTheme.spacing.lg },
  error: { color: obrasTheme.colors.error, fontSize: obrasTheme.fontSize.sm, marginBottom: 8 },
  btn: { backgroundColor: obrasTheme.colors.primary },
  demoTitle: {
    fontSize: obrasTheme.fontSize.xs,
    fontWeight: '700',
    color: obrasTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    gap: 12,
  },
  demoBody: { flex: 1 },
  demoLabel: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  demoEmail: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
});
