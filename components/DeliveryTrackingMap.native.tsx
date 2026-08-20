import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { getUserPlaceDetails, type UserPlaceDetails } from '@/services/permissions';
import { openMapsAt } from '@/utils/openMaps';
import { getAllBusinesses } from '@/data/businesses';
import { parseDistanceKm } from '@/components/HomeFilters';
import { merchantCoordsNearCustomer } from '@/services/payment';
import { subscribeDemoLocation } from '@/utils/demoLocation';

type Props = {
  fallbackName?: string;
};

/**
 * Mini-mapa estilo iFood na Home.
 * - Mostra GPS + comércios perto
 * - Toque abre a tela cheia /map
 * - Botão abre Google Maps / Apple Maps
 */
export function DeliveryTrackingMap({ fallbackName = 'Você' }: Props) {
  const mapRef = useRef<MapView>(null);
  const [place, setPlace] = useState<UserPlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const details = await getUserPlaceDetails();
      if (!details) {
        setError('Ative a localização para usar o mapa.');
        setPlace(null);
        return;
      }
      setPlace(details);
      mapRef.current?.animateToRegion(
        {
          latitude: details.latitude,
          longitude: details.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        450
      );
    } catch {
      setError('Não foi possível ler o GPS.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return subscribeDemoLocation(() => {
      void load();
    });
  }, [load]);

  const nearbyMarkers = useMemo(() => {
    if (!place) return [];
    return getAllBusinesses()
      .filter((b) => b.isOpen)
      .slice(0, 8)
      .map((b) => {
        const km = parseDistanceKm(b.distance) || 1;
        const coords = merchantCoordsNearCustomer(place.latitude, place.longitude, km);
        // Pequeno espalhamento angular por id para não empilhar pins
        const angle = (Number(b.id) % 8) * (Math.PI / 4);
        const jitter = 0.002;
        return {
          id: b.id,
          name: b.name,
          latitude: coords.latitude + Math.sin(angle) * jitter,
          longitude: coords.longitude + Math.cos(angle) * jitter,
        };
      });
  }, [place]);

  const region: Region | undefined = place
    ? {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : undefined;

  async function openExternalMaps() {
    if (!place) {
      await load();
      return;
    }
    await openMapsAt(place.latitude, place.longitude, place.city);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="map" size={16} color={theme.colors.primary} />
          <Text style={styles.title}>Mapa perto de você</Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cityRow}>
        <Ionicons name="location" size={16} color={theme.colors.primary} />
        <Text style={styles.cityText} numberOfLines={1}>
          {place?.city ?? error ?? 'Detectando cidade…'}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => router.push('/map' as any)}
        style={styles.mapWrap}
      >
        {region ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={undefined}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            pointerEvents="none"
          >
            <Marker
              coordinate={{ latitude: place!.latitude, longitude: place!.longitude }}
              title={place!.city}
              description="Você está aqui"
              pinColor={theme.colors.primary}
            />
            {nearbyMarkers.map((m) => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                title={m.name}
                pinColor="#D97706"
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="map-outline" size={36} color={theme.colors.textMuted} />
                <Text style={styles.placeholderText}>
                  {error ?? 'Toque em atualizar para marcar sua cidade'}
                </Text>
              </>
            )}
          </View>
        )}

        <View style={styles.mapOverlay}>
          <Text style={styles.overlayText}>Toque para abrir o mapa completo</Text>
          <Ionicons name="expand" size={16} color={theme.colors.white} />
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/map' as any)} activeOpacity={0.85}>
          <Ionicons name="navigate" size={16} color={theme.colors.primary} />
          <Text style={styles.actionText}>Abrir mapa Peça Já</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={openExternalMaps} activeOpacity={0.85}>
          <Ionicons name="logo-google" size={16} color={theme.colors.white} />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Google Maps</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {place
          ? `${fallbackName} em ${place.city} · ${nearbyMarkers.length} comércios no mapa`
          : 'Ative o GPS para ver comércios ao seu redor'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  cityText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  mapWrap: {
    height: 180,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F2EC',
    gap: 8,
    padding: theme.spacing.md,
  },
  placeholderText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  mapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,58,47,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
    backgroundColor: theme.colors.primaryLight,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  actionTextPrimary: { color: theme.colors.white },
  hint: {
    marginTop: 8,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
