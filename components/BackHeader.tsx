import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { theme } from '@/constants/theme';

type BackHeaderProps = {
  title?: string;
  fallbackHref?: string;
  /**
   * Nas abas, o histórico do stack pode mandar para fora do fluxo.
   * Com true, sempre volta para o fallback (ex.: Início).
   */
  preferFallback?: boolean;
  /** Params opcionais ao usar fallback (ex.: restaurar busca). */
  fallbackParams?: Record<string, string>;
};

export function BackHeader({
  title,
  fallbackHref = '/(tabs)',
  preferFallback = false,
  fallbackParams,
}: BackHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 0);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = title ? `${title} · Peça Já` : 'Peça Já';
  }, [title]);

  function handleBack() {
    if (!preferFallback && router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackParams && Object.keys(fallbackParams).length > 0) {
      router.replace({ pathname: fallbackHref as any, params: fallbackParams });
      return;
    }
    router.replace(fallbackHref as any);
  }

  return (
    <View style={[styles.wrapper, { paddingTop: topInset + 8 }]}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          <Text style={styles.backLabel}>Voltar</Text>
        </TouchableOpacity>

        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={styles.titlePlaceholder} />
        )}

        <View style={styles.rightSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    paddingBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 88,
  },
  backLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.sm,
  },
  titlePlaceholder: { flex: 1 },
  rightSpacer: { minWidth: 88 },
});
