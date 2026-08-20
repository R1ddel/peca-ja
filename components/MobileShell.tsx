import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * Limita a largura no web para manter sensação de app mobile.
 * No celular nativo, apenas passa o flex adiante.
 */
export function MobileShell({ style, ...props }: ViewProps) {
  return <View style={[styles.shell, style]} {...props} />;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? { maxWidth: theme.layout.maxContentWidth }
      : null),
  },
});
