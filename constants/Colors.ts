import { theme } from './theme';

const tintColorLight = theme.colors.primary;
const tintColorDark = theme.colors.primaryLight;

export default {
  light: {
    text: theme.colors.text,
    background: theme.colors.background,
    tint: tintColorLight,
    tabIconDefault: theme.colors.textMuted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: theme.colors.white,
    background: theme.colors.secondary,
    tint: tintColorDark,
    tabIconDefault: theme.colors.textMuted,
    tabIconSelected: tintColorDark,
  },
};
