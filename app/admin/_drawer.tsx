/**
 * Drawer lateral direito — detalhes sem sair da lista.
 */
import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { hq, hqStyles } from '@/app/admin/_ui';

export function AdminDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.panel, { width: Platform.OS === 'web' ? width : '92%' as any }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={hqStyles.h2}>{title}</Text>
              {subtitle ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  panel: {
    height: '100%',
    backgroundColor: hq.panel,
    borderLeftWidth: 1,
    borderLeftColor: hq.line,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '-12px 0 40px rgba(16,36,28,0.18)' } as any)
      : null),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: hq.line,
  },
  sub: { color: hq.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  closeBtn: {
    borderWidth: 1,
    borderColor: hq.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: { color: hq.muted, fontWeight: '700', fontSize: 12 },
});
