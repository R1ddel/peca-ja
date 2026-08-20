import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import {
  StaffRole,
  STAFF_ROLE_LABEL,
  roleDescription,
  roleAccent,
  authenticateOperatorByPin,
  FIXED_PANEL_PIN,
  StaffSession,
} from '@/utils/merchantTeam';
import { theme } from '@/constants/theme';

const ROLE_OPTIONS: {
  role: StaffRole;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { role: 'owner', icon: 'shield-checkmark' },
  { role: 'manager', icon: 'briefcase' },
  { role: 'kitchen', icon: 'flame' },
  { role: 'cashier', icon: 'keypad' },
];

type Props = {
  businessId: string;
  ownerName: string;
  ownerEmail: string;
  shopName: string;
  /** Última função usada neste aparelho — abre direto no PIN. */
  preferredRole?: StaffRole | null;
  onAuthenticated: (session: StaffSession) => void;
};

/**
 * Quem está operando? → PIN.
 * Se já usou uma função antes, vai direto para o PIN dela.
 */
export function MerchantRoleGate({
  businessId,
  ownerName,
  ownerEmail,
  shopName,
  preferredRole = null,
  onAuthenticated,
}: Props) {
  const [role, setRole] = useState<StaffRole | null>(preferredRole);
  const [pickingRole, setPickingRole] = useState(!preferredRole);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preferredRole) {
      setRole(preferredRole);
      setPickingRole(false);
    }
  }, [preferredRole]);

  const accent = role ? roleAccent(role) : theme.colors.primary;

  const pinDots = useMemo(() => {
    return [0, 1, 2, 3].map((i) => (
      <View key={i} style={[styles.dot, i < pin.length && { backgroundColor: accent }]} />
    ));
  }, [pin, accent]);

  function chooseRole(next: StaffRole) {
    setRole(next);
    setPickingRole(false);
    setPin('');
    setError('');
  }

  function pressDigit(d: string) {
    if (pin.length >= 4 || busy) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) {
      void submit(next);
    }
  }

  function backspace() {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  async function submit(value: string) {
    if (!role) return;
    setBusy(true);
    setError('');
    try {
      const res = await authenticateOperatorByPin({
        businessId,
        role,
        pin: value,
        ownerName,
        ownerEmail,
      });
      if (!res.ok) {
        setError(res.error);
        setPin('');
        return;
      }
      onAuthenticated(res.session);
    } finally {
      setBusy(false);
    }
  }

  if (pickingRole || !role) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel" fallbackHref="/(tabs)/profile" />
        <KeyboardScreen contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>{shopName}</Text>
          <Text style={styles.title}>Entrar no painel</Text>
          <Text style={styles.sub}>
            Toque na função e digite o PIN de 4 dígitos da equipe.
          </Text>

          {preferredRole ? (
            <TouchableOpacity
              style={[styles.continueCard, { backgroundColor: roleAccent(preferredRole) }]}
              activeOpacity={0.9}
              onPress={() => chooseRole(preferredRole)}
            >
              <Ionicons name="flash" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.continueTitle}>
                  Continuar como {STAFF_ROLE_LABEL[preferredRole]}
                </Text>
                <Text style={styles.continueSub}>Acesso rápido · só o PIN</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}

          {ROLE_OPTIONS.map((opt) => {
            const color = roleAccent(opt.role);
            return (
              <TouchableOpacity
                key={opt.role}
                style={[styles.roleCard, { borderColor: color + '55' }]}
                activeOpacity={0.88}
                onPress={() => chooseRole(opt.role)}
              >
                <View style={[styles.roleIcon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={opt.icon} size={22} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleName}>{STAFF_ROLE_LABEL[opt.role]}</Text>
                  <Text style={styles.roleDesc}>{roleDescription(opt.role)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.altLink}
            onPress={() => router.push('/merchant/staff/login' as any)}
          >
            <Text style={styles.altLinkText}>Preferir e-mail e senha da equipe</Text>
          </TouchableOpacity>
        </KeyboardScreen>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="PIN" fallbackHref="/(tabs)/profile" />
      <KeyboardScreen contentContainerStyle={styles.pinContent}>
        <TouchableOpacity
          style={styles.backRole}
          onPress={() => {
            setPickingRole(true);
            setPin('');
            setError('');
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={18} color={accent} />
          <Text style={[styles.backRoleText, { color: accent }]}>Trocar função</Text>
        </TouchableOpacity>

        <View style={[styles.pinHero, { backgroundColor: accent }]}>
          <Ionicons
            name={
              role === 'owner'
                ? 'shield-checkmark'
                : role === 'manager'
                  ? 'briefcase'
                  : role === 'kitchen'
                    ? 'flame'
                    : 'keypad'
            }
            size={28}
            color="#fff"
          />
          <Text style={styles.pinHeroTitle}>{STAFF_ROLE_LABEL[role]}</Text>
          <Text style={styles.pinHeroSub}>Digite o PIN de 4 dígitos</Text>
        </View>

        <>
            <View style={styles.dots}>{pinDots}</View>
            <TextInput
              value={pin}
              onChangeText={(t) => {
                const n = t.replace(/\D/g, '').slice(0, 4);
                setPin(n);
                setError('');
                if (n.length === 4) void submit(n);
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              style={styles.hiddenInput}
              autoFocus
              caretHidden
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <Text style={styles.hint}>Entrando…</Text> : null}

            <View style={styles.pad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => {
                if (key === '') return <View key="empty" style={styles.padKey} />;
                const isDel = key === '⌫';
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.padKey}
                    onPress={() => (isDel ? backspace() : pressDigit(key))}
                    activeOpacity={0.75}
                    disabled={busy}
                  >
                    <Text style={[styles.padText, isDel && { fontSize: 22 }]}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  pinContent: { padding: theme.spacing.lg, paddingBottom: 48, alignItems: 'stretch' },
  kicker: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  sub: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
    fontSize: 14,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  continueTitle: {
    color: '#fff',
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 16,
  },
  continueSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: theme.colors.surface,
    marginBottom: 10,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleName: {
    fontWeight: theme.fontWeight.bold,
    fontSize: 16,
    color: theme.colors.text,
  },
  roleDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  altLink: { marginTop: 16, alignItems: 'center', padding: 8 },
  altLinkText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: 14,
  },
  backRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backRoleText: { fontWeight: theme.fontWeight.semibold, fontSize: 14 },
  pinHero: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'flex-start',
    gap: 8,
  },
  pinHeroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
  },
  pinHeroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.border,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  hint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    maxWidth: 320,
    alignSelf: 'center',
  },
  padKey: {
    width: '33.33%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padText: {
    fontSize: 28,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
});
