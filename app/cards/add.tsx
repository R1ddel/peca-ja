import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { theme } from '@/constants/theme';
import {
  CardKind,
  addSavedCard,
  brandLabel,
  detectBrand,
  formatCardNumberInput,
  formatCpfInput,
  formatExpiryInput,
} from '@/services/cards';
import { useAuth } from '@/context/AuthContext';

export default function AddCardScreen() {
  const { user } = useAuth();
  const [number, setNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [kind, setKind] = useState<CardKind>('credit');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = useMemo(() => detectBrand(number), [number]);

  async function handleSave() {
    setError(null);
    if (!user?.email) {
      setError('Faça login para salvar um cartão.');
      return;
    }
    const [mm, yy] = expiry.split('/');
    setLoading(true);
    try {
      const result = await addSavedCard({
        number,
        holderName,
        expMonth: mm ?? '',
        expYear: yy ?? '',
        cvv,
        kind,
        setAsDefault,
        email: user.email,
        identificationNumber: cpf,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      Alert.alert('Cartão salvo', `${brandLabel(result.card.brand)} •••• ${result.card.last4}`, [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) router.back();
            else router.replace('/cards' as any);
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <BackHeader title="Cadastrar cartão" fallbackHref="/cards" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            <Text style={styles.previewBrand}>{brandLabel(brand)}</Text>
            <Text style={styles.previewNumber}>
              {number.trim() || '•••• •••• •••• ••••'}
            </Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewSmall}>
                {(holderName || 'NOME NO CARTÃO').toUpperCase()}
              </Text>
              <Text style={styles.previewSmall}>{expiry || 'MM/AA'}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Tipo</Text>
          <View style={styles.kindRow}>
            {(
              [
                { id: 'credit' as const, label: 'Crédito' },
                { id: 'debit' as const, label: 'Débito' },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.kindChip, kind === opt.id && styles.kindChipOn]}
                onPress={() => setKind(opt.id)}
              >
                <Text style={[styles.kindText, kind === opt.id && styles.kindTextOn]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Número do cartão"
            placeholder="0000 0000 0000 0000"
            value={number}
            onChangeText={(t) => setNumber(formatCardNumberInput(t))}
            keyboardType="number-pad"
            icon="card-outline"
            maxLength={23}
          />
          <Input
            label="Nome impresso"
            placeholder="Como no cartão"
            value={holderName}
            onChangeText={setHolderName}
            autoCapitalize="characters"
            icon="person-outline"
          />
          <Input
            label="CPF do titular"
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={(t) => setCpf(formatCpfInput(t))}
            keyboardType="number-pad"
            maxLength={14}
            icon="document-text-outline"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label="Validade"
                placeholder="MM/AA"
                value={expiry}
                onChangeText={(t) => setExpiry(formatExpiryInput(t))}
                keyboardType="number-pad"
                maxLength={5}
                icon="calendar-outline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="CVV"
                placeholder="***"
                value={cvv}
                onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                isPassword
                icon="lock-closed-outline"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.defaultRow}
            onPress={() => setSetAsDefault((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: setAsDefault }}
          >
            <Ionicons
              name={setAsDefault ? 'checkbox' : 'square-outline'}
              size={22}
              color={theme.colors.primary}
            />
            <Text style={styles.defaultLabel}>Definir como cartão padrão</Text>
          </TouchableOpacity>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.secureNote}>
            O CVV é usado só para validar agora e não é salvo. Em produção a
            tokenização acontece no servidor de pagamentos.
          </Text>

          <Button title="Salvar cartão" onPress={handleSave} loading={loading} size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  preview: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  previewBrand: {
    color: theme.colors.primaryMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  previewNumber: {
    color: theme.colors.white,
    fontSize: 20,
    letterSpacing: 2,
    fontWeight: theme.fontWeight.semibold,
    marginVertical: theme.spacing.md,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewSmall: {
    color: theme.colors.primaryMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  kindRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  kindChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  kindChipOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  kindText: { color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  kindTextOn: { color: theme.colors.primaryDark, fontWeight: theme.fontWeight.semibold },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  defaultLabel: { fontSize: theme.fontSize.md, color: theme.colors.text },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
  },
  secureNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
});
