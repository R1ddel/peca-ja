// app/test-gps.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { theme } from '@/constants/theme';
import {
  calculateFreeRouteDistance,
  resolveDeliveryPriceFromDistance,
  merchantCoordsNearCustomer,
  gpsFreightAdjustMessage,
} from '../services/payment';

export default function GpsTestScreen() {
  const [loading, setLoading] = useState(false);
  const [locationText, setLocationText] = useState('Clique para buscar sua localização');
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/(tabs)' as any);
    }
  }, []);

  if (!__DEV__) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const handleGetLocationAndCalculateFee = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'O app precisa do GPS para calcular a entrega.');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords;

      // Simula comércio ~10 km (fora da cidade, até 13 km = R$ 15)
      const merchant = merchantCoordsNearCustomer(latitude, longitude, 10);

      const distanceInMeters = await calculateFreeRouteDistance(
        merchant.latitude,
        merchant.longitude,
        latitude,
        longitude
      );

      const result = resolveDeliveryPriceFromDistance(distanceInMeters);

      setLocationText(
        distanceInMeters == null
          ? `GPS ok · OSRM offline (frete urbano R$ 5,00)`
          : `Sua posição · ${(distanceInMeters / 1000).toFixed(2)} km · ${
              result.usedGpsPricing ? 'fora da cidade' : 'dentro da cidade'
            }`
      );

      setDeliveryFee(result.fee);
      if (result.usedGpsPricing) {
        Alert.alert('Frete ajustado pelo GPS', gpsFreightAdjustMessage(result));
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível ler o GPS ou calcular a rota.');
      setDeliveryFee(5);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <BackHeader title="Teste GPS" fallbackHref="/(tabs)/profile" />
      <View style={styles.container}>
        <Text style={styles.title}>Calculador de Frete Grátis</Text>
        <Text style={styles.infoText}>{locationText}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleGetLocationAndCalculateFee}>
            <Text style={styles.buttonText}>Calcular frete com GPS</Text>
          </TouchableOpacity>
        )}

        {deliveryFee != null && (
          <Text style={styles.fee}>Taxa estimada: R$ {deliveryFee.toFixed(2)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  fee: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
});
