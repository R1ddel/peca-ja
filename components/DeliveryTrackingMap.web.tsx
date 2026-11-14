import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { getUserPlaceDetails, type UserPlaceDetails } from '@/services/permissions';
import { subscribeDemoLocation } from '@/utils/demoLocation';
import { InAppGoogleMap } from '@/components/InAppGoogleMap';

type Props = { fallbackName?: string };

/** Home web: Google Maps ativo dentro do app (pin certo). Waze só como atalho. */
export function DeliveryTrackingMap({ fallbackName = 'Você' }: Props) {
  const [place, setPlace] = useState<UserPlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const details = await getUserPlaceDetails();
      if (!details) {
        setPlace(null);
        setError('Ative a localização para ver o mapa.');
        return;
      }
      setPlace(details);
    } catch {
      setPlace(null);
      setError('Não foi possível ler a localização.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeDemoLocation(() => {
      void load();
    });
  }, [load]);

  return (
    <View style={styles.wrap}>
      {place || loading || error ? (
        <InAppGoogleMap
          center={
            place
              ? { latitude: place.latitude, longitude: place.longitude }
              : { latitude: -13.0054, longitude: -41.3706 }
          }
          label={fallbackName}
          cityLabel={place?.city || 'Mapa perto de você'}
          height={210}
          loading={loading && !place}
          error={!place ? error : null}
          onRefresh={() => void load()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
});
