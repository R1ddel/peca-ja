import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

type PecaJaLogoProps = {
  size?: 'sm' | 'md';
  showName?: boolean;
};

/** Logo Peça Já com animação nativa (sem Reanimated). */
export function PecaJaLogo({ size = 'md', showName = true }: PecaJaLogoProps) {
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  const iconSize = size === 'sm' ? 20 : 26;
  const circle = size === 'sm' ? 40 : 52;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -5,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.7,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [floatY, pulse, glow]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: circle + 16,
            height: circle + 16,
            borderRadius: (circle + 16) / 2,
            opacity: glow,
            transform: [{ translateY: floatY }, { scale: pulse }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            transform: [{ translateY: floatY }, { scale: pulse }],
          },
        ]}
      >
        <Ionicons name="bag-handle" size={iconSize} color={theme.colors.primary} />
      </Animated.View>

      {showName && (
        <View style={styles.textCol}>
          <Text style={[styles.brand, size === 'sm' && styles.brandSm]}>Peça Já</Text>
          <Text style={styles.tag}>delivery</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  glow: {
    position: 'absolute',
    left: -8,
    backgroundColor: theme.colors.primaryMuted,
  },
  circle: {
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1,
  },
  textCol: {
    justifyContent: 'center',
  },
  brand: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.primaryDark,
    letterSpacing: -0.5,
  },
  brandSm: {
    fontSize: theme.fontSize.lg,
  },
  tag: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: -2,
  },
});
