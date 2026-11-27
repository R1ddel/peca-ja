import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  /** Desktop/web: estilos aprovados intactos. Mobile nativo: safe area real. */
  const isWeb = Platform.OS === 'web';
  const tabBarHeight = isWeb ? 64 : 52 + Math.max(insets.bottom, 8);
  const tabBarPaddingBottom = isWeb ? 8 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderLight,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: isWeb ? 8 : 6,
          elevation: 8,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: isWeb ? 11 : 10,
          fontWeight: '600',
          marginBottom: isWeb ? 0 : 2,
        },
        tabBarIconStyle: isWeb
          ? undefined
          : {
              marginTop: 2,
            },
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'Peça Já',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={isWeb ? size : Math.min(size, 22)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={isWeb ? size : Math.min(size, 22)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={isWeb ? size : Math.min(size, 22)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={isWeb ? size : Math.min(size, 22)} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
