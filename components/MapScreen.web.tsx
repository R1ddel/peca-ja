import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BackHeader } from '@/components/BackHeader';
import { InAppGoogleMap } from '@/components/InAppGoogleMap';
import { theme } from '@/constants/theme';
import { getUserPlaceDetails, type UserPlaceDetails } from '@/services/permissions';

/** Mapa completo na web — Google Maps embutido com o pin correto. */
export default function MapScreenWeb() {
  const [place, setPlace] = useState<UserPlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const details = await getUserPlaceDetails();
      setPlace(details);
      if (!details) setError('Ative a localização para ver o mapa.');
    } catch {
      setError('Não foi possível ler a localização.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <View style={styles.screen}>
      <BackHeader title="Mapa" />
      <View style={styles.body}>
        <InAppGoogleMap
          center={
            place
              ? { latitude: place.latitude, longitude: place.longitude }
              : { latitude: -13.0054, longitude: -41.3706 }
          }
          label="Você"
          cityLabel={place?.city || 'Sua região'}
          height={420}
          loading={loading && !place}
          error={!place ? error : null}
          onRefresh={() => void reload()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  body: { flex: 1, padding: theme.spacing.md },
});
