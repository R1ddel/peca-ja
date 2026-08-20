import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { theme, BusinessCategory } from '@/constants/theme';
import { getPromoBanners, PromoBannerItem } from '@/data/businesses';
import { useDemoLocation } from '@/hooks/useDemoLocation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Home já tem padding horizontal md dos dois lados. */
const BANNER_WIDTH = SCREEN_WIDTH - theme.spacing.md * 4;
const GAP = theme.spacing.sm;
const INTERVAL_MS = 3500;

type PromoBannerProps = {
  /** Se informado, aplica categoria na Home em vez de navegar. */
  onSelectCategory?: (category: BusinessCategory) => void;
};

export function PromoBanner({ onSelectCategory }: PromoBannerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const pausedRef = useRef(false);
  const { version } = useDemoLocation();
  const banners = useMemo(() => getPromoBanners(), [version]);

  useEffect(() => {
    indexRef.current = 0;
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [version]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      if (pausedRef.current) return;

      const next = (indexRef.current + 1) % banners.length;
      indexRef.current = next;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({
        x: next * (BANNER_WIDTH + GAP),
        animated: true,
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [banners.length, version]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (BANNER_WIDTH + GAP));
    const safe = Math.max(0, Math.min(index, banners.length - 1));
    indexRef.current = safe;
    setActiveIndex(safe);
  }

  function handlePress(banner: PromoBannerItem) {
    if (banner.category && onSelectCategory) {
      onSelectCategory(banner.category);
      return;
    }
    if (banner.searchQuery) {
      router.push({ pathname: '/(tabs)/search', params: { q: banner.searchQuery } } as any);
      return;
    }
    if (banner.category) {
      router.push({ pathname: '/(tabs)/search', params: { q: banner.category } } as any);
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH + GAP}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={styles.container}
        onScrollBeginDrag={() => {
          pausedRef.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          onScrollEnd(e);
          pausedRef.current = false;
        }}
        onScrollEndDrag={(e) => {
          onScrollEnd(e);
        }}
      >
        {banners.map((banner) => (
          <TouchableOpacity
            key={`${version}-${banner.id}`}
            style={styles.bannerWrapper}
            activeOpacity={0.92}
            onPress={() => handlePress(banner)}
            accessibilityRole="button"
            accessibilityLabel={`${banner.title}. ${banner.subtitle}`}
          >
            <Image source={{ uri: banner.image }} style={styles.image} />
            <LinearGradient colors={['transparent', banner.color + 'DD']} style={styles.gradient}>
              <Text style={styles.title}>{banner.title}</Text>
              <Text style={styles.subtitle}>{banner.subtitle}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {banners.map((banner, i) => (
          <View
            key={`${version}-${banner.id}-dot`}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
  },
  container: {
    gap: GAP,
  },
  bannerWrapper: {
    width: BANNER_WIDTH,
    height: 150,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.white,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.primary,
  },
});
