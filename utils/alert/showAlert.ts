import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

export type AlertState = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

let enqueue: ((s: AlertState) => void) | null = null;
const pending: AlertState[] = [];

export function registerAlertHost(fn: (s: AlertState) => void) {
  enqueue = fn;
  while (pending.length) fn(pending.shift()!);
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const safeButtons = buttons?.length ? buttons : [{ text: 'OK' }];
  if (Platform.OS === 'web') {
    const state: AlertState = { title, message, buttons: safeButtons };
    if (enqueue) enqueue(state);
    else pending.push(state);
    return;
  }
  Alert.alert(title, message, safeButtons);
}

export function showConfirm(
  title: string,
  message: string,
  confirmText = 'OK',
  cancelText = 'Cancelar'
): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]);
  });
}

if (Platform.OS === 'web') {
  Alert.alert = ((title: string, message?: string, buttons?: AlertButton[]) => {
    showAlert(title, message, buttons);
  }) as typeof Alert.alert;
}
