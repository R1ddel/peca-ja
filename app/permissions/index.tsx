import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { theme } from '@/constants/theme';
import {
  PermissionId,
  PermissionInfo,
  getPermissionStatuses,
  openSystemSettings,
  requestPermission,
} from '@/services/permissions';

const STATUS_LABEL: Record<string, string> = {
  granted: 'Permitido',
  denied: 'Negado',
  undetermined: 'Não perguntado',
  unavailable: 'Indisponível',
};

const STATUS_COLOR: Record<string, string> = {
  granted: theme.colors.primary,
  denied: theme.colors.error,
  undetermined: theme.colors.warning,
  unavailable: theme.colors.textMuted,
};

export default function PermissionsScreen() {
  const [items, setItems] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<PermissionId | null>(null);

  const refresh = useCallback(async () => {
    const list = await getPermissionStatuses();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleRequest(id: PermissionId) {
    setBusyId(id);
    try {
      const status = await requestPermission(id);
      await refresh();
      if (status === 'denied') {
        Alert.alert(
          'Permissão negada',
          'Abra os ajustes do celular e libere esta permissão para o Peça Já / Expo Go.',
          [
            { text: 'Ok', style: 'cancel' },
            { text: 'Abrir ajustes', onPress: () => void openSystemSettings() },
          ]
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <BackHeader title="Permissões" fallbackHref="/(tabs)/profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Text style={styles.intro}>
          O Peça Já pede só o necessário: avisos de pedido, localização para
          comércios próximos, e câmera/fotos para o perfil.
        </Text>

        {Platform.OS === 'android' && (
          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.noteText}>
              No Expo Go (Android), notificações push remotas não estão disponíveis.
              Usamos notificações locais para o status do pedido.
            </Text>
          </View>
        )}

        {loading ? (
          <Text style={styles.loading}>Carregando…</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${STATUS_COLOR[item.status]}22` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.why}>{item.why}</Text>
              {item.status !== 'granted' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    item.canAskAgain || item.status === 'undetermined'
                      ? handleRequest(item.id)
                      : openSystemSettings()
                  }
                  disabled={busyId === item.id}
                >
                  <Text style={styles.actionText}>
                    {busyId === item.id
                      ? 'Solicitando…'
                      : item.canAskAgain || item.status === 'undetermined'
                        ? 'Permitir'
                        : 'Abrir ajustes do sistema'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        <Button
          title="Abrir ajustes do celular"
          variant="outline"
          onPress={openSystemSettings}
          style={{ marginTop: theme.spacing.md }}
        />

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL('app-settings:')}
          >
            <Text style={styles.linkText}>Preferências do iOS</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  intro: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  loading: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  statusText: { fontSize: 10, fontWeight: theme.fontWeight.bold },
  why: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    lineHeight: 16,
  },
  actionBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  linkBtn: { alignItems: 'center', marginTop: theme.spacing.md },
  linkText: { color: theme.colors.primaryDark, fontSize: theme.fontSize.sm },
});
