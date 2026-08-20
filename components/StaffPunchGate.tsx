import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import {
  STAFF_ROLE_LABEL,
  StaffMember,
  StaffSession,
} from '@/utils/merchantTeam';
import {
  listPunchableStaff,
  punchInAndEnter,
  PunchRole,
} from '@/utils/merchantPunch';
import { theme } from '@/constants/theme';

type Props = {
  businessId: string;
  shopName: string;
  role: PunchRole;
  accent: string;
  onPunched: (session: StaffSession) => void;
};

/**
 * Gate de bater ponto — escolhe nome + PIN pessoal + entrada.
 */
export function StaffPunchGate({ businessId, shopName, role, accent, onPunched }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMembers(await listPunchableStaff(businessId, role));
    } finally {
      setLoading(false);
    }
  }, [businessId, role]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await punchInAndEnter(selected, pin);
      if (!res.ok) {
        setError(res.error);
        setPin('');
        return;
      }
      onPunched(res.session);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Bater ponto" fallbackHref="/merchant/advanced" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: accent }]}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroShop}>{shopName}</Text>
            <Text style={styles.heroTitle}>Ponto · {STAFF_ROLE_LABEL[role]}</Text>
            <Text style={styles.heroSub}>
              Escolha seu nome e digite o PIN pessoal de 4 dígitos.
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 28 }} />
        ) : members.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Ninguém cadastrado nesta função</Text>
            <Text style={styles.emptyText}>
              O dono precisa cadastrar o funcionário em Equipe (com PIN pessoal).
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: accent }]}
              onPress={() => router.push('/merchant/team' as any)}
            >
              <Text style={styles.emptyBtnText}>Abrir Equipe</Text>
            </TouchableOpacity>
          </View>
        ) : !selected ? (
          <>
            <Text style={styles.label}>Quem está entrando?</Text>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.card, { borderColor: accent + '44' }]}
                activeOpacity={0.88}
                onPress={() => {
                  setSelected(m);
                  setPin('');
                  setError('');
                }}
              >
                <View style={[styles.avatar, { backgroundColor: accent + '18' }]}>
                  <Ionicons name="person" size={22} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.email}>{m.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View style={styles.pinBox}>
            <Text style={styles.label}>PIN de {selected.name}</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: accent, opacity: busy ? 0.7 : 1 }]}
              disabled={busy || pin.length < 4}
              onPress={() => void submit()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="finger-print" size={18} color="#fff" />
                  <Text style={styles.submitText}>Bater ponto e entrar</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => {
                setSelected(null);
                setPin('');
                setError('');
              }}
            >
              <Text style={[styles.backLinkText, { color: accent }]}>Trocar pessoa</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  heroShop: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: 2,
  },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  email: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  pinBox: { marginTop: 4 },
  pinInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: 14,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 15 },
  backLink: { alignItems: 'center', marginTop: 14 },
  backLinkText: { fontWeight: theme.fontWeight.semibold },
  empty: { alignItems: 'center', gap: 8, paddingTop: 36, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold },
  error: { color: theme.colors.error, marginTop: 12, textAlign: 'center' },
});
