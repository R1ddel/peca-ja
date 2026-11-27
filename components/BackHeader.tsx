import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { theme } from '@/constants/theme';
import { BrandHeroBackground } from '@/components/BrandHeroBackground';

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
  /** Cabeçalho verde institucional (referência visual do cliente). */
  variant?: 'default' | 'brand';
  right?: React.ReactNode;
  subtitle?: string;
};

export function BackHeader({
  title,
  fallbackHref = '/(tabs)',
  preferFallback = false,
  fallbackParams,
  variant = 'default',
  right,
  subtitle,
}: BackHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 0);
  const brand = variant === 'brand';
  const iconColor = brand ? theme.colors.white : theme.colors.text;
  const labelColor = brand ? theme.colors.white : theme.colors.primary;

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

  const body = (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={iconColor} />
        <Text style={[styles.backLabel, { color: labelColor }]}>Voltar</Text>
      </TouchableOpacity>

      {title ? (
        <View style={styles.titleBlock}>
          <Text style={[styles.title, brand && styles.titleBrand]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, brand && styles.subtitleBrand]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.titlePlaceholder} />
      )}

      <View style={styles.rightSpacer}>{right}</View>
    </View>
  );

  if (brand) {
    return (
      <BrandHeroBackground
        style={[styles.wrapper, styles.wrapperBrand, { paddingTop: topInset + 8 }]}
        rounded
      >
        {body}
      </BrandHeroBackground>
    );
  }

  return (
    <View style={[styles.wrapper, { paddingTop: topInset + 8 }]}>
      {body}
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
  wrapperBrand: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    ...theme.shadow.soft,
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
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    textAlign: 'center',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  titleBrand: {
    color: theme.colors.white,
  },
  subtitle: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  subtitleBrand: {
    color: 'rgba(255,255,255,0.85)',
  },
  titlePlaceholder: { flex: 1 },
  rightSpacer: {
    minWidth: 88,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
