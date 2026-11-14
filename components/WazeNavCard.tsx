/**
 * Painel de navegação Waze.
 * O Waze não libera o motor do mapa para embutir no app —
 * este card abre o Waze de verdade (app ou web) no ponto/destino.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { openWazeLiveMap, openWazeToPlace } from '@/utils/openMaps';

type Props = {
  title?: string;
  subtitle?: string;
  cityLabel?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  loading?: boolean;
  error?: string | null;
  /** navigate = guia até o ponto; live = abre o mapa do Waze na região */
  mode?: 'navigate' | 'live';
  height?: number;
  onRefresh?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const WAZE_CYAN = '#33CCFF';
const WAZE_DARK = '#0B1C2D';

export function WazeNavCard({
  title = 'Navegação Waze',
  subtitle,
  cityLabel,
  address,
  latitude,
  longitude,
  loading = false,
  error = null,
  mode = 'live',
  height = 220,
  onRefresh,
  secondaryLabel,
  onSecondary,
}: Props) {
  const hasPoint =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  async function openWaze() {
    if (!hasPoint) {
      onRefresh?.();
      return;
    }
    if (mode === 'navigate') {
      await openWazeToPlace({
        latitude,
        longitude,
        address: address || cityLabel,
        label: title,
      });
      return;
    }
    await openWazeLiveMap(latitude, longitude, cityLabel || title);
  }

  return (
    <View style={[styles.card, { minHeight: height }]}>
      <LinearGradient colors={['#0B1C2D', '#123047']} style={styles.hero}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Ionicons name="navigate" size={14} color={WAZE_DARK} />
            <Text style={styles.badgeText}>WAZE</Text>
          </View>
          {onRefresh ? (
            <TouchableOpacity onPress={onRefresh} hitSlop={10} activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.city} numberOfLines={2}>
          {loading
            ? 'Detectando localização…'
            : cityLabel || address || error || 'Sua região'}
        </Text>
        {!!subtitle && !loading && <Text style={styles.sub}>{subtitle}</Text>}

        <View style={styles.pinWrap}>
          <View style={styles.pinPulse} />
          <View style={styles.pin}>
            <Ionicons name="navigate" size={22} color={WAZE_DARK} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, !hasPoint && !loading && styles.primaryDisabled]}
          activeOpacity={0.9}
          disabled={loading}
          onPress={() => void openWaze()}
        >
          {loading ? (
            <ActivityIndicator color={WAZE_DARK} />
          ) : (
            <>
              <Ionicons name="navigate-circle" size={22} color={WAZE_DARK} />
              <Text style={styles.primaryText}>
                {mode === 'navigate' ? 'Abrir rota no Waze' : 'Abrir mapa no Waze'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {secondaryLabel && onSecondary ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSecondary} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}

        {!!error && !hasPoint && !loading ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={styles.hint}>
            O mapa e o GPS ao vivo ficam no Waze — o app abre a navegação no ponto certo.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    minHeight: 150,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: WAZE_CYAN,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    color: WAZE_DARK,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  city: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  pinWrap: {
    marginTop: 18,
    alignSelf: 'center',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(51,204,255,0.25)',
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WAZE_CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  actions: {
    padding: 14,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: WAZE_CYAN,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: {
    color: WAZE_DARK,
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  hint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    textAlign: 'center',
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
});
