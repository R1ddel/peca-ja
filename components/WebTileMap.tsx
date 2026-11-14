/**
 * Mapa web estável (tiles + pin), visual simples tipo Waze.
 * Não usa iframe nem Leaflet — não cai no ERR_BLOCKED_BY_CSP.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  LayoutChangeEvent,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import {
  MapLatLng,
  distanceMeters,
  formatDistance,
  formatEta,
  latLngToPixel,
  tilesForView,
} from '@/utils/webMapTiles';

export type WebMapMarker = MapLatLng & {
  id: string;
  color?: string;
  label?: string;
  kind?: 'you' | 'shop' | 'driver' | 'dest';
};

function TileImage({
  tile,
}: {
  tile: {
    url: string;
    fallbackUrl: string;
    left: number;
    top: number;
    size: number;
  };
}) {
  const [uri, setUri] = useState(tile.url);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        style={{
          position: 'absolute',
          left: tile.left,
          top: tile.top,
          width: tile.size,
          height: tile.size,
          backgroundColor: '#E5E7EB',
        }}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{
        position: 'absolute',
        left: tile.left,
        top: tile.top,
        width: tile.size,
        height: tile.size,
      }}
      resizeMode="cover"
      onError={() => {
        if (uri !== tile.fallbackUrl) setUri(tile.fallbackUrl);
        else setFailed(true);
      }}
    />
  );
}

type Props = {
  center: MapLatLng;
  zoom?: number;
  height?: number;
  markers?: WebMapMarker[];
  route?: MapLatLng[];
  cityLabel?: string;
  subtitle?: string;
  showHud?: boolean;
  onPress?: () => void;
  onRecenter?: () => void;
};

export function WebTileMap({
  center,
  zoom = 15,
  height = 200,
  markers = [],
  route = [],
  cityLabel,
  subtitle,
  showHud = true,
  onPress,
  onRecenter,
}: Props) {
  const [size, setSize] = useState({ width: 360, height });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) setSize({ width, height: h });
  }

  const tiles = useMemo(
    () => tilesForView(center, zoom, size.width, size.height),
    [center, zoom, size.width, size.height]
  );

  const routePixels = useMemo(
    () =>
      route.map((p) =>
        latLngToPixel(p, center, zoom, size.width, size.height)
      ),
    [route, center, zoom, size.width, size.height]
  );

  const markerPixels = useMemo(
    () =>
      markers.map((m) => ({
        ...m,
        pixel: latLngToPixel(m, center, zoom, size.width, size.height),
      })),
    [markers, center, zoom, size.width, size.height]
  );

  const you = markers.find((m) => m.kind === 'you') || markers[0];
  const dest =
    markers.find((m) => m.kind === 'dest' || m.kind === 'shop') ||
    markers.find((m) => m.id !== you?.id);
  const meters =
    you && dest
      ? distanceMeters(you, dest)
      : route.length >= 2
        ? distanceMeters(route[0], route[route.length - 1])
        : 0;

  const content = (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      <View style={styles.stage}>
        {tiles.map((t) => (
          <TileImage key={t.key} tile={t} />
        ))}

        {/* Rota estilo Waze (pontos densos — sem depender de transform-origin) */}
        {routePixels.map((p, i) => (
          <View
            key={`route-${i}`}
            style={{
              position: 'absolute',
              left: p.x - 4,
              top: p.y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#00C853',
              borderWidth: 1.5,
              borderColor: '#fff',
            }}
            pointerEvents="none"
          />
        ))}

        {markerPixels.map((m) => {
          const isYou = m.kind === 'you';
          const isDriver = m.kind === 'driver';
          const color =
            m.color ||
            (isYou
              ? '#00A86B'
              : isDriver
                ? '#111827'
                : m.kind === 'shop'
                  ? '#F59E0B'
                  : '#0EA5E9');
          return (
            <View
              key={m.id}
              style={[
                styles.marker,
                {
                  left: m.pixel.x - (isYou ? 18 : 10),
                  top: m.pixel.y - (isYou ? 18 : 10),
                },
              ]}
              pointerEvents="none"
            >
              {isYou ? (
                <View style={styles.youPulse}>
                  <View style={[styles.youCore, { backgroundColor: color }]}>
                    <Ionicons name="navigate" size={14} color="#fff" />
                  </View>
                </View>
              ) : isDriver ? (
                <View style={[styles.driverPin, { backgroundColor: color }]}>
                  <Text style={styles.driverText}>M</Text>
                </View>
              ) : (
                <View style={[styles.dot, { backgroundColor: color }]} />
              )}
              {!!m.label && (
                <View style={styles.tip}>
                  <Text style={styles.tipText} numberOfLines={1}>
                    {m.label}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {showHud && (
        <>
          <View style={styles.topHud} pointerEvents="box-none">
            <View style={styles.pill}>
              <Ionicons name="navigate-circle" size={16} color="#00A86B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pillTitle} numberOfLines={1}>
                  {cityLabel || 'Sua região'}
                </Text>
                <Text style={styles.pillSub} numberOfLines={1}>
                  {subtitle ||
                    (meters > 0
                      ? `${formatDistance(meters)} · ${formatEta(meters)}`
                      : 'Mapa ao vivo')}
                </Text>
              </View>
            </View>
            {onRecenter ? (
              <TouchableOpacity
                style={styles.recenter}
                onPress={onRecenter}
                activeOpacity={0.85}
              >
                <Ionicons name="locate" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>

          {meters > 0 && (
            <View style={styles.etaCard} pointerEvents="none">
              <Text style={styles.etaTime}>{formatEta(meters)}</Text>
              <Text style={styles.etaDist}>{formatDistance(meters)}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.96} onPress={onPress} style={{ borderRadius: 16 }}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#DCE8DF',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
  },
  topHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  pillTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  pillSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  recenter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  etaCard: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 84,
  },
  etaTime: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  etaDist: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  youPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,168,107,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  tip: {
    marginTop: 4,
    backgroundColor: 'rgba(17,24,39,0.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 110,
  },
  tipText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
