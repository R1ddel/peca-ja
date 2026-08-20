import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { BrandIntro } from '@/components/BrandIntro';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';

export default function IndexScreen() {
  const { user, isLoading } = useAuth();
  const [introDone, setIntroDone] = useState(false);

  const finishIntro = useCallback(() => {
    setIntroDone(true);
  }, []);

  React.useEffect(() => {
    if (!introDone || isLoading) return;
    router.replace('/(tabs)');
  }, [introDone, isLoading, user]);

  return (
    <View style={styles.container}>
      {!introDone ? (
        <BrandIntro onFinish={finishIntro} />
      ) : (
        <ActivityIndicator size="large" color={theme.colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
