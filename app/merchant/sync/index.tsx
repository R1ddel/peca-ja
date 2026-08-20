import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { resolveActiveMerchantContext } from '@/utils/merchantStores';
import {
  exportMerchantSyncToClipboard,
  importMerchantSync,
  getOrCreateCloudSyncToken,
} from '@/utils/merchantSync';
import {
  getCloudSyncStatus,
  pullMerchantCloudSync,
  pushMerchantCloudSync,
} from '@/services/merchantCloudSync';
import {
  getStoredMerchantPushToken,
  registerMerchantPushToken,
} from '@/services/merchantPush';
import { getApiBaseUrl } from '@/services/apiBase';
import { theme } from '@/constants/theme';

export default function MerchantSyncScreen() {
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [importCode, setImportCode] = useState('');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [cloudToken, setCloudToken] = useState<string | null>(null);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [cloudOk, setCloudOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { app, shop } = await resolveActiveMerchantContext(user?.email);
    setAppId(app?.id ?? null);
    setShopName(shop?.name ?? '');
    setPushToken(await getStoredMerchantPushToken());
    if (app?.id) {
      const token = await getOrCreateCloudSyncToken(app.id);
      setCloudToken(token);
      const st = await getCloudSyncStatus(app.id);
      setCloudOk(st.ok);
      setCloudUpdatedAt(st.exists ? st.updatedAt ?? null : null);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function exportBackup() {
    if (!appId) return;
    setBusy(true);
    try {
      const res = await exportMerchantSyncToClipboard(appId);
      if (!res.ok) {
        Alert.alert('Sync', res.error);
        return;
      }
      Alert.alert(
        'Backup copiado',
        'Cole o código PECAJA2.… no outro aparelho. Inclui loja, saldo, equipe, pedidos, pontos e chats.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    setBusy(true);
    try {
      let raw = importCode.trim();
      if (!raw) {
        raw = (await Clipboard.getStringAsync()) || '';
      }
      const res = await importMerchantSync(raw);
      if (!res.ok) {
        Alert.alert('Importar', res.error);
        return;
      }
      setImportCode('');
      await refresh();
      Alert.alert('Importado', `${res.shopName} sincronizada neste aparelho.`);
    } finally {
      setBusy(false);
    }
  }

  async function pushCloud() {
    if (!appId) return;
    setBusy(true);
    try {
      const res = await pushMerchantCloudSync(appId);
      if (!res.ok) {
        Alert.alert('Nuvem', res.error);
        return;
      }
      setCloudUpdatedAt(res.updatedAt);
      setCloudOk(true);
      Alert.alert(
        'Enviado à nuvem',
        'Backup salvo no host do Expo. No outro aparelho (mesmo Wi‑Fi/API), toque em Baixar da nuvem.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function pullCloud() {
    if (!appId) return;
    setBusy(true);
    try {
      const res = await pullMerchantCloudSync(appId);
      if (!res.ok) {
        Alert.alert('Nuvem', res.error);
        return;
      }
      await refresh();
      Alert.alert('Baixado', `${res.shopName} atualizada neste aparelho.`);
    } finally {
      setBusy(false);
    }
  }

  async function copyCloudToken() {
    if (!cloudToken) return;
    await Clipboard.setStringAsync(cloudToken);
    Alert.alert(
      'Token copiado',
      'Cole este token no outro aparelho só se precisar recuperar o mesmo backup (avançado). Em geral o próprio sync leva o token.'
    );
  }

  async function registerPush() {
    setBusy(true);
    try {
      const token = await registerMerchantPushToken();
      setPushToken(token);
      if (!token) {
        Alert.alert(
          'Push',
          'Não foi possível registrar. Libere notificações nas configurações do aparelho.'
        );
        return;
      }
      await Clipboard.setStringAsync(token);
      Alert.alert('Push ativo', 'Token Expo copiado. Notificações locais de pedido novo já funcionam.');
    } finally {
      setBusy(false);
    }
  }

  const cloudWhen = (() => {
    if (!cloudUpdatedAt) return null;
    try {
      return new Date(cloudUpdatedAt).toLocaleString('pt-BR');
    } catch {
      return cloudUpdatedAt;
    }
  })();

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Sync e push" fallbackHref="/merchant" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="cloud-outline" size={24} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{shopName || 'Loja ativa'}</Text>
            <Text style={styles.cardSub}>
              Nuvem no host do Expo ({getApiBaseUrl()}). Também dá para copiar código offline.
            </Text>
            {cloudOk === false ? (
              <Text style={styles.cardWarn}>API offline — use backup por código ou confira o Wi‑Fi.</Text>
            ) : cloudWhen ? (
              <Text style={styles.cardMeta}>Último backup na nuvem: {cloudWhen}</Text>
            ) : (
              <Text style={styles.cardMeta}>Nenhum backup na nuvem ainda.</Text>
            )}
          </View>
        </View>

        <Text style={styles.section}>Nuvem (mesmo host Expo)</Text>
        <Button title="Enviar para a nuvem" onPress={() => void pushCloud()} loading={busy} />
        <Button
          title="Baixar da nuvem"
          variant="outline"
          onPress={() => void pullCloud()}
          loading={busy}
        />
        {cloudToken ? (
          <TouchableOpacity style={styles.tokenBox} onPress={() => void copyCloudToken()}>
            <Text style={styles.tokenLabel}>Token da loja (toque para copiar)</Text>
            <Text style={styles.token} numberOfLines={2}>
              {cloudToken}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.section}>Backup por código</Text>
        <Button title="Exportar e copiar código" onPress={() => void exportBackup()} loading={busy} />

        <Text style={styles.section}>Importar em outro aparelho</Text>
        <TextInput
          style={styles.input}
          value={importCode}
          onChangeText={setImportCode}
          placeholder="Cole PECAJA2.… ou deixe vazio p/ usar a área de transferência"
          placeholderTextColor={theme.colors.textMuted}
          multiline
        />
        <Button title="Importar backup" variant="outline" onPress={() => void doImport()} loading={busy} />

        <Text style={styles.section}>Notificações push</Text>
        <Button title="Registrar token de push" onPress={() => void registerPush()} loading={busy} />
        {pushToken ? (
          <TouchableOpacity
            style={styles.tokenBox}
            onPress={() => void Clipboard.setStringAsync(pushToken)}
          >
            <Text style={styles.tokenLabel}>Token (toque para copiar)</Text>
            <Text style={styles.token} numberOfLines={2}>
              {pushToken}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.hint}>
          Sync na nuvem cobre loja, carteira, equipe, pedidos da loja, pontos e chats. Os dois
          aparelhos precisam alcançar a mesma API (LAN do Expo ou EXPO_PUBLIC_API_URL em produção).
        </Text>
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40, gap: 8 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.colors.primaryLight,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 16 },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  cardWarn: { fontSize: 11, color: '#B45309', marginTop: 6, fontWeight: '600' },
  section: {
    marginTop: 14,
    marginBottom: 6,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    textAlignVertical: 'top',
  },
  tokenBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tokenLabel: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 4 },
  token: { fontSize: 11, color: theme.colors.text, fontFamily: 'monospace' },
  hint: { marginTop: 16, fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});
