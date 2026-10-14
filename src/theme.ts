import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8', // Azul elétrico / moderno
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#082f49',
    },
    secondary: {
      main: '#22c55e', // Verde esporte / largada
      light: '#4ade80',
      dark: '#15803d',
      contrastText: '#052e16',
    },
    error: {
      main: '#ef4444', // Vermelho chegada / alerta / dnf
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#000000',
    },
    background: {
      default: '#0b1118',
      paper: '#141e2b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0b1118',
          color: '#f1f5f9',
          WebkitTapHighlightColor: 'transparent',
          paddingBottom: '88px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 18px',
          fontSize: '0.95rem',
          boxShadow: 'none',
          '&:active': {
            transform: 'scale(0.98)',
          },
          '&.MuiButton-containedPrimary': {
            boxShadow: '0 4px 14px 0 rgba(56, 189, 248, 0.25)',
          },
          '&.MuiButton-containedSecondary': {
            boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.25)',
          },
          '&.MuiButton-containedError': {
            boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.25)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 14,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#141e2b',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#141e2b',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 18,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#0b1118',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(56, 189, 248, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#38bdf8',
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11, 17, 24, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: '#94a3b8',
          '&.Mui-selected': {
            color: '#38bdf8',
          },
        },
        label: {
          fontWeight: 600,
          fontSize: '0.78rem',
          '&.Mui-selected': {
            fontSize: '0.78rem',
          },
        },
      },
    },
  },
})
