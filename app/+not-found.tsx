import { StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { BackHeader } from '@/components/BackHeader';
import { theme } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.screen}>
      <BackHeader title="Página não encontrada" />
      <View style={styles.container}>
        <Text style={styles.title}>Essa tela não existe</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.link}>
          <Text style={styles.linkText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
