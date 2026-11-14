import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useOrders } from '@/context/OrdersContext';
import { DriverRouteMap } from '@/components/DriverRouteMap';

function paramStr(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

/** Navegação na web: o mesmo mapa da corrida, em tela cheia. */
export default function DriverNavScreen() {
  const id = paramStr(useLocalSearchParams<{ id?: string }>().id);
  const { getOrder } = useOrders();
  const order = getOrder(id);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.back} onPress={() => router.replace('/driver' as any)}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backText}>Sair do mapa</Text>
        </TouchableOpacity>
      </View>
      {order ? (
        <DriverRouteMap order={order} trackDriver featured fullscreen />
      ) : (
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Corrida não encontrada</Text>
          <Text style={styles.missingSub}>Volte e aceite o pedido de novo.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  bar: {
    backgroundColor: '#0F172A',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  missingSub: { color: 'rgba(255,255,255,0.7)', marginTop: 8, textAlign: 'center' },
});
