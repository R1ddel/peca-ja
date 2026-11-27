import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '@/constants/theme';
import { useIsMobileLayout } from '@/utils/mobileLayout';

/** Banner em alta resolução (2172×724). */
export const BRAND_HERO_BANNER = require('../assets/images/home-header-banner.jpg');

type BrandHeroBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  /** Bordas inferiores arredondadas (abas e headers de seção). */
  rounded?: boolean;
};

/**
 * Fundo verde institucional com a arte do motoboy.
 * Mesmo enquadramento da Home — desktop e mobile.
 */
export function BrandHeroBackground({
  children,
  style,
  imageStyle,
  rounded = true,
}: BrandHeroBackgroundProps) {
  const isMobile = useIsMobileLayout();

  return (
    <ImageBackground
      source={BRAND_HERO_BANNER}
      style={[styles.base, rounded && styles.rounded, style]}
      imageStyle={[
        isMobile ? styles.imageMobile : styles.imageDesktop,
        rounded && styles.rounded,
        imageStyle,
      ]}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
  },
  rounded: {
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  imageDesktop: {
    width: '118%',
    height: '165%',
    top: -108,
    left: -28,
  },
  imageMobile: {
    width: '168%',
    height: '152%',
    top: -58,
    left: '-48%',
  },
});
