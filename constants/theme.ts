export const theme = {
  colors: {
    primary: '#00A86B',
    primaryDark: '#007A4D',
    primaryLight: '#E8F8F0',
    primaryMuted: '#B8E6D0',
    secondary: '#1E3A2F',
    accent: '#FFB800',
    accentSoft: '#FFF8E6',
    background: '#F5FAF7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#1A2E24',
    textSecondary: '#6B7B72',
    textMuted: '#9CA89F',
    border: '#E2EDE7',
    borderLight: '#F0F5F2',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    success: '#00A86B',
    warning: '#F59E0B',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(26, 46, 36, 0.5)',
    shadow: 'rgba(0, 168, 107, 0.12)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  /** Largura máxima no web — sensação de celular. */
  layout: {
    maxContentWidth: 480,
  },
};

export const categoryConfig = {
  restaurante: { label: 'Restaurantes', icon: 'restaurant', color: '#FF6B35' },
  mercado: { label: 'Mercados', icon: 'cart', color: '#00A86B' },
  farmacia: { label: 'Farmácias', icon: 'medkit', color: '#3B82F6' },
  distribuidora: { label: 'Distribuidoras', icon: 'cube', color: '#8B5CF6' },
  padaria: { label: 'Padarias', icon: 'cafe', color: '#D97706' },
  bebidas: { label: 'Bebidas', icon: 'wine', color: '#EC4899' },
  conveniencia: { label: 'Conveniência', icon: 'storefront', color: '#14B8A6' },
} as const;

export type BusinessCategory = keyof typeof categoryConfig;

export const orderStatusConfig = {
  pendente: { label: 'Pedido recebido', icon: 'time', color: '#F59E0B' },
  confirmado: { label: 'Confirmado', icon: 'checkmark-circle', color: '#3B82F6' },
  preparando: { label: 'Em preparo', icon: 'flame', color: '#FF6B35' },
  saiu_entrega: { label: 'Saiu para entrega', icon: 'bicycle', color: '#8B5CF6' },
  entregue: { label: 'Entregue', icon: 'checkmark-done', color: '#00A86B' },
  cancelado: { label: 'Cancelado', icon: 'close-circle', color: '#EF4444' },
} as const;

export type OrderStatus = keyof typeof orderStatusConfig;
