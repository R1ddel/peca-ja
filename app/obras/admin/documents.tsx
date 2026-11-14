import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';
import { addDocument, getActiveProject, listDocuments } from '@/utils/obrasStore';
import { ObrasDocument } from '@/types/obras';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  invoice: 'receipt-outline',
  spreadsheet: 'grid-outline',
  plan: 'map-outline',
  other: 'document-outline',
};

const TYPE_LABELS: Record<string, string> = {
  invoice: 'Nota fiscal',
  spreadsheet: 'Planilha',
  plan: 'Planta / Plano',
  other: 'Outro',
};

export default function ObrasAdminDocuments() {
  const [docs, setDocs] = useState<ObrasDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getActiveProject();
    if (!p) {
      router.replace('/obras/projects' as any);
      return;
    }
    setProjectId(p.id);
    setDocs(await listDocuments(p.id));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function simulateUpload(type: ObrasDocument['type']) {
    const names: Record<string, string> = {
      invoice: `NF-${Date.now().toString().slice(-4)}.pdf`,
      spreadsheet: `Planilha-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`,
      plan: 'Documento-obra.pdf',
      other: 'Arquivo.pdf',
    };
    Alert.alert('Upload simulado', `Em produção, aqui você faria upload de ${TYPE_LABELS[type]}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Simular',
        onPress: () => {
          void (async () => {
            await addDocument({
              id: `doc-${Date.now()}`,
              projectId,
              name: names[type],
              type,
              uploadedAt: new Date().toISOString(),
            });
            await load();
          })();
        },
      },
    ]);
  }

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Documentos" subtitle="Notas fiscais e planilhas" showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>Enviar arquivo</Text>
          <View style={styles.uploadRow}>
            {(['invoice', 'spreadsheet', 'plan'] as const).map((t) => (
              <TouchableOpacity key={t} style={styles.uploadBtn} onPress={() => simulateUpload(t)}>
                <Ionicons name={TYPE_ICONS[t]} size={22} color={obrasTheme.colors.secondary} />
                <Text style={styles.uploadLabel}>{TYPE_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.section}>Arquivos salvos ({docs.length})</Text>
          {docs.map((d) => (
            <View key={d.id} style={styles.card}>
              <Ionicons name={TYPE_ICONS[d.type] ?? 'document-outline'} size={24} color={obrasTheme.colors.primary} />
              <View style={styles.body}>
                <Text style={styles.name}>{d.name}</Text>
                <Text style={styles.meta}>
                  {TYPE_LABELS[d.type]} · {new Date(d.uploadedAt).toLocaleDateString('pt-BR')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginBottom: 10 },
  uploadRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  uploadBtn: {
    flex: 1,
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    borderStyle: 'dashed',
  },
  uploadLabel: { fontSize: 10, fontWeight: '700', color: obrasTheme.colors.textSecondary, textAlign: 'center' },
  card: {
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
  body: { flex: 1 },
  name: { fontSize: obrasTheme.fontSize.sm, fontWeight: '600', color: obrasTheme.colors.text },
  meta: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
});
