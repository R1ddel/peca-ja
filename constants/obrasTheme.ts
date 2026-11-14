/** Tema visual do módulo Obras / Engenharia — isolado do app principal. */
export const obrasTheme = {
  colors: {
    primary: '#F59E0B',
    primaryDark: '#D97706',
    primaryLight: '#FEF3C7',
    secondary: '#1E40AF',
    secondaryLight: '#DBEAFE',
    admin: '#0F172A',
    foreman: '#EA580C',
    worker: '#059669',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    white: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.6)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 30,
  },
} as const;

export const obrasRoleLabels = {
  admin: 'Engenheiro / Dono',
  foreman: 'Encarregado',
  worker: 'Funcionário',
} as const;

export const taskStatusConfig = {
  pending: { label: 'Pendente', color: '#94A3B8', icon: 'time-outline' as const },
  in_progress: { label: 'Em andamento', color: '#3B82F6', icon: 'hammer-outline' as const },
  done: { label: 'Concluído', color: '#10B981', icon: 'checkmark-circle-outline' as const },
} as const;

export const planningPeriodLabels = {
  week: 'Semanal',
  month: 'Mensal',
  quarter: 'Trimestral',
  year: 'Anual',
} as const;
