import { createTheme } from '@mui/material/styles'

/**
 * Identidade: preto e branco do logo SPET + amarelo de placa de corrida.
 * Verde = largada, vermelho = chegada. Alto contraste para uso ao sol.
 */
export const tokens = {
  bg: '#0a0a0b',
  surface: '#141416',
  raised: '#1c1c20',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  brand: '#ffd60a',
  brandInk: '#141100',
  start: '#22c55e',
  startInk: '#03200d',
  finish: '#ff4d4f',
  warn: '#fb923c',
  gold: '#ffd60a',
  silver: '#d4d4d8',
  bronze: '#d97706',
}

const SYSTEM_FONT = ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'].join(',')

/*
 * Estéticas disponíveis. Troque LOOK para mudar o visual do app inteiro:
 * - 'angular': cantos retos e títulos condensados em caixa alta (painel de cronometragem)
 * - 'rounded': cantos arredondados e fonte do sistema
 * Raios em px.
 */
const looks = {
  angular: {
    radius: { sm: 2, md: 2, lg: 2, sheet: 0, pill: 2 },
    displayFont: `"Barlow Condensed", ${SYSTEM_FONT}`,
    displayCase: 'uppercase' as const,
    displaySpacing: '0.02em',
    accentBar: true,
  },
  rounded: {
    radius: { sm: 8, md: 12, lg: 16, sheet: 24, pill: 999 },
    displayFont: SYSTEM_FONT,
    displayCase: 'none' as const,
    displaySpacing: '-0.01em',
    accentBar: false,
  },
}

export const LOOK: keyof typeof looks = 'angular'
export const look = looks[LOOK]

/** Raios prontos para o `sx` (string em px: número no `sx` é multiplicado pelo raio do tema). */
export const radius = {
  sm: `${look.radius.sm}px`,
  md: `${look.radius.md}px`,
  lg: `${look.radius.lg}px`,
  sheet: `${look.radius.sheet}px`,
  pill: `${look.radius.pill}px`,
}

/** Fonte de destaque (títulos, placas, cronômetros, botões). */
export const display = {
  fontFamily: look.displayFont,
  textTransform: look.displayCase,
  letterSpacing: look.displaySpacing,
} as const

/** Altura da barra superior e da navegação inferior (sem a safe-area). */
export const TOPBAR_H = 56
export const BOTTOMNAV_H = 64

/** Números alinhados (tempos, placas, horários). */
export const tabular = {
  fontFamily: look.displayFont,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
  letterSpacing: '0',
} as const

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.brand, light: '#ffe45c', dark: '#d4b000', contrastText: tokens.brandInk },
    secondary: { main: tokens.start, light: '#4ade80', dark: '#16a34a', contrastText: tokens.startInk },
    success: { main: tokens.start, contrastText: tokens.startInk },
    error: { main: tokens.finish, light: '#ff7b7c', dark: '#d92d2f', contrastText: '#ffffff' },
    warning: { main: tokens.warn, contrastText: '#1f0d00' },
    info: { main: '#60a5fa' },
    // Cartões levemente translúcidos: deixam o desenho do fundo aparecer um pouco
    background: { default: tokens.bg, paper: 'rgba(20, 20, 22, 0.86)' },
    text: { primary: tokens.text, secondary: tokens.muted },
    divider: tokens.line,
  },
  shape: { borderRadius: look.radius.md },
  typography: {
    fontFamily: SYSTEM_FONT,
    h1: { ...display, fontWeight: 800, textWrap: 'balance' },
    h2: { ...display, fontWeight: 800, textWrap: 'balance' },
    h3: { ...display, fontWeight: 800, textWrap: 'balance' },
    h4: { ...display, fontWeight: 800, textWrap: 'balance' },
    h5: { ...display, fontWeight: 800, textWrap: 'balance' },
    h6: { ...display, fontWeight: 700, textWrap: 'balance' },
    overline: { ...display, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', lineHeight: 1.6, textTransform: 'uppercase' },
    button: { ...display, fontWeight: 700, fontSize: '1rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitTextSizeAdjust: '100%' },
        body: {
          backgroundColor: tokens.bg,
          color: tokens.text,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          overscrollBehaviorY: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          minHeight: 44,
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeLarge: { minHeight: 56, fontSize: '1.15rem' },
        outlined: { borderColor: tokens.lineStrong },
      },
    },
    MuiFab: {
      styleOverrides: { root: { ...display, fontWeight: 700, borderRadius: look.accentBar ? radius.md : undefined } },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 44, minHeight: 44, borderRadius: look.accentBar ? radius.md : undefined } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundColor: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: radius.lg },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: tokens.raised, border: `1px solid ${tokens.line}`, borderRadius: radius.lg },
      },
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: radius.md } },
    },
    MuiChip: {
      styleOverrides: { root: { ...display, fontWeight: 700, fontSize: '0.875rem', borderRadius: radius.sm } },
    },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: tokens.bg,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.lineStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.brand },
        },
        input: { fontSize: 16 }, // evita zoom automático do iOS ao focar
      },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { backgroundColor: '#000', height: BOTTOMNAV_H } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: tokens.muted,
          minWidth: 0,
          '&.Mui-selected': {
            color: tokens.brand,
            // No visual angular, a aba ativa ganha uma barra amarela no topo
            boxShadow: look.accentBar ? `inset 0 3px 0 ${tokens.brand}` : 'none',
          },
        },
        label: { ...display, fontWeight: 700, fontSize: '0.85rem', '&.Mui-selected': { fontSize: '0.85rem' } },
      },
    },
    MuiTab: {
      styleOverrides: { root: { ...display, fontWeight: 700, fontSize: '1rem', minHeight: 44 } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 3, borderRadius: 0 } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radius.md } },
    },
    MuiSnackbarContent: {
      styleOverrides: { root: { borderRadius: radius.md } },
    },
  },
})
