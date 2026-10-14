import { useCallback, useEffect, useState } from 'react'
import { api } from './data'
import { useStore } from './hooks/useStore'
import { Largada } from './components/Largada'
import { Chegada } from './components/Chegada'
import { Ranking } from './components/Ranking'
import { Pilotos } from './components/Pilotos'
import { PublicView } from './components/PublicView'
import { SyncBanner } from './components/SyncBanner'
import { AdminLogin } from './components/AdminLogin'
import {
  AppBar,
  Toolbar,
  Container,
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'

type AdminTab = 'largada' | 'chegada' | 'ranking' | 'pilotos'

const AUTH_KEY = 'mtb-admin-auth-v1'

/** Executa uma ação, mostra toast de sucesso/erro e devolve se deu certo. */
export type Act = (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>

export default function App() {
  const { state, sync, pending, loading, error, refresh } = useStore()
  const [mode, setMode] = useState<'public' | 'admin'>('public')
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_KEY) === 'true'
  })
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('largada')
  const [toast, setToast] = useState<{ msg: string; err: boolean; key: number } | null>(null)

  const show = useCallback((msg: string, err = false) => {
    setToast({ msg, err, key: Date.now() })
    navigator.vibrate?.(err ? [80, 60, 80] : 60)
  }, [])

  // Avisos vindos da fila (ex.: uma ação foi rejeitada pelo servidor ao sincronizar)
  useEffect(() => api.onNotice((msg, isErr) => show(msg, isErr)), [show])

  const act: Act = useCallback(
    async (fn, okMsg) => {
      try {
        await fn()
        if (okMsg) show(okMsg)
        void refresh()
        return true
      } catch (e) {
        show(e instanceof Error ? e.message : 'Erro inesperado', true)
        return false
      }
    },
    [refresh, show],
  )

  const handleRequestAdmin = () => {
    if (isAdminAuthenticated) {
      setMode('admin')
      history.replaceState(null, '', '#admin')
    } else {
      setShowLoginModal(true)
    }
  }

  const handleLoginSuccess = () => {
    setIsAdminAuthenticated(true)
    localStorage.setItem(AUTH_KEY, 'true')
    setShowLoginModal(false)
    setMode('admin')
    history.replaceState(null, '', '#admin')
    show('🔓 Acesso de administrador liberado!')
  }

  const handleLogout = () => {
    setIsAdminAuthenticated(false)
    localStorage.removeItem(AUTH_KEY)
    setMode('public')
    history.replaceState(null, '', '#')
    show('🔒 Sessão de administrador encerrada.')
  }

  const switchToPublic = () => {
    setMode('public')
    history.replaceState(null, '', '#')
  }

  // Chip de status de sincronização
  let syncLabel = 'Local'
  let syncColor: 'default' | 'success' | 'warning' | 'error' = 'default'
  let syncIcon = <FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />

  if (api.mode === 'supabase') {
    if (!sync.online) {
      syncLabel = 'Offline'
      syncColor = 'error'
    } else if (sync.syncing) {
      syncLabel = 'Sincronizando'
      syncColor = 'warning'
      syncIcon = <SyncRoundedIcon sx={{ fontSize: '14px !important', animation: 'spin 1.5s linear infinite' }} />
    } else {
      syncLabel = 'Tempo Real'
      syncColor = 'success'
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* TOPBAR / APPBAR MATERIAL UI */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(11, 17, 24, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, py: 0.5 }}>
          {/* Brand Logo e Título */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="SPET Logo"
              sx={{ height: 28, width: 'auto', display: 'block' }}
            />
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
              <span style={{ color: '#38bdf8' }}>MTB</span> Cronômetro
            </Typography>
          </Box>

          {/* Ações da Barra Superior */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.8, sm: 1.5 } }}>
            {/* Seletor de Modo: Resultados vs Fiscal */}
            <Box
              sx={{
                display: 'flex',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                p: 0.4,
                borderRadius: 2.5,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Button
                size="small"
                variant={mode === 'public' ? 'contained' : 'text'}
                color="primary"
                onClick={switchToPublic}
                startIcon={<VisibilityRoundedIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
                sx={{
                  py: 0.5,
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: '0.75rem', sm: '0.85rem' },
                  bgcolor: mode === 'public' ? 'primary.main' : 'transparent',
                  color: mode === 'public' ? 'primary.contrastText' : 'text.secondary',
                }}
              >
                Resultados
              </Button>
              <Button
                size="small"
                variant={mode === 'admin' ? 'contained' : 'text'}
                color="primary"
                onClick={handleRequestAdmin}
                startIcon={isAdminAuthenticated ? <AdminPanelSettingsRoundedIcon sx={{ fontSize: { xs: 16, sm: 18 } }} /> : <LockRoundedIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
                sx={{
                  py: 0.5,
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: '0.75rem', sm: '0.85rem' },
                  bgcolor: mode === 'admin' ? 'primary.main' : 'transparent',
                  color: mode === 'admin' ? 'primary.contrastText' : 'text.secondary',
                }}
              >
                Fiscal
              </Button>
            </Box>

            {/* Chip de Status de Conexão */}
            <Chip
              icon={syncIcon}
              label={syncLabel}
              size="small"
              color={syncColor}
              variant="outlined"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Modal de Login por PIN */}
      {showLoginModal && (
        <AdminLogin
          onSuccess={handleLoginSuccess}
          onCancel={() => setShowLoginModal(false)}
        />
      )}

      {/* Barra de utilidades do ADM (Logout / Sair) */}
      {mode === 'admin' && (
        <Box sx={{ bgcolor: 'rgba(56, 189, 248, 0.06)', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', py: 0.8, px: 2 }}>
          <Container maxWidth="sm" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Painel de Operações dos Fiscais
            </Typography>
            <Button
              size="small"
              color="error"
              onClick={handleLogout}
              startIcon={<LogoutRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ py: 0.2, px: 1, fontSize: '0.75rem', fontWeight: 700 }}
            >
              Sair
            </Button>
          </Container>
        </Box>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <Container maxWidth="sm" component="main" sx={{ flex: 1, py: 2.5, px: { xs: 2, sm: 3 } }}>
        {mode === 'admin' && <SyncBanner sync={sync} pending={pending} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <CircularProgress color="primary" />
            <Typography variant="body2" color="text.secondary">
              Carregando dados da prova…
            </Typography>
          </Box>
        ) : mode === 'public' ? (
          /* TELA DE VISUALIZAÇÃO PÚBLICA (RESULTADOS + ATLETAS NA PISTA) */
          <PublicView state={state} />
        ) : (
          /* TELA DE ADMINISTRAÇÃO E FISCAIS */
          <>
            {adminTab === 'largada' && <Largada state={state} act={act} online={sync.online} />}
            {adminTab === 'chegada' && <Chegada state={state} act={act} online={sync.online} />}
            {adminTab === 'ranking' && <Ranking state={state} />}
            {adminTab === 'pilotos' && <Pilotos state={state} act={act} />}
          </>
        )}
      </Container>

      {/* BARRA DE NAVEGAÇÃO INFERIOR MATERIAL UI (MODO ADMIN) */}
      {mode === 'admin' && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
          elevation={4}
        >
          <BottomNavigation
            showLabels
            value={adminTab}
            onChange={(_, newValue: AdminTab) => setAdminTab(newValue)}
            sx={{ height: 68 }}
          >
            <BottomNavigationAction
              label="Largada"
              value="largada"
              icon={<TrafficRoundedIcon />}
            />
            <BottomNavigationAction
              label="Chegada"
              value="chegada"
              icon={<FlagRoundedIcon />}
            />
            <BottomNavigationAction
              label="Ranking"
              value="ranking"
              icon={<EmojiEventsRoundedIcon />}
            />
            <BottomNavigationAction
              label="Pilotos"
              value="pilotos"
              icon={<PeopleAltRoundedIcon />}
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* NOTIFICAÇÃO SNACKBAR / TOAST MATERIAL UI */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2800}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: mode === 'admin' ? 84 : 24 }}
      >
        {toast ? (
          <Alert
            onClose={() => setToast(null)}
            severity={toast.err ? 'error' : 'success'}
            variant="filled"
            sx={{
              width: '100%',
              borderRadius: 3,
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
