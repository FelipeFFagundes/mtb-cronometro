import { alpha, createTheme } from '@mui/material/styles'

/*
 * Temas de cor. O padrão é a identidade SPET: preto e branco do logo + amarelo de placa de corrida.
 * Em todos, verde = largada e vermelho = chegada. O tema escolhido fica salvo no aparelho; trocar
 * recarrega a página, para que nenhuma tela fique com cores do tema anterior.
 */
export interface Palette {
  /** Fundo claro ou escuro (componentes do MUI seguem). */
  mode: 'dark' | 'light'
  bg: string
  surface: string
  raised: string
  /** Barras de cima e de baixo. */
  bar: string
  line: string
  lineStrong: string
  text: string
  muted: string
  brand: string
  brandInk: string
  start: string
  startInk: string
  finish: string
  finishInk: string
  warn: string
  gold: string
  silver: string
  bronze: string
}

const spet: Palette = {
  mode: 'dark',
  bg: '#0a0a0b',
  surface: '#141416',
  raised: '#1c1c20',
  bar: '#000000',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  brand: '#ffd60a',
  brandInk: '#141100',
  start: '#22c55e',
  startInk: '#03200d',
  finish: '#ff4d4f',
  finishInk: '#ffffff',
  warn: '#fb923c',
  gold: '#ffd60a',
  silver: '#d4d4d8',
  bronze: '#d97706',
}

const einkDark: Palette = {
  ...spet,
  bg: '#000000',
  surface: '#0b0b0b',
  raised: '#1a1a1a',
  line: 'rgba(255, 255, 255, 0.14)',
  lineStrong: 'rgba(255, 255, 255, 0.3)',
  text: '#f5f5f5',
  muted: '#a3a3a3',
  brand: '#f5f5f5',
  brandInk: '#000000',
  start: '#4ade80',
  startInk: '#000000',
  finish: '#f87171',
  finishInk: '#000000',
  gold: '#f5f5f5',
  silver: '#a3a3a3',
  bronze: '#737373',
}

export const PALETTES = {
  spet,
  trilha: {
    ...spet,
    bg: '#0b130e',
    surface: '#122019',
    raised: '#1b2b21',
    bar: '#070d09',
    line: 'rgba(190, 242, 100, 0.1)',
    lineStrong: 'rgba(190, 242, 100, 0.22)',
    text: '#ecfdf3',
    muted: '#9db5a6',
    brand: '#bef264',
    brandInk: '#162600',
    start: '#34d399',
    warn: '#fb923c',
    gold: '#bef264',
  },
  einkClaro: {
    ...spet,
    mode: 'light',
    bg: '#e9e7df',
    surface: '#f4f2ec',
    raised: '#dcd9ce',
    bar: '#e9e7df',
    line: 'rgba(17, 17, 17, 0.14)',
    lineStrong: 'rgba(17, 17, 17, 0.32)',
    text: '#111111',
    muted: '#57554e',
    brand: '#111111',
    brandInk: '#f4f2ec',
    start: '#166534',
    startInk: '#ffffff',
    finish: '#b91c1c',
    warn: '#9a3412',
    gold: '#a16207',
    silver: '#6b7280',
    bronze: '#9a3412',
    },
  einkEscuro: einkDark,
  ambar: {
    ...einkDark,
    line: 'rgba(255, 176, 0, 0.16)',
    lineStrong: 'rgba(255, 176, 0, 0.34)',
    text: '#ffb000',
    muted: '#c08a1e',
    brand: '#ffb000',
    gold: '#ffb000',
    silver: '#c08a1e',
    bronze: '#8a6214',
  },
} satisfies Record<string, Palette>

export type PaletteId = keyof typeof PALETTES

/** Nome e descrição de cada tema, na ordem em que aparecem para escolher. */
export const PALETTE_INFO: { id: PaletteId; name: string; text: string }[] = [
  { id: 'spet', name: 'SPET', text: 'Preto com amarelo de placa. O padrão.' },
  { id: 'trilha', name: 'Trilha', text: 'Verde-floresta com lima de alta visibilidade.' },
  { id: 'einkClaro', name: 'E-ink claro', text: 'Papel e tinta, alto contraste. Melhor no sol forte.' },
  { id: 'einkEscuro', name: 'E-ink escuro', text: 'Preto puro e branco. Economiza bateria em tela OLED.' },
  { id: 'ambar', name: 'Âmbar', text: 'Preto puro com texto âmbar. Cansa menos a vista à noite.' },
]

const PALETTE_KEY = 'mtb-palette-v1'

function savedPalette(): PaletteId {
  try {
    const id = localStorage.getItem(PALETTE_KEY)
    if (id && id in PALETTES) return id as PaletteId
  } catch {
    // Sem acesso ao armazenamento: fica o padrão
  }
  return 'spet'
}

export const paletteId: PaletteId = savedPalette()

/** Cores do tema em uso. */
export const tokens: Palette = { ...PALETTES[paletteId] }

/** Troca o tema deste aparelho e recarrega a página com as cores novas. */
export function setPalette(id: PaletteId) {
  if (id === paletteId) return
  try {
    localStorage.setItem(PALETTE_KEY, id)
  } catch {
    return
  }
  location.reload()
}

/** Cor com transparência (para fundos de destaque e linhas). */
export const tint = (color: string, opacity: number) => alpha(color, opacity)

/**
 * Logo SPET (branco sobre preto): nos temas escuros o "screen" some com o preto; no claro, a
 * imagem é invertida (preto sobre branco) e o "multiply" some com o branco.
 */
export const logoSx = tokens.mode === 'light' ? { filter: 'invert(1)', mixBlendMode: 'multiply' as const } : { mixBlendMode: 'screen' as const }

/** O desenho do fundo segue a mesma regra do logo: traços claros no escuro, escuros no claro. */
export const artSx = tokens.mode === 'light' ? { filter: 'invert(1)', mixBlendMode: 'multiply' as const, opacity: 0.2 } : { mixBlendMode: 'screen' as const, opacity: 0.13 }

// Cor da barra do navegador e dos controles nativos. O fundo fica só no body: pintado no html,
// ele cobriria o desenho do fundo (que fica atrás, com z-index -1)
if (typeof document !== 'undefined') {
  document.documentElement.style.colorScheme = tokens.mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.bar)
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
    mode: tokens.mode,
    primary: { main: tokens.brand, contrastText: tokens.brandInk },
    secondary: { main: tokens.start, contrastText: tokens.startInk },
    success: { main: tokens.start, contrastText: tokens.startInk },
    error: { main: tokens.finish, contrastText: tokens.finishInk },
    warning: { main: tokens.warn, contrastText: tokens.mode === 'light' ? '#ffffff' : '#1f0d00' },
    info: { main: '#60a5fa' },
    // Cartões levemente translúcidos: deixam o desenho do fundo aparecer um pouco
    background: { default: tokens.bg, paper: tint(tokens.surface, 0.86) },
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
      styleOverrides: { root: { backgroundColor: tokens.bar, height: BOTTOMNAV_H } },
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
