import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  registerAlertHost,
  type AlertButton,
  type AlertState,
} from '@/utils/alert/showAlert';

/**
 * Modal de alerta no web (Alert.alert do RN Web é no-op).
 * Montado dentro do AuthProvider para não alterar app/_layout.tsx.
 */
export function AlertHost() {
  const [current, setCurrent] = useState<AlertState | null>(null);
  const currentRef = useRef<AlertState | null>(null);
  const queueRef = useRef<AlertState[]>([]);

  useEffect(() => {
    registerAlertHost((next) => {
      if (!currentRef.current) {
        currentRef.current = next;
        setCurrent(next);
        return;
      }
      queueRef.current = [...queueRef.current, next];
    });
  }, []);

  const dismiss = useCallback((btn?: AlertButton) => {
    const run = btn?.onPress;
    const head = queueRef.current[0];
    queueRef.current = queueRef.current.slice(1);
    currentRef.current = head || null;
    setCurrent(head || null);
    if (run) void run();
  }, []);

  if (!current) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        const cancel = current.buttons.find((b) => b.style === 'cancel');
        dismiss(cancel || current.buttons[current.buttons.length - 1]);
      }}
    >
      <View style={styles.backdrop} accessibilityRole="alert">
        <View style={styles.card}>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={styles.actions}>
            {current.buttons.map((btn, i) => (
              <Pressable
                key={`${btn.text}-${i}`}
                onPress={() => dismiss(btn)}
                style={[
                  styles.btn,
                  btn.style === 'destructive' && styles.btnDanger,
                  btn.style === 'cancel' && styles.btnGhost,
                ]}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'destructive' && styles.btnTextDanger,
                    btn.style === 'cancel' && styles.btnTextGhost,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 30, 22, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a2e24',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    color: '#4a5c54',
    marginBottom: 18,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  btn: {
    backgroundColor: '#00a86b',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnDanger: { backgroundColor: '#dc2626' },
  btnGhost: { backgroundColor: '#e8f8f0' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnTextDanger: { color: '#fff' },
  btnTextGhost: { color: '#1a2e24' },
});
