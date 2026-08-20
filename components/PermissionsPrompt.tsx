import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import {
  hasCompletedPermissionsOnboarding,
  markPermissionsOnboardingDone,
  requestEssentialPermissions,
} from '@/services/permissions';

const HIGHLIGHTS = [
  {
    icon: 'notifications-outline' as const,
    title: 'Notificações',
    text: 'Status do pedido: confirmado, em preparo e saiu para entrega.',
  },
  {
    icon: 'locate-outline' as const,
    title: 'Localização',
    text: 'Comércios próximos e estimativa de entrega (só com o app aberto).',
  },
  {
    icon: 'camera-outline' as const,
    title: 'Câmera e fotos',
    text: 'Pedidas só quando você alterar foto de perfil ou capa.',
  },
];

type Props = {
  /** Se true, força exibir (ex.: vindo do perfil). */
  force?: boolean;
};

export function PermissionsPrompt({ force = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (force) {
        if (alive) setVisible(true);
        return;
      }
      const done = await hasCompletedPermissionsOnboarding();
      if (!done && alive) setVisible(true);
    })();
    return () => {
      alive = false;
    };
  }, [force]);

  async function finish(request: boolean) {
    setLoading(true);
    try {
      if (request) {
        await requestEssentialPermissions();
      }
      await markPermissionsOnboardingDone();
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconHero}>
            <Ionicons name="shield-checkmark" size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Permissões do Peça Já</Text>
          <Text style={styles.sub}>
            Para avisos de pedido e comércios perto de você. Você pode mudar depois em
            Perfil → Permissões.
          </Text>

          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.title} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name={h.icon} size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{h.title}</Text>
                  <Text style={styles.rowText}>{h.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={() => finish(true)}
            disabled={loading}
            accessibilityLabel="Permitir notificações e localização"
          >
            <Text style={styles.primaryText}>
              {loading ? 'Abrindo…' : 'Permitir o essencial'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => finish(false)}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>Agora não</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              await markPermissionsOnboardingDone();
              setVisible(false);
              router.push('/permissions' as any);
            }}
          >
            <Text style={styles.link}>Ver todas as permissões</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  iconHero: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  sub: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  rowText: {
    marginTop: 2,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  secondaryBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  link: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    color: theme.colors.primaryDark,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
});
