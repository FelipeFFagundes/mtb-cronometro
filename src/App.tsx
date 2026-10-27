import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './data'
import { useStore } from './hooks/useStore'
import { Largada } from './components/Largada'
import { Chegada } from './components/Chegada'
import { Ranking } from './components/Ranking'
import { Pilotos } from './components/Pilotos'
import { PublicView, type PublicTab } from './components/PublicView'
import { SyncBanner } from './components/SyncBanner'
import { AdminLogin } from './components/AdminLogin'
import { ConfirmDialog, PageSkeleton } from './components/ui'
import { afterHistorySettles, useBackClose } from './hooks/useBackClose'
import { isSoundEnabled, playCountdownTick, setSoundEnabled, unlockAudio } from './lib/sound'
import { BOTTOMNAV_H, TOPBAR_H, display, radius, tokens } from './theme'
import type { SyncStatus } from './types'
import {
  AppBar,
  Toolbar,
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Snackbar,
  Alert,
} from '@mui/material'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'

type AdminTab = 'largada' | 'chegada' | 'ranking' | 'pilotos'

/** Troca de tela com transição suave (View Transitions), onde o navegador suporta. */
function withTransition(update: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce) return update()
  // A troca nunca espera a animação: se o navegador demorar a desenhar (aparelho lento,
  // aba em segundo plano) ou pular a transição, a tela muda do mesmo jeito
  let done = false
  const run = () => {
    if (done) return
    done = true
    flushSync(update)
  }
  document.startViewTransition(run).ready.catch(() => undefined)
  setTimeout(run, 250)
}

const AUTH_KEY = 'mtb-admin-auth-v1'

/** Ação que o aviso de sucesso oferece para desfazer. */
export interface UndoAction {
  run: () => Promise<unknown>
  doneMsg: string
}

/** Executa uma ação, mostra toast de sucesso/erro (com "Desfazer", se houver) e devolve se deu certo. */
export type Act = (fn: () => Promise<unknown>, okMsg?: string, undo?: UndoAction) => Promise<boolean>

/** Indicador de conexão sempre visível: o fiscal precisa saber se está online. */
function SyncPill({ sync }: { sync: SyncStatus }) {
  let label = 'Local'
  let color = tokens.muted
  if (api.mode === 'supabase') {
    if (!sync.online) {
      label = 'Offline'
      color = tokens.finish
    } else if (sync.syncing || sync.pending > 0) {
      label = 'Enviando'
      color = tokens.warn
    } else {
      label = 'Online'
      color = tokens.start
    }
  }
  return (
    <Box
      role="status"
      aria-label={`Conexão: ${label}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        height: 28,
        borderRadius: radius.pill,
        border: `1px solid ${tokens.lineStrong}`,
        ...display,
        fontSize: '0.85rem',
        fontWeight: 700,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: radius.pill,
          bgcolor: color,
          animation: label === 'Enviando' ? 'pulse 1.2s infinite' : 'none',
        }}
      />
      {label}
    </Box>
  )
}

export default function App() {
  const { state, sync, pending, loading, error, refresh } = useStore()
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(
    () => localStorage.getItem(AUTH_KEY) === 'true',
  )
  const [mode, setMode] = useState<'public' | 'admin'>(() =>
    location.hash === '#admin' && localStorage.getItem(AUTH_KEY) === 'true' ? 'admin' : 'public',
  )
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('largada')
  const [publicTab, setPublicTab] = useState<PublicTab>('live')
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  useBackClose(Boolean(menuAnchor), () => setMenuAnchor(null))
  const [soundOn, setSoundOn] = useState(isSoundEnabled)

  const toggleSound = () => {
    const next = !soundOn
    setSoundEnabled(next)
    setSoundOn(next)
    // Ao ligar, toca um bipe de amostra (o toque no menu também libera o áudio no celular)
    if (next) {
      unlockAudio()
      playCountdownTick()
    }
  }
  const [confirmData, setConfirmData] = useState<'demo' | 'reset' | null>(null)
  // Mantém o texto do diálogo estável enquanto ele anima ao fechar
  const [confirmKind, setConfirmKind] = useState<'demo' | 'reset'>('demo')
  if (confirmData && confirmData !== confirmKind) setConfirmKind(confirmData)
  const [toast, setToast] = useState<{ msg: string; err: boolean; key: number; undo?: UndoAction } | null>(null)

  const show = useCallback((msg: string, err = false, undo?: UndoAction) => {
    setToast({ msg, err, key: Date.now(), undo })
    navigator.vibrate?.(err ? [80, 60, 80] : 60)
  }, [])

  // Avisos vindos da fila (ex.: uma ação foi rejeitada pelo servidor ao sincronizar)
  useEffect(() => api.onNotice((msg, isErr) => show(msg, isErr)), [show])

  // Troca de aba volta ao topo
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [mode, adminTab, publicTab])

  const act: Act = useCallback(
    async (fn, okMsg, undo) => {
      try {
        await fn()
        if (okMsg) show(okMsg, false, undo)
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
      afterHistorySettles(() => history.replaceState(null, '', '#admin'))
    } else {
      setShowLoginModal(true)
    }
  }

  const handleLoginSuccess = () => {
    setIsAdminAuthenticated(true)
    localStorage.setItem(AUTH_KEY, 'true')
    setShowLoginModal(false)
    setMode('admin')
    afterHistorySettles(() => history.replaceState(null, '', '#admin'))
    show('Modo fiscal liberado')
  }

  const handleLogout = () => {
    setMenuAnchor(null)
    setIsAdminAuthenticated(false)
    localStorage.removeItem(AUTH_KEY)
    setMode('public')
    afterHistorySettles(() => history.replaceState(null, '', '#'))
    show('Você saiu do modo fiscal')
  }

  const switchToPublic = () => {
    setMenuAnchor(null)
    setMode('public')
    afterHistorySettles(() => history.replaceState(null, '', '#'))
  }

  const runConfirmedData = () => {
    const kind = confirmData
    setConfirmData(null)
    if (kind === 'demo') void act(() => api.loadDemo(), 'Dados de exemplo carregados')
    if (kind === 'reset') void act(() => api.reset(), 'Todos os pilotos e tempos foram apagados')
  }

  const isAdmin = mode === 'admin'

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: '#000', viewTransitionName: 'topbar', borderBottom: `1px solid ${tokens.line}`, pt: 'env(safe-area-inset-top)' }}
      >
        <Toolbar disableGutters sx={{ minHeight: `${TOPBAR_H}px !important`, px: 2, gap: 1 }}>
          <Box
            component="button"
            onClick={switchToPublic}
            aria-label="SPET Race Timer, ir para a página pública"
            sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Box component="img" src="/logo.png" alt="" sx={{ height: 26, width: 'auto', display: 'block' }} />
            <Typography
              sx={{ ...display, fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              noWrap
            >
              Race Timer
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />
          <SyncPill sync={sync} />

          {isAdmin ? (
            <>
              <IconButton
                edge="end"
                aria-label="Menu do fiscal"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ color: 'text.primary' }}
              >
                <MoreVertRoundedIcon />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                slotProps={{ paper: { sx: { bgcolor: tokens.raised, minWidth: 240 } } }}
              >
                <MenuItem onClick={switchToPublic} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    <VisibilityRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Ver página pública
                </MenuItem>
                <MenuItem onClick={toggleSound} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    {soundOn ? <VolumeUpRoundedIcon fontSize="small" /> : <VolumeOffRoundedIcon fontSize="small" />}
                  </ListItemIcon>
                  Som da largada: {soundOn ? 'ligado' : 'desligado'}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null)
                    setConfirmData('demo')
                  }}
                  sx={{ minHeight: 48 }}
                >
                  <ListItemIcon>
                    <ScienceRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Carregar dados de exemplo
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null)
                    setConfirmData('reset')
                  }}
                  sx={{ minHeight: 48, color: 'error.main' }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    <DeleteForeverRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Apagar pilotos e tempos
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    <LogoutRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Sair do modo fiscal
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={handleRequestAdmin}
              startIcon={<LockRoundedIcon sx={{ fontSize: '16px !important' }} />}
              sx={{ minHeight: 36, px: 1.5, borderColor: tokens.lineStrong }}
            >
              Fiscal
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {showLoginModal && <AdminLogin onSuccess={handleLoginSuccess} onCancel={() => setShowLoginModal(false)} />}

      <Container
        maxWidth="sm"
        component="main"
        sx={{
          flex: 1,
          px: 2,
          pt: 2,
          pb: `calc(${BOTTOMNAV_H + 32}px + env(safe-area-inset-bottom))`,
        }}
      >
        {isAdmin && <SyncBanner sync={sync} pending={pending} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <PageSkeleton />
        ) : !isAdmin ? (
          <PublicView state={state} tab={publicTab} />
        ) : (
          <>
            {adminTab === 'largada' && <Largada state={state} act={act} online={sync.online} />}
            {adminTab === 'chegada' && <Chegada state={state} act={act} online={sync.online} />}
            {adminTab === 'ranking' && <Ranking state={state} />}
            {adminTab === 'pilotos' && <Pilotos state={state} act={act} />}
          </>
        )}
      </Container>

      <Paper
        component="nav"
        aria-label={isAdmin ? 'Telas do fiscal' : 'Telas públicas'}
        square
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          bgcolor: '#000',
          borderTop: `1px solid ${tokens.line}`,
          viewTransitionName: 'bottomnav',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        {isAdmin ? (
          <BottomNavigation showLabels value={adminTab} onChange={(_, v: AdminTab) => withTransition(() => setAdminTab(v))}>
            <BottomNavigationAction label="Largada" value="largada" icon={<TrafficRoundedIcon />} />
            <BottomNavigationAction label="Chegada" value="chegada" icon={<SportsScoreRoundedIcon />} />
            <BottomNavigationAction label="Ranking" value="ranking" icon={<EmojiEventsRoundedIcon />} />
            <BottomNavigationAction label="Prova" value="pilotos" icon={<PeopleAltRoundedIcon />} />
          </BottomNavigation>
        ) : (
          <BottomNavigation showLabels value={publicTab} onChange={(_, v: PublicTab) => withTransition(() => setPublicTab(v))}>
            <BottomNavigationAction label="Ao vivo" value="live" icon={<SensorsRoundedIcon />} />
            <BottomNavigationAction label="Resultados" value="results" icon={<EmojiEventsRoundedIcon />} />
            <BottomNavigationAction label="Largadas" value="grid" icon={<FormatListNumberedRoundedIcon />} />
          </BottomNavigation>
        )}
      </Paper>

      <ConfirmDialog
        open={confirmData !== null}
        onClose={() => setConfirmData(null)}
        onConfirm={runConfirmedData}
        icon={<WarningAmberRoundedIcon />}
        tone={confirmKind === 'reset' ? 'error' : 'warning'}
        title={confirmKind === 'reset' ? 'Apagar pilotos e tempos?' : 'Carregar dados de exemplo?'}
        confirmLabel={confirmKind === 'reset' ? 'Apagar tudo' : 'Carregar'}
      >
        {confirmKind === 'reset'
          ? 'Todos os pilotos e todas as descidas serão apagados para todos os aparelhos. Não dá para desfazer.'
          : 'As descidas registradas serão apagadas e os pilotos de exemplo serão adicionados.'}
      </ConfirmDialog>

      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.err ? 5000 : toast?.undo ? 6000 : 2800}
        onClose={(_, reason) => {
          // Aviso com "Desfazer" não some com um toque qualquer na tela
          if (reason === 'clickaway' && toast?.undo) return
          setToast(null)
        }}
        // No topo: embaixo ficam os botões de largada/chegada, que não podem ser cobertos
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: `calc(${TOPBAR_H + 8}px + env(safe-area-inset-top)) !important`, left: 16, right: 16 }}
      >
        {toast ? (
          <Alert
            onClose={toast.undo ? undefined : () => setToast(null)}
            action={
              toast.undo ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const undo = toast.undo!
                    setToast(null)
                    void act(undo.run, undo.doneMsg)
                  }}
                  sx={{ fontWeight: 900, minHeight: 36, border: '1px solid currentColor' }}
                >
                  Desfazer
                </Button>
              ) : undefined
            }
            severity={toast.err ? 'error' : 'success'}
            variant="filled"
            sx={{ width: '100%', fontWeight: 700, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)' }}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
