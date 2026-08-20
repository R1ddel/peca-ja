import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import {
  DRIVER_TERMS_TITLE,
  DRIVER_TERMS_VERSION,
  buildDriverTermsBody,
} from '@/constants/driverTerms';
import {
  DriverApplication,
  acceptDriverTerms,
  getApplicationById,
  hasAcceptedDriverTerms,
  resolveDriverApplication,
} from '@/utils/partners';
import { getDriverSession } from '@/utils/driverSession';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';

export default function DriverTermsScreen() {
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [app, setApp] = useState<DriverApplication | null>(null);
  const [appId, setAppId] = useState<string | null>(paramId || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readOk, setReadOk] = useState(false);
  const [agree, setAgree] = useState(false);
  const [liabilityOk, setLiabilityOk] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerDoc, setSignerDoc] = useState('');
  const alreadyAccepted = app ? hasAcceptedDriverTerms(app) : false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedId = paramId || null;
      if (!resolvedId) {
        const session = await getDriverSession();
        if (session?.applicationId) resolvedId = session.applicationId;
      }
      let found: DriverApplication | null = null;
      if (resolvedId) {
        found = await getApplicationById(resolvedId);
      }
      if (!found || found.role !== 'driver') {
        found = await resolveDriverApplication(user?.email);
        resolvedId = found?.id || null;
      }
      if (!cancelled && found?.role === 'driver') {
        setApp(found);
        setAppId(found.id);
        setSignerName(found.name);
        setSignerDoc(found.document || '');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [paramId, user?.email]);

  const termsBody = useMemo(() => {
    if (!app) return '';
    return buildDriverTermsBody({
      name: app.name,
      document: app.document,
      vehicleType: app.vehicleType || app.vehicle || 'Veículo',
      plate: app.plate,
      city: app.city,
    });
  }, [app]);

  async function finish() {
    if (!appId || !app) return;
    if (!readOk || !agree || !liabilityOk) {
      Alert.alert(
        'Termo',
        'Leia o termo e marque todas as confirmações, inclusive a de isenção de responsabilidade.'
      );
      return;
    }
    if (!signerName.trim()) {
      Alert.alert('Identificação', 'Informe o nome completo de quem está aceitando.');
      return;
    }
    if (signerDoc.replace(/\D/g, '').length !== 11) {
      Alert.alert('CPF', 'Informe o CPF de quem está assinando.');
      return;
    }

    setSaving(true);
    try {
      const updated = await acceptDriverTerms(appId, {
        method: 'aceite_eletronico',
        signerName,
        signerDocument: signerDoc,
      });
      if (!updated) {
        Alert.alert('Termo', 'Não foi possível registrar o aceite.');
        return;
      }
      Alert.alert(
        'Termo aceito',
        updated.status === 'approved'
          ? 'Painel liberado. Boas entregas!'
          : 'Aceite registrado. Seu cadastro segue em análise. Você já pode abrir o painel e aguardar a aprovação.',
        [{ text: 'Abrir painel', onPress: () => router.replace('/driver' as any) }]
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color="#7C3AED" />
        </View>
      </MobileShell>
    );
  }

  if (!app) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Termo" fallbackHref="/driver/login" />
        <Text style={styles.missing}>Cadastro não encontrado. Faça login ou registre-se.</Text>
        <View style={{ padding: 16 }}>
          <Button title="Ir para login" onPress={() => router.replace('/driver/login' as any)} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Termo de responsabilidade" fallbackHref="/driver" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{DRIVER_TERMS_TITLE}</Text>
            <Text style={styles.bannerSub}>Versão {DRIVER_TERMS_VERSION}</Text>
          </View>
        </View>

        {alreadyAccepted ? (
          <View style={styles.acceptedBox}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={styles.acceptedText}>
              Termo já aceito neste cadastro. Você pode reler o texto abaixo.
            </Text>
          </View>
        ) : null}

        <View style={styles.warn}>
          <Ionicons name="warning" size={18} color="#B45309" />
          <Text style={styles.warnText}>
            Este termo deixa claro que acidentes, multas, danos ao pedido e condutas na rua são de
            responsabilidade do entregador — não do Peça Já.
          </Text>
        </View>

        <ScrollView style={styles.termsBox} nestedScrollEnabled>
          <Text style={styles.termsText}>{termsBody}</Text>
        </ScrollView>

        {!alreadyAccepted ? (
          <>
            <CheckRow
              checked={readOk}
              onPress={() => setReadOk((v) => !v)}
              label="Li integralmente o Termo de Responsabilidade e Isenção."
            />
            <CheckRow
              checked={agree}
              onPress={() => setAgree((v) => !v)}
              label="Concordo com todas as cláusulas e com a natureza autônoma da relação (sem vínculo empregatício)."
            />
            <CheckRow
              checked={liabilityOk}
              onPress={() => setLiabilityOk((v) => !v)}
              label="Declaro que o Peça Já não responde por minhas ações, omissões, acidentes ou ilícitos no exercício das entregas, e que assumo esses riscos."
            />

            <Input
              label="Nome completo do assinante *"
              value={signerName}
              onChangeText={setSignerName}
              icon="person-outline"
            />
            <Input
              label="CPF do assinante *"
              value={signerDoc}
              onChangeText={setSignerDoc}
              icon="document-text-outline"
              keyboardType="number-pad"
            />

            <Button
              title="Aceitar termo e continuar"
              onPress={() => void finish()}
              loading={saving}
              size="lg"
              disabled={!readOk || !agree || !liabilityOk}
              style={{ marginTop: 8 }}
            />
          </>
        ) : (
          <Button
            title="Voltar ao painel"
            onPress={() => router.replace('/driver' as any)}
            size="lg"
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </MobileShell>
  );
}

function CheckRow({
  checked,
  onPress,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.85}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? '#7C3AED' : theme.colors.textMuted}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  missing: { textAlign: 'center', margin: 24, color: theme.colors.textMuted },
  banner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#4C1D95',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 19 },
  bannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  acceptedBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  acceptedText: { flex: 1, color: '#065F46', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  warnText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  termsBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    maxHeight: 320,
    marginBottom: 14,
  },
  termsText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  checkRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  checkLabel: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 19 },
});
