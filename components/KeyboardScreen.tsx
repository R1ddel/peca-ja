import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardBottomInset } from '@/hooks/useKeyboardBottomInset';

type KeyboardScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /** Espaço extra além do header (ex.: banner). */
  offset?: number;
  /** Composer / rodapé fora do scroll (chat). */
  footer?: React.ReactNode;
};

/**
 * Formulários: teclado não cobre o campo focado.
 * iOS: KeyboardAvoidingView.
 * Android: resize (app.json) + padding extra do teclado quando a barra fica coberta.
 */
export function KeyboardScreen({
  children,
  style,
  contentContainerStyle,
  offset = 0,
  footer,
}: KeyboardScreenProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardBottomInset();
  // No Android o resize às vezes não sobe o conteúdo o suficiente; inset ajuda sem duplicar no iOS (KAV já cuida).
  const extraBottom = Platform.OS === 'android' && kb > 0 ? Math.max(24, kb * 0.15) : 24;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 + offset : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: extraBottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

/** Wrapper para listas + composer no rodapé (chats, códigos). */
export function KeyboardAvoid({
  children,
  style,
  offset = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
}) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardBottomInset();
  // Composer fixo: no Android empurra pelo inset real do teclado (resize sozinho costuma falhar aqui).
  const androidPad = Platform.OS === 'android' ? Math.max(0, kb - insets.bottom) : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 + offset : 0}
    >
      <View style={[styles.flex, androidPad > 0 && { marginBottom: androidPad }]}>{children}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
