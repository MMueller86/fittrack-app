// Design tokens — colors, typography, spacing, radius.
//
// Derived from `docs/app_logo.png`: deep black background, vibrant green
// primary (apple + EKG line), white text, silver/grey accents. We keep
// one dark palette for the MVP; a light theme can be layered later.

const palette = {
  black: '#0B0F0C',
  surface: '#141A15',
  surfaceElevated: '#1B231D',
  surfaceMuted: '#212B23',
  border: '#2A352C',

  primaryDark: '#3F7A2E',
  primary: '#67B23E',
  primaryBright: '#8FD157',
  primarySoft: 'rgba(103, 178, 62, 0.18)',

  textPrimary: '#F2F4F1',
  textSecondary: '#A6B0A4',
  textMuted: '#7E8B7C',
  textDisabled: '#4A5249',

  positive: '#67B23E', // weight loss reads as "good" — reuse primary green
  warning: '#F59E0B',
  negative: '#E26B6B',
  neutral: '#A6B0A4',
  specialActivityOutline: '#C4A1FF', // Reserved for the later special-activity badge outline.

  white: '#FFFFFF',
} as const;

export const colors = {
  background: palette.black,
  surface: palette.surface,
  surfaceElevated: palette.surfaceElevated,
  surfaceMuted: palette.surfaceMuted,
  border: palette.border,

  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primaryBright: palette.primaryBright,
  primarySoft: palette.primarySoft,

  text: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textMuted: palette.textMuted,
  textDisabled: palette.textDisabled,

  positive: palette.positive,
  warning: palette.warning,
  negative: palette.negative,
  neutral: palette.neutral,

  divider: palette.border,
  white: palette.white,

  chart: {
    line: palette.primaryBright,
    average: '#8FA9CB',
    specialActivityOutline: palette.specialActivityOutline,
    grid: palette.border,
    gradientFrom: 'rgba(143, 209, 87, 0.35)',
    gradientTo: 'rgba(143, 209, 87, 0)',
  },
} as const;

export const typography = {
  display: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: 0 },
  body1: { fontSize: 16, fontWeight: '400' as const },
  body2: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.4 },
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
  button: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.4 },
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
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const theme = { colors, typography, spacing, radius } as const;
export type Theme = typeof theme;
