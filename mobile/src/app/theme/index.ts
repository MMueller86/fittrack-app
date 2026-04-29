// Design tokens: colors, typography, spacing.

export const colors = {
  primary: '#2E7D32',       // green 800
  primaryLight: '#60AD5E',
  primaryDark: '#005005',
  accent: '#FF8F00',        // amber 800
  background: '#F5F5F5',
  surface: '#FFFFFF',
  error: '#C62828',
  text: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  divider: '#E0E0E0',
  white: '#FFFFFF',
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0 },
  h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: 0 },
  body1: { fontSize: 16, fontWeight: '400' as const },
  body2: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
} as const;

export const theme = { colors, typography, spacing, radius } as const;
export type Theme = typeof theme;
