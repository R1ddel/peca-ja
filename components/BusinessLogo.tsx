import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import { BusinessCategory } from '@/constants/theme';
import { getBusinessLogoSource } from '@/utils/businessLogos';

type Props = {
  name: string;
  category: BusinessCategory;
  /** URI atual (upload do comércio ou stock). */
  image?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Cantos: círculo (perfil) ou arredondado (card). */
  rounded?: 'full' | 'lg' | 'md';
};

/**
 * Logo de perfil do comércio — temática por tipo, ou upload autêntico.
 */
export function BusinessLogo({
  name,
  category,
  image,
  size = 56,
  style,
  containerStyle,
  rounded = 'full',
}: Props) {
  const source = getBusinessLogoSource({ name, category, image });
  const radius =
    rounded === 'full' ? size / 2 : rounded === 'lg' ? Math.max(12, size * 0.18) : 8;

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: radius },
        containerStyle,
      ]}
    >
      <Image
        source={source}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        resizeMode="cover"
        accessibilityLabel={`Logo ${name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
});
