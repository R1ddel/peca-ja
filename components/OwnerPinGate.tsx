import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import {
  ensureOwnerMember,
  ownerEnterWithPin,
  FIXED_PANEL_PIN,
  StaffSession,
} from '@/utils/merchantTeam';
import { theme } from '@/constants/theme';

type Props = {
  businessId: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  /** E-mail logado no app — deve ser o da compra. */
  actorEmail?: string | null;
  accent?: string;
  onEntered: (session: StaffSession) => void;
};

/** Gate do painel do dono — só o e-mail da compra + PIN. */
export function OwnerPinGate({
  businessId,
  shopName,
  ownerName,
  ownerEmail,
  actorEmail,
  accent = '#0F766E',
  onEntered,
}: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hintPin, setHintPin] = useState(FIXED_PANEL_PIN);

  useEffect(() => {
    void (async () => {
      const owner = await ensureOwnerMember({
        businessId,
        name: ownerName,
        email: ownerEmail,
      });
      setHintPin(owner.pin || FIXED_PANEL_PIN);
    })();
  }, [businessId, ownerName, ownerEmail]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await ownerEnterWithPin({
        businessId,
        ownerName,
        ownerEmail,
        actorEmail: actorEmail ?? ownerEmail,
        pin,
      });
      if (!res.ok) {
        setError(res.error);
        setPin('');
        return;
      }
      onEntered(res.session);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Dono" fallbackHref="/merchant/advanced" />
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: accent }]}>
          <Ionicons name="shield" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.shop}>{shopName}</Text>
            <Text style={styles.title}>Painel do dono</Text>
            <Text style={styles.sub}>
              Conta: {ownerEmail}. Digite o PIN do dono (padrão: {hintPin}).
            </Text>
          </View>
        </View>

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
          style={[
            styles.btn,
            { backgroundColor: accent, opacity: busy || pin.length < 4 ? 0.65 : 1 },
          ]}
          disabled={busy || pin.length < 4}
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>

        {__DEV__ ? (
          <TouchableOpacity
            style={styles.quick}
            onPress={() => setPin(FIXED_PANEL_PIN)}
          >
            <Text style={[styles.quickText, { color: accent }]}>
              [DEV] Preencher PIN de teste
            </Text>
          </TouchableOpacity>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16 },
  hero: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  shop: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  title: { color: '#fff', fontSize: 20, fontWeight: theme.fontWeight.extrabold, marginTop: 2 },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, lineHeight: 18 },
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
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 16 },
  quick: { alignItems: 'center', marginTop: 16 },
  quickText: { fontWeight: theme.fontWeight.semibold, fontSize: 13 },
  error: { color: theme.colors.error, marginTop: 14, textAlign: 'center', lineHeight: 20 },
});
