/**
 * Google Maps ativo dentro do app (web via iframe embed).
 * Coordenadas vão no URL — o pin marca o lugar certo.
 */
import React, { createElement, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import {
  googleMapsEmbedDirectionsUrl,
  googleMapsEmbedUrl,
  type MapPoint,
} from '@/utils/googleMapsEmbed';
import { openGoogleToPlace, openWazeToPlace } from '@/utils/openMaps';

type Props = {
  center: MapPoint;
  label?: string;
  cityLabel?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  /** Se informado, mostra rota center → destination */
  destination?: MapPoint | null;
  destinationLabel?: string;
  onRefresh?: () => void;
  preferWazeNav?: boolean;
};

export function InAppGoogleMap({
  center,
  label = 'Você',
  cityLabel,
  height = 220,
  loading = false,
  error = null,
  destination = null,
  destinationLabel = 'Destino',
  onRefresh,
  preferWazeNav = false,
}: Props) {
  const src = useMemo(() => {
    if (destination) {
      return googleMapsEmbedDirectionsUrl(center, destination, {
        label: destinationLabel,
      });
    }
    return googleMapsEmbedUrl(center, { zoom: 16, label });
  }, [center, destination, destinationLabel, label]);

  const navTarget = destination || center;
  const navLabel = destination ? destinationLabel : label;

  async function openNav() {
    const place = {
      latitude: navTarget.latitude,
      longitude: navTarget.longitude,
      label: navLabel,
      address: cityLabel || navLabel,
    };
    if (preferWazeNav) {
      try {
        await openWazeToPlace(place);
        return;
      } catch {
        /* cai no Google */
      }
    }
    await openGoogleToPlace(place);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="map" size={16} color={theme.colors.primary} />
          <Text style={styles.title}>{cityLabel || label}</Text>
        </View>
        {onRefresh ? (
          <TouchableOpacity onPress={onRefresh} hitSlop={10} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.mapBox, { height }]}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.muted}>Carregando mapa…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="warning-outline" size={28} color={theme.colors.textMuted} />
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : (
          createElement('iframe', {
            title: 'Google Maps · Peça Já',
            src,
            allow: 'geolocation; fullscreen',
            referrerPolicy: 'no-referrer-when-downgrade',
            style: {
              border: 0,
              width: '100%',
              height: '100%',
              display: 'block',
            },
          })
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnGoogle} onPress={() => void openNav()} activeOpacity={0.9}>
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.btnGoogleText}>
            {destination ? 'Abrir rota no Google Maps' : 'Abrir no Google Maps'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnWaze}
          onPress={() =>
            void openWazeToPlace({
              latitude: navTarget.latitude,
              longitude: navTarget.longitude,
              label: navLabel,
              address: cityLabel || navLabel,
            })
          }
          activeOpacity={0.9}
        >
          <Ionicons name="navigate-circle" size={18} color="#0B1C2D" />
          <Text style={styles.btnWazeText}>Tentar no Waze</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  title: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  mapBox: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E8EEF5',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  actions: { gap: 8 },
  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  btnGoogleText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnWaze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#33CCFF',
    borderRadius: 12,
    paddingVertical: 11,
  },
  btnWazeText: { color: '#0B1C2D', fontWeight: '800', fontSize: 14 },
});
