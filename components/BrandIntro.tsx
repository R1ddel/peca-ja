import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

type BrandIntroProps = {
  onFinish: () => void;
};

/**
 * Abertura clássica: logo + marca + tagline.
 * Só Animated nativo.
 */
export function BrandIntro({ onFinish }: BrandIntroProps) {
  const insets = useSafeAreaInsets();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(10)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(lineWidth, {
        toValue: 56,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(1200),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    intro.start(({ finished }) => {
      if (finished) onFinish();
    });

    return () => intro.stop();
  }, [
    logoOpacity,
    logoScale,
    titleOpacity,
    titleTranslate,
    lineWidth,
    screenOpacity,
    onFinish,
  ]);

  return (
    <Animated.View
      style={[
        styles.screen,
        { opacity: screenOpacity, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <View style={styles.logoCircle}>
          <Ionicons name="bag-handle" size={42} color={theme.colors.primary} />
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslate }],
          alignItems: 'center',
        }}
      >
        <Text style={styles.brand}>Peça Já</Text>
        <Animated.View style={[styles.line, { width: lineWidth }]} />
        <Text style={styles.tagline}>delivery do jeito certo</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: 18,
    alignItems: 'center',
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  brand: {
    fontSize: 40,
    fontWeight: theme.fontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  line: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    marginTop: 10,
    marginBottom: 10,
    alignSelf: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 1.1,
    textTransform: 'lowercase',
    textAlign: 'center',
  },
});
