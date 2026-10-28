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
import { ConfirmDialog, EmptyState, PageSkeleton } from './components/ui'
import { afterHistorySettles, useBackClose } from './hooks/useBackClose'
import { useRoute } from './hooks/useRoute'
import { Home } from './components/Home'
import { Landing } from './components/Landing'
import { Help } from './components/Help'
import { EventsAdmin } from './components/EventsAdmin'
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
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'

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
  const { state, sync, pending, access, loading, error, refresh } = useStore()
  // Fiscal ou organizador; o papel vem do servidor (e fica guardado para valer sem sinal)
  const canOperate = access.role !== 'public'
  const isOrganizer = access.role === 'organizer'
  const [route, navigate] = useRoute()
  const [loginTab, setLoginTab] = useState<'fiscal' | 'organizador' | null>(null)
  const showLoginModal = loginTab !== null
  const events = state.events ?? (state.event ? [state.event] : [])
  const eventCode = state.event?.publicCode ?? ''

  // Rota de evento: carrega o evento do código (ou, nos links antigos "#admin", fixa o código do evento em uso)
  const [missingCode, setMissingCode] = useState<string | null>(null)
  const routeCode = route.name === 'event' ? route.code : null
  useEffect(() => {
    if (loading || routeCode === null) return
    if (routeCode === '') {
      if (eventCode) navigate({ name: 'event', code: eventCode, fiscal: true }, { replace: true })
      return
    }
    if (routeCode === eventCode) return
    let alive = true
    const known = events.find((e) => e.publicCode === routeCode)
    const lookup = known ? Promise.resolve(known) : api.findEventByCode(routeCode)
    lookup
      .then(async (found) => {
        if (!alive) return
        setMissingCode(found ? null : routeCode)
        if (found) await api.selectEvent(found.id)
      })
      .catch(() => alive && setMissingCode(routeCode))
    return () => {
      alive = false
    }
    // events muda a cada sincronização; só o código da rota e o evento em uso importam aqui
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, routeCode, eventCode])

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

  // Troca de tela ou aba volta ao topo
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route, adminTab, publicTab])

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

  const openEvent = (code: string, fiscal: boolean) => navigate({ name: 'event', code, fiscal })

  // Para onde ir depois de entrar: telas do fiscal no evento, ou área do organizador
  const [loginTarget, setLoginTarget] = useState<'event' | 'organizer'>('event')
  const openLogin = (target: 'event' | 'organizer') => {
    setLoginTarget(target)
    // No modo local o PIN é a única entrada (aba "fiscal"); com o Supabase, organizador entra por e-mail
    setLoginTab(target === 'organizer' && api.mode === 'supabase' ? 'organizador' : 'fiscal')
  }

  const handleRequestAdmin = () => {
    if (canOperate && eventCode) openEvent(eventCode, true)
    else openLogin('event')
  }

  const goOrganizer = () => {
    navigate({ name: 'organizer' })
    // O login abre depois da troca de tela, para ficar por cima dela no histórico (o Voltar fecha o login)
    if (!isOrganizer) afterHistorySettles(() => openLogin('organizer'))
  }

  const handleLoginSuccess = async () => {
    setLoginTab(null)
    const role = api.getAccess().role
    show(role === 'organizer' ? 'Entrou como organizador' : 'Modo fiscal liberado')
    if (loginTarget === 'organizer' && role === 'organizer') {
      navigate({ name: 'organizer' })
    } else {
      // O código do fiscal leva ao evento dele
      const current = await api.load()
      if (current.event?.publicCode) openEvent(current.event.publicCode, true)
    }
    void refresh()
  }

  const handleLogout = () => {
    setMenuAnchor(null)
    if (pending.length > 0) {
      show(`Há ${pending.length} ação(ões) aguardando envio. Espere sincronizar antes de sair.`, true)
      return
    }
    void api.signOut()
    if (eventCode) openEvent(eventCode, false)
    else navigate({ name: 'home' })
    show('Você saiu do modo fiscal')
  }

  const switchToPublic = () => {
    setMenuAnchor(null)
    if (eventCode) openEvent(eventCode, false)
  }

  const runConfirmedData = () => {
    const kind = confirmData
    setConfirmData(null)
    if (kind === 'demo') void act(() => api.loadDemo(), 'Dados de exemplo carregados')
    if (kind === 'reset') void act(() => api.reset(), 'Todos os pilotos e tempos foram apagados')
  }

  const inEvent = route.name === 'event'
  const isAdmin = inEvent && route.fiscal && canOperate
  // Fiscal não cadastra: a aba Prova é só do organizador
  const activeTab: AdminTab = adminTab === 'pilotos' && !isOrganizer ? 'largada' : adminTab

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Fundo: desenho da SPET bem apagado. Com "screen" o preto da imagem some e só os traços aparecem */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          // Atrás de tudo, sem criar camada própria no conteúdo (o "screen" do logo da página inicial
          // precisa enxergar o fundo para sumir com o preto)
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage: 'url(/bg-spet.jpg)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 58%',
          backgroundSize: 'min(120vw, 760px) auto',
          mixBlendMode: 'screen',
          opacity: 0.13,
        }}
      />
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: '#000', viewTransitionName: 'topbar', borderBottom: `1px solid ${tokens.line}`, pt: 'env(safe-area-inset-top)' }}
      >
        <Toolbar disableGutters sx={{ minHeight: `${TOPBAR_H}px !important`, px: 2, gap: 1 }}>
          <Box
            component="button"
            onClick={() => navigate({ name: 'home' })}
            aria-label="SPET Race Timer, ir para o início"
            sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Box component="img" src="/logo.png" alt="" sx={{ height: 26, width: 'auto', display: 'block' }} />
            <Box sx={{ minWidth: 0, lineHeight: 1 }}>
              <Typography
                sx={{ ...display, fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.1 }}
                noWrap
              >
                Race Timer
              </Typography>
              {inEvent && state.event && (
                <Typography variant="caption" noWrap sx={{ display: 'block', color: tokens.muted, lineHeight: 1.2, maxWidth: '45vw' }}>
                  {state.event.name}
                </Typography>
              )}
            </Box>
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
                {isOrganizer && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null)
                      navigate({ name: 'organizer' })
                    }}
                    sx={{ minHeight: 48 }}
                  >
                    <ListItemIcon>
                      <EventRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    Eventos
                  </MenuItem>
                )}
                <MenuItem onClick={toggleSound} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    {soundOn ? <VolumeUpRoundedIcon fontSize="small" /> : <VolumeOffRoundedIcon fontSize="small" />}
                  </ListItemIcon>
                  Som da largada: {soundOn ? 'ligado' : 'desligado'}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null)
                    navigate({ name: 'help' })
                  }}
                  sx={{ minHeight: 48 }}
                >
                  <ListItemIcon>
                    <HelpOutlineRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Como usar
                </MenuItem>
                {isOrganizer && (
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
                )}
                {isOrganizer && (
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
                )}
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ minHeight: 48 }}>
                  <ListItemIcon>
                    <LogoutRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  {isOrganizer && access.email ? `Sair (${access.email})` : 'Sair do modo fiscal'}
                </MenuItem>
              </Menu>
            </>
          ) : (
            // Na página inicial as entradas de fiscal e organizador já estão na tela
            route.name !== 'home' && (
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
            )
          )}
        </Toolbar>
      </AppBar>

      {showLoginModal && (
        <AdminLogin defaultTab={loginTab ?? 'fiscal'} onSuccess={() => void handleLoginSuccess()} onCancel={() => setLoginTab(null)} />
      )}

      <Container
        maxWidth="sm"
        component="main"
        sx={{
          flex: 1,
          px: 2,
          pt: 2,
          // Sem barra inferior fora de um evento (início e área do organizador)
          pb: `calc(${inEvent ? BOTTOMNAV_H + 32 : 32}px + env(safe-area-inset-bottom))`,
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
        ) : route.name === 'home' ? (
          <Landing
            events={events}
            access={access}
            currentEvent={state.event}
            onEvents={() => navigate({ name: 'events' })}
            onFiscal={handleRequestAdmin}
            onOrganizer={goOrganizer}
            onHelp={() => navigate({ name: 'help' })}
          />
        ) : route.name === 'help' ? (
          <Help role={access.role} />
        ) : route.name === 'events' ? (
          <Home
            events={events}
            onOpen={(e) => {
              void api.selectEvent(e.id)
              if (e.publicCode) openEvent(e.publicCode, false)
            }}
            onOrganizer={goOrganizer}
          />
        ) : route.name === 'organizer' ? (
          isOrganizer ? (
            <EventsAdmin
              events={events}
              act={act}
              onOpen={(e) => {
                void api.selectEvent(e.id)
                if (e.publicCode) openEvent(e.publicCode, true)
              }}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <EmptyState
                icon={<LockRoundedIcon />}
                title="Área do organizador"
                text={api.mode === 'supabase' ? 'Entre com o e-mail de organizador para criar e editar eventos.' : 'Entre com o PIN para gerenciar os eventos deste aparelho.'}
              />
              <Button variant="contained" onClick={() => openLogin('organizer')}>
                Entrar
              </Button>
            </Box>
          )
        ) : missingCode && missingCode === route.code ? (
          <EmptyState icon={<EventRoundedIcon />} title="Evento não encontrado" text={`Nenhum evento visível com o código ${missingCode}. Confira o link ou volte ao início.`} />
        ) : route.code && route.code !== eventCode ? (
          <PageSkeleton />
        ) : !isAdmin ? (
          <PublicView state={state} tab={publicTab} sync={sync} />
        ) : (
          <>
            {activeTab === 'largada' && <Largada state={state} act={act} sync={sync} />}
            {activeTab === 'chegada' && <Chegada state={state} act={act} sync={sync} />}
            {activeTab === 'ranking' && <Ranking state={state} sync={sync} />}
            {activeTab === 'pilotos' && <Pilotos state={state} act={act} />}
          </>
        )}
      </Container>

      {inEvent && (
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
            <BottomNavigation showLabels value={activeTab} onChange={(_, v: AdminTab) => withTransition(() => setAdminTab(v))}>
              <BottomNavigationAction label="Largada" value="largada" icon={<TrafficRoundedIcon />} />
              <BottomNavigationAction label="Chegada" value="chegada" icon={<SportsScoreRoundedIcon />} />
              <BottomNavigationAction label="Ranking" value="ranking" icon={<EmojiEventsRoundedIcon />} />
              {isOrganizer && <BottomNavigationAction label="Prova" value="pilotos" icon={<PeopleAltRoundedIcon />} />}
            </BottomNavigation>
          ) : (
            <BottomNavigation showLabels value={publicTab} onChange={(_, v: PublicTab) => withTransition(() => setPublicTab(v))}>
              <BottomNavigationAction label="Ao vivo" value="live" icon={<SensorsRoundedIcon />} />
              <BottomNavigationAction label="Resultados" value="results" icon={<EmojiEventsRoundedIcon />} />
              <BottomNavigationAction label="Largadas" value="grid" icon={<FormatListNumberedRoundedIcon />} />
            </BottomNavigation>
          )}
        </Paper>
      )}

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
