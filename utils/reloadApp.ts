import { Alert, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';

/**
 * Recarrega o bundle JS (útil no Expo Go após mudanças no servidor).
 */
export async function reloadApp(reason = 'manual'): Promise<void> {
  try {
    await reloadAppAsync(reason);
  } catch {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    Alert.alert('Recarregar', 'Não foi possível recarregar o app agora. Feche e abra de novo.');
  }
}

export function confirmReloadApp() {
  Alert.alert('Recarregar app', 'Atualizar a tela com a versão mais recente do Metro?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Recarregar',
      style: 'default',
      onPress: () => {
        void reloadApp('user');
      },
    },
  ]);
}
