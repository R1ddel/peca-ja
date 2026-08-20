import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { useAuth } from '@/context/AuthContext';
import { resolveActiveMerchantContext } from '@/utils/merchantStores';
import {
  auditActionLabel,
  listMerchantAudit,
  MerchantAuditEntry,
} from '@/utils/merchantAudit';
import { STAFF_ROLE_LABEL, StaffRole } from '@/utils/merchantTeam';
import { formatOrderDateTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

export default function MerchantAuditScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('');
  const [entries, setEntries] = useState<MerchantAuditEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { shop } = await resolveActiveMerchantContext(user?.email);
      if (!shop) {
        setEntries([]);
        return;
      }
      setShopName(shop.name);
      setEntries(await listMerchantAudit(shop.businessId, 100));
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Auditoria" fallbackHref="/merchant/punches" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.shop}>{shopName || 'Loja'}</Text>
          <Text style={styles.sub}>Quem entrou, saiu, aprovou ou tentou abrir tela sem permissão.</Text>
          {entries.length === 0 ? (
            <Text style={styles.muted}>Nenhum evento ainda.</Text>
          ) : (
            entries.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.action}>{auditActionLabel(e.action)}</Text>
                <Text style={styles.detail}>{e.detail}</Text>
                <Text style={styles.meta}>
                  {e.actorName}
                  {e.actorRole && e.actorRole !== 'system'
                    ? ` · ${STAFF_ROLE_LABEL[e.actorRole as StaffRole] ?? e.actorRole}`
                    : ''}
                  {' · '}
                  {formatOrderDateTime(e.createdAt)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  shop: { fontSize: 20, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  action: { fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  detail: { marginTop: 4, color: theme.colors.textSecondary, lineHeight: 18 },
  meta: { marginTop: 6, fontSize: 11, color: theme.colors.textMuted },
  muted: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
});
