import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import {
  CONDUCT_CATEGORIES,
  submitConductReportToSupport,
} from '@/utils/conductReports';
import type { ConductReportCategory } from '@/types';
import { theme } from '@/constants/theme';
import { SUPPORT_EMAIL } from '@/data/supportBot';

function paramStr(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

/**
 * Denúncia grave com provas → suporte Peça Já (+ orientação legal).
 */
export default function ReportDriverScreen() {
  const { user } = useAuth();
  const { getOrder } = useOrders();
  const orderId = paramStr(useLocalSearchParams<{ orderId?: string }>().orderId);
  const order = getOrder(orderId);

  const [category, setCategory] = useState<ConductReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [policeAware, setPoliceAware] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => !!category && description.trim().length >= 20 && !!user && !!order,
    [category, description, user, order]
  );

  async function pickEvidence() {
    if (evidence.length >= 5) {
      Alert.alert('Limite', 'Você pode anexar até 5 fotos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão', 'Precisamos acessar as fotos para anexar provas.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5 - evidence.length,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setEvidence((prev) => [...prev, ...uris].slice(0, 5));
  }

  async function takePhoto() {
    if (evidence.length >= 5) {
      Alert.alert('Limite', 'Você pode anexar até 5 fotos.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão', 'Precisamos da câmera para capturar provas.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setEvidence((prev) => [...prev, result.assets[0].uri].slice(0, 5));
  }

  async function submit() {
    if (!user || !order || !category) return;
    setSubmitting(true);
    try {
      const res = await submitConductReportToSupport({
        orderId: order.id,
        businessId: order.businessId,
        businessName: order.businessName,
        driverId: order.driverId,
        driverName: order.driverName,
        reporterUserId: user.id,
        reporterName: user.name,
        reporterEmail: user.email,
        category,
        description,
        evidenceUris: evidence,
        policeAware,
      });
      if (!res.ok) {
        Alert.alert('Denúncia', res.error);
        return;
      }
      Alert.alert(
        'Denúncia enviada ao suporte',
        `Protocolo ${res.report.id}\n\nA equipe Peça Já vai analisar. Em crimes, registre também um Boletim de Ocorrência na polícia — o app não substitui a autoridade.\n\nE-mail: ${SUPPORT_EMAIL}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!order) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Denunciar entregador" fallbackHref="/(tabs)/orders" />
        <Text style={styles.missing}>Pedido não encontrado.</Text>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Denunciar conduta" fallbackHref={`/order/${order.id}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warn}>
          <Ionicons name="shield-checkmark" size={22} color="#991B1B" />
          <Text style={styles.warnText}>
            Use este canal para racismo, bullying, assédio, violência ou outros
            delitos. Anexe provas (prints, fotos). A denúncia vai direto ao
            suporte Peça Já ({SUPPORT_EMAIL}) para análise e medidas cabíveis.
          </Text>
        </View>

        <Text style={styles.meta}>
          Pedido #{order.id.slice(-6).toUpperCase()} ·{' '}
          {order.driverName || 'Entregador'} · {order.businessName}
        </Text>

        <Text style={styles.section}>Tipo de denúncia</Text>
        {CONDUCT_CATEGORIES.map((c) => {
          const selected = category === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.cat, selected && styles.catOn]}
              onPress={() => setCategory(c.id)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? '#991B1B' : theme.colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.catLabel, selected && styles.catLabelOn]}>
                  {c.label}
                </Text>
                <Text style={styles.catHint}>{c.hint}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.section}>Relato</Text>
        <TextInput
          style={styles.input}
          placeholder="Descreva o que aconteceu, com data/hora e detalhes..."
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        <Text style={styles.section}>Provas (fotos)</Text>
        <View style={styles.evidenceRow}>
          <TouchableOpacity style={styles.evBtn} onPress={() => void pickEvidence()}>
            <Ionicons name="images-outline" size={20} color="#991B1B" />
            <Text style={styles.evBtnText}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.evBtn} onPress={() => void takePhoto()}>
            <Ionicons name="camera-outline" size={20} color="#991B1B" />
            <Text style={styles.evBtnText}>Câmera</Text>
          </TouchableOpacity>
        </View>
        {evidence.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {evidence.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.thumbX}
                  onPress={() => setEvidence((prev) => prev.filter((u) => u !== uri))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.hint}>Opcional, mas recomendado para punição justa.</Text>
        )}

        <View style={styles.policeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.policeTitle}>Já registrei / vou registrar BO</Text>
            <Text style={styles.hint}>
              Em crime, o Boletim de Ocorrência na polícia é o caminho legal.
            </Text>
          </View>
          <Switch
            value={policeAware}
            onValueChange={setPoliceAware}
            trackColor={{ false: '#CBD5E1', true: '#FECACA' }}
            thumbColor={policeAware ? '#DC2626' : '#f4f4f5'}
          />
        </View>

        <Button
          title={submitting ? 'Enviando…' : 'Enviar ao suporte'}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!canSubmit || submitting}
          style={{ marginTop: 16, backgroundColor: '#DC2626' }}
        />
        {!user ? (
          <Text style={styles.hint}>Faça login para denunciar.</Text>
        ) : null}
        {submitting ? <ActivityIndicator color="#DC2626" style={{ marginTop: 8 }} /> : null}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 48 },
  missing: { textAlign: 'center', marginTop: 40, color: theme.colors.textMuted },
  warn: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  warnText: { flex: 1, color: '#7F1D1D', fontSize: 13, lineHeight: 19 },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 14 },
  section: {
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 8,
    fontSize: 15,
  },
  cat: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  catOn: { borderColor: '#F87171', backgroundColor: '#FEF2F2' },
  catLabel: { fontWeight: '700', color: theme.colors.text },
  catLabelOn: { color: '#991B1B' },
  catHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  evidenceRow: { flexDirection: 'row', gap: 10 },
  evBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  evBtnText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  thumbX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  policeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  policeTitle: { fontWeight: '700', color: theme.colors.text, fontSize: 13 },
});
