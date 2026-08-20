import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { CategoryChip } from '@/components/CategoryChip';
import { getBusinessLogoSource } from '@/utils/businessLogos';
import { theme, BusinessCategory, categoryConfig } from '@/constants/theme';
import { getUserPlaceDetails, type UserPlaceDetails } from '@/services/permissions';
import { openMapsAt, openMapsRoute } from '@/utils/openMaps';
import { getAllBusinesses, formatPrice } from '@/data/businesses';
import { parseDistanceKm } from '@/components/HomeFilters';
import { merchantCoordsNearCustomer } from '@/services/payment';
import { subscribeDemoLocation } from '@/utils/demoLocation';
import type { Business } from '@/types';

type FilterCategory = BusinessCategory | 'todos';

type MapPin = {
  business: Business;
  latitude: number;
  longitude: number;
};

const categories: FilterCategory[] = [
  'todos',
  'restaurante',
  'mercado',
  'farmacia',
  'distribuidora',
  'padaria',
  'bebidas',
  'conveniencia',
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [place, setPlace] = useState<UserPlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
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

  const filtered = useMemo(() => {
    return getAllBusinesses().filter((b) => {
      if (!b.isOpen) return false;
      if (selectedCategory === 'todos') return true;
      return b.category === selectedCategory;
    });
  }, [selectedCategory, place?.city]);

  const pins: MapPin[] = useMemo(() => {
    if (!place) return [];
    return filtered.map((b) => {
      const km = parseDistanceKm(b.distance) || 1;
      const coords = merchantCoordsNearCustomer(place.latitude, place.longitude, km);
      const angle = (Number(b.id) % 12) * (Math.PI / 6);
      const jitter = 0.0015;
      return {
        business: b,
        latitude: coords.latitude + Math.sin(angle) * jitter,
        longitude: coords.longitude + Math.cos(angle) * jitter,
      };
    });
  }, [place, filtered]);

  useEffect(() => {
    if (pins.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !pins.some((p) => p.business.id === selectedId)) {
      setSelectedId(pins[0].business.id);
    }
  }, [pins, selectedId]);

  const selectedPin = pins.find((p) => p.business.id === selectedId) ?? null;
  const selected = selectedPin?.business ?? null;

  const region: Region | undefined = place
    ? {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : undefined;

  function focusPin(pin: MapPin) {
    setSelectedId(pin.business.id);
    mapRef.current?.animateToRegion(
      {
        latitude: pin.latitude,
        longitude: pin.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350
    );
  }

  async function handleOpenMapsHere() {
    if (!place) {
      await load();
      return;
    }
    await openMapsAt(place.latitude, place.longitude, place.city);
  }

  async function handleOpenRoute() {
    if (!place || !selectedPin) return;
    await openMapsRoute(
      { latitude: place.latitude, longitude: place.longitude },
      { latitude: selectedPin.latitude, longitude: selectedPin.longitude },
      selectedPin.business.name
    );
  }

  return (
    <View style={styles.screen}>
      <BackHeader title="Mapa" />

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              category={cat}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapArea}>
        {region ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
          >
            <Marker
              coordinate={{ latitude: place!.latitude, longitude: place!.longitude }}
              title={place!.city}
              description="Você está aqui"
              pinColor={theme.colors.primary}
            />
            {pins.map((pin) => (
              <Marker
                key={pin.business.id}
                coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
                title={pin.business.name}
                description={pin.business.distance}
                pinColor={selectedId === pin.business.id ? theme.colors.primaryDark : '#D97706'}
                onPress={() => focusPin(pin)}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} size="large" />
            ) : (
              <>
                <Ionicons name="location-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.placeholderTitle}>{error ?? 'Localização indisponível'}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={styles.mapActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={load} activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleOpenMapsHere} activeOpacity={0.85}>
            <Ionicons name="navigate" size={20} color={theme.colors.primaryDark} />
          </TouchableOpacity>
          {selectedPin ? (
            <TouchableOpacity
              style={[styles.iconBtn, styles.iconBtnPrimary]}
              onPress={handleOpenRoute}
              activeOpacity={0.85}
            >
              <Ionicons name="car" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {place ? (
        <View style={styles.cityBar}>
          <Ionicons name="location" size={16} color={theme.colors.primary} />
          <Text style={styles.cityText} numberOfLines={1}>
            {place.city} · {pins.length} comércio{pins.length === 1 ? '' : 's'} no mapa
          </Text>
        </View>
      ) : null}

      {selected && selectedPin ? (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedRow}
            activeOpacity={0.9}
            onPress={() => focusPin(selectedPin)}
          >
            <Image
              source={getBusinessLogoSource({
                name: selected.name,
                category: selected.category,
                image: selected.image,
              })}
              style={styles.selectedImage}
            />
            <View style={styles.selectedBody}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={styles.selectedMeta} numberOfLines={1}>
                {categoryConfig[selected.category].label} · {selected.distance} · {selected.deliveryTime}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingText}>{selected.rating.toFixed(1)}</Text>
                <Text style={styles.feeText}>
                  {selected.deliveryFee === 0 ? 'Entrega grátis' : formatPrice(selected.deliveryFee)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.88}
            onPress={() => router.push(`/business/${selected.id}`)}
          >
            <Ionicons name="restaurant" size={18} color={theme.colors.white} />
            <Text style={styles.menuBtnText}>Ver cardápio</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chipsWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.background,
  },
  chipsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F2EC',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  placeholderTitle: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  retryText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  mapActions: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  iconBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  cityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
  },
  cityText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  selectedCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  selectedRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  selectedImage: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  selectedBody: {
    flex: 1,
    gap: 4,
  },
  selectedName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  selectedMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
  },
  feeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.medium,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  menuBtnText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
});
