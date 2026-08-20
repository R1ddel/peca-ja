import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveDriverApplication } from '@/utils/partners';
import { driverFleetId } from '@/utils/driverOps';
import {
  DriverWallet,
  saveDriverPixKey,
} from '@/utils/driverWallet';
import { getDriverWallet } from '@/utils/driverWallet';
import { PixKeyType, pixKeyTypeLabel } from '@/utils/merchantWallet';
import { theme } from '@/constants/theme';

const TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'phone', 'random'];

export default function DriverPixScreen() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [holder, setHolder] = useState('');
  const [document, setDocument] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const app = await resolveDriverApplication(user?.email);
        if (!app || app.status !== 'approved') return;
        const id = driverFleetId(app);
        setDriverId(id);
        setAppId(app.id);
        const w = await getDriverWallet(id);
        setWallet(w);
        if (w?.pixKeyType) setPixKeyType(w.pixKeyType);
        if (w?.pixKey) setPixKey(w.pixKey);
        if (w?.pixHolderName) setHolder(w.pixHolderName);
        else setHolder(app.name);
        if (w?.pixDocument) setDocument(w.pixDocument);
        else if (app.document) setDocument(String(app.document).replace(/\D/g, ''));
      })();
    }, [user?.email])
  );

  async function save() {
    if (!driverId || !appId) return;
    setSaving(true);
    try {
      const next = await saveDriverPixKey({
        driverId,
        applicationId: appId,
        pixKey,
        pixKeyType,
        pixHolderName: holder,
        pixDocument: document,
      });
      setWallet(next);
      Alert.alert('Chave Pix', 'Salva com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Chave Pix', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Chave Pix" fallbackHref="/driver/wallet" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Cadastre onde você recebe o frete. O saldo nasce das entregas confirmadas.
        </Text>

        <Text style={styles.label}>Tipo da chave</Text>
        <View style={styles.types}>
          {TYPES.map((t) => {
            const on = pixKeyType === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, on && styles.typeChipOn]}
                onPress={() => setPixKeyType(t)}
              >
                <Text style={[styles.typeText, on && styles.typeTextOn]}>
                  {pixKeyTypeLabel(t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Chave</Text>
        <TextInput
          style={styles.input}
          value={pixKey}
          onChangeText={setPixKey}
          placeholder="Sua chave Pix"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Nome do titular</Text>
        <TextInput
          style={styles.input}
          value={holder}
          onChangeText={setHolder}
          placeholder="Como no banco"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={styles.label}>CPF ou CNPJ</Text>
        <TextInput
          style={styles.input}
          value={document}
          onChangeText={setDocument}
          placeholder="Somente números"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
        />

        {wallet?.pixKey ? (
          <Text style={styles.current}>
            Atual: {pixKeyTypeLabel(wallet.pixKeyType!)} · {wallet.pixKey}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.save, saving && { opacity: 0.5 }]}
          onPress={() => void save()}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar chave Pix'}</Text>
        </TouchableOpacity>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  intro: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 6 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeChipOn: {
    backgroundColor: theme.colors.primary + '18',
    borderColor: theme.colors.primary,
  },
  typeText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  typeTextOn: { color: theme.colors.primary },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  current: { color: theme.colors.textMuted, fontSize: 12 },
  save: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
});
