import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider, Run, Stage } from '../types'
export type { StartGridItem } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock } from '../lib/time'
import { gridForStage } from '../lib/grid'
import { athleteKey } from '../lib/athletes'
import { playCountdownTick, playStartGo, unlockAudio } from '../lib/sound'
import { useNow } from '../hooks/useNow'
import { BOTTOMNAV_H, radius, tabular, tokens } from '../theme'
import { ChipSelect, ConfirmDialog, EmptyState, Kbd, ListCard, PageHeader, RiderPlate, Section, StickyBar } from './ui'
import { useBackClose } from '../hooks/useBackClose'
import { isTyping, overlayOpen, useKeydown } from '../hooks/useKeyboard'
import {
  Box,
  ButtonBase,
  Button,
  Chip,
  Container,
  Dialog,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

const noCategory = (r: Rider) => !r.cat || r.cat === 'Sem Categoria' || r.cat.trim() === ''

/** "em 2 min" / "atrasado 1 min" em relação ao horário previsto da grade. */
function ScheduleHint({ epoch }: { epoch: number }) {
  const now = useNow(1000)
  const diffMin = Math.round((epoch - now) / 60000)
  if (Math.abs(diffMin) < 1) return <Box component="span" sx={{ color: 'secondary.main' }}>agora</Box>
  if (diffMin > 0) return <>em {diffMin} min</>
  return <Box component="span" sx={{ color: 'warning.main' }}>atrasado {-diffMin} min</Box>
}

export function Largada({ state, act, online }: Props) {
  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [activeStageId, setActiveStageId] = useState<string>(() => stages[0]?.id || 'stage-1')
  const currentStage: Stage = stages.find((s) => s.id === activeStageId) || stages[0]

  const [selectedNum, setSelectedNum] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [undoTarget, setUndoTarget] = useState<Run | null>(null)

  // Estado da Contagem Regressiva
  const [countdownTarget, setCountdownTarget] = useState<{ rider: Rider; stage: Stage } | null>(null)
  const [count, setCount] = useState<number | 'VAI!'>(3)
  useBackClose(Boolean(countdownTarget), () => setCountdownTarget(null))

  // Referências para evitar que o useEffect da contagem re-dispare se props ou estados mudarem
  const actRef = useRef(act)
  const onlineRef = useRef(online)
  useEffect(() => {
    actRef.current = act
    onlineRef.current = online
  }, [act, online])

  // Contagem regressiva (3, 2, 1, VAI!) - dispara a largada estritamente 1 vez
  useEffect(() => {
    if (!countdownTarget) return

    setCount(3)
    playCountdownTick()
    navigator.vibrate?.(60)
    let current = 3
    let hasFired = false

    const interval = window.setInterval(() => {
      current -= 1
      if (current === 0) {
        setCount('VAI!')
        playStartGo()
        navigator.vibrate?.(400)
        if (!hasFired) {
          hasFired = true
          const { rider, stage } = countdownTarget
          let runId: string | undefined
          void actRef.current(
            async () => {
              runId = (await api.startRun(rider.num, stage.id))?.id
            },
            `#${rider.num} ${rider.name} largou na ${stage.name}!` + (onlineRef.current ? '' : ' (salvo offline)'),
            {
              run: async () => {
                if (runId) await api.undoRun(runId)
              },
              doneMsg: `Largada de #${rider.num} desfeita. O piloto voltou para a fila.`,
            },
          )
        }
      } else if (current < 0) {
        clearInterval(interval)
        setCountdownTarget(null)
      } else {
        setCount(current)
        playCountdownTick()
        navigator.vibrate?.(60)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [countdownTarget])

  const startCountdown = (r: Rider) => {
    // O toque no LARGAR libera o áudio no celular (precisa ser dentro do gesto do usuário)
    unlockAudio()
    if (noCategory(r)) {
      return act(async () => {
        throw new Error(`Piloto #${r.num} (${r.name}) está sem categoria. Defina uma categoria em "Prova" antes de largar.`)
      })
    }
    if (state.runs.some((run) => run.num === r.num && run.status === 'track')) {
      return act(async () => {
        throw new Error(`${r.name} já está na pista`)
      })
    }
    if (state.runs.some((run) => run.num === r.num && (run.stageId || stages[0]?.id) === currentStage.id && run.status !== 'track')) {
      return act(async () => {
        throw new Error(`${r.name} já possui descida registrada na ${currentStage.name}`)
      })
    }
    setCountdownTarget({ rider: r, stage: currentStage })
  }

  // Grade de ordem de largada (gerada na aba Prova)
  const gridItems = state.grid
  const displayedGrid = useMemo(() => gridForStage(gridItems, currentStage.id, stages), [gridItems, currentStage.id, stages])
  const gridMap = useMemo(() => {
    const map = new Map<string, { scheduledTimeStr: string; scheduledEpoch: number; index: number }>()
    displayedGrid.forEach((item, index) => map.set(item.num, { ...item, index }))
    return map
  }, [displayedGrid])

  // Pilotos disponíveis para largar nesta especial (ordenados pela grade, se existir, ou por número)
  const availableRiders = useMemo(() => {
    const list = state.riders.filter((r) => {
      const isCurrentlyOnTrack = state.runs.some((run) => run.num === r.num && run.status === 'track')
      const hasFinishedThisStage = state.runs.some(
        (run) => run.num === r.num && (run.stageId || stages[0]?.id) === currentStage.id && run.status !== 'track',
      )
      return !isCurrentlyOnTrack && !hasFinishedThisStage
    })

    if (gridItems.length > 0) {
      list.sort((a, b) => (gridMap.get(a.num)?.index ?? 999999) - (gridMap.get(b.num)?.index ?? 999999))
    } else {
      list.sort((a, b) => Number(a.num) - Number(b.num))
    }
    return list
  }, [state.riders, state.runs, stages, currentStage.id, gridItems, gridMap])

  const selected = availableRiders.find((r) => r.num === selectedNum) ?? availableRiders[0]

  // Busca sem diferenciar acentos ("pescoco" acha "Sem pescoço")
  const q = athleteKey(search)
  const visibleQueue = q
    ? availableRiders.filter((r) => r.num.startsWith(q) || athleteKey(r.name).includes(q))
    : availableRiders

  const recent = state.runs
    .slice()
    .sort((a, b) => b.start - a.start)
    .slice(0, 6)

  // Atalhos (computador): Enter larga o piloto da vez, "/" busca na fila
  useKeydown((e) => {
    if (overlayOpen() || isTyping(e.target)) return
    if (e.key === 'Enter' && selected) {
      e.preventDefault()
      void startCountdown(selected)
    } else if (e.key === '/' && searchRef.current) {
      e.preventDefault()
      searchRef.current.focus()
    }
  })

  const onTrackCount = state.runs.filter((r) => r.status === 'track').length
  const selectedGrid = selected ? gridMap.get(selected.num) : undefined

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader
        title="Largada"
        subtitle={`${availableRiders.length} na fila · ${onTrackCount} na pista`}
      />

      {stages.length > 1 && (
        <StickyBar>
          <ChipSelect
            ariaLabel="Especial da largada"
            value={currentStage.id}
            onChange={(id) => {
              setActiveStageId(id)
              setSelectedNum(null)
            }}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
          />
        </StickyBar>
      )}

      {availableRiders.length === 0 ? (
        <EmptyState
          icon={<TrafficRoundedIcon />}
          title={state.riders.length === 0 ? 'Nenhum piloto cadastrado' : 'Fila vazia'}
          text={
            state.riders.length === 0
              ? 'Cadastre os atletas na aba Prova.'
              : `Todos já largaram ou estão na pista na ${currentStage.name}.`
          }
        />
      ) : (
        <>
          {/* PILOTO SELECIONADO (o próximo da fila, a menos que o fiscal escolha outro) */}
          {selected && (
            <Box
              sx={{
                p: 2,
                borderRadius: radius.lg,
                border: `2px solid ${tokens.start}`,
                bgcolor: 'rgba(34, 197, 94, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <RiderPlate num={selected.num} size="lg" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="overline" sx={{ color: 'secondary.main', lineHeight: 1.2 }}>
                  {selected === availableRiders[0] ? 'Próximo a largar' : 'Selecionado'}
                </Typography>
                <Typography variant="h6" noWrap sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  {selected.name}
                </Typography>
                <Typography variant="body2" color={noCategory(selected) ? 'error.main' : 'text.secondary'} noWrap>
                  {noCategory(selected) ? 'Sem categoria' : selected.cat}
                  {selectedGrid && (
                    <>
                      {' · '}
                      <Box component="span" sx={{ ...tabular, color: 'text.primary', fontWeight: 700 }}>
                        {selectedGrid.scheduledTimeStr}
                      </Box>{' '}
                      (<ScheduleHint epoch={selectedGrid.scheduledEpoch} />)
                    </>
                  )}
                </Typography>
              </Box>
            </Box>
          )}

          <Section title="Fila" count={availableRiders.length}>
            {availableRiders.length > 5 && (
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar placa ou nome"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputRef={searchRef}
                onKeyDown={(e) => {
                  // Digitar a placa e Enter: larga o primeiro da busca
                  if (e.key === 'Enter' && visibleQueue[0]) {
                    e.preventDefault()
                    const r = visibleQueue[0]
                    setSelectedNum(r.num)
                    setSearch('')
                    searchRef.current?.blur()
                    void startCountdown(r)
                  }
                }}
                sx={{ mb: 1 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Kbd>/</Kbd>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
            <ListCard>
              {visibleQueue.length === 0 && (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  Nenhum piloto encontrado
                </Typography>
              )}
              {visibleQueue.map((r) => {
                const isSel = r.num === selected?.num
                const g = gridMap.get(r.num)
                return (
                  <ButtonBase
                    key={r.num}
                    onClick={() => setSelectedNum(r.num)}
                    aria-pressed={isSel}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      minHeight: 60,
                      textAlign: 'left',
                      bgcolor: isSel ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                      boxShadow: isSel ? `inset 4px 0 0 ${tokens.start}` : 'none',
                    }}
                  >
                    <RiderPlate num={r.num} size="md" tone={isSel ? 'brand' : 'muted'} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 700 }}>
                        {r.name}
                      </Typography>
                      <Typography variant="caption" noWrap color={noCategory(r) ? 'error.main' : 'text.secondary'} sx={{ display: 'block' }}>
                        {noCategory(r) ? 'Sem categoria' : r.cat}
                      </Typography>
                    </Box>
                    {g && (
                      <Typography sx={{ ...tabular, fontWeight: 700, color: 'text.secondary', fontSize: '0.9rem' }}>
                        {g.scheduledTimeStr}
                      </Typography>
                    )}
                    {isSel && <CheckCircleRoundedIcon sx={{ color: 'secondary.main' }} />}
                  </ButtonBase>
                )
              })}
            </ListCard>
          </Section>
        </>
      )}

      {/* ÚLTIMAS LARGADAS */}
      <Section title="Últimas largadas">
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma largada ainda.
          </Typography>
        ) : (
          <ListCard>
            {recent.map((run) => {
              const r = state.riders.find((x) => x.num === run.num)
              const st = stages.find((s) => s.id === run.stageId)
              const isTrack = run.status === 'track'
              return (
                <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, minHeight: 60 }}>
                  <RiderPlate num={run.num} size="sm" tone={isTrack ? 'start' : 'muted'} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>
                      {r?.name ?? `Piloto #${run.num}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      <Box component="span" sx={tabular}>
                        {clock(run.start)}
                      </Box>
                      {' · '}
                      {st?.name ?? 'Especial'}
                    </Typography>
                  </Box>
                  {isTrack ? (
                    <IconButton aria-label={`Desfazer largada de ${r?.name ?? run.num}`} onClick={() => setUndoTarget(run)} sx={{ color: 'text.secondary' }}>
                      <UndoRoundedIcon />
                    </IconButton>
                  ) : (
                    <Chip label={run.status === 'dnf' ? 'DNF' : 'Chegou'} size="small" variant="outlined" />
                  )}
                </Box>
              )
            })}
          </ListCard>
        )}
      </Section>

      {/* BARRA DE AÇÃO FIXA NA ZONA DO POLEGAR */}
      {selected && (
        <>
          <Box sx={{ height: 72 }} />
          <Box
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: `calc(${BOTTOMNAV_H}px + env(safe-area-inset-bottom))`,
              zIndex: 9,
              bgcolor: 'rgba(10, 10, 11, 0.94)',
              backdropFilter: 'blur(10px)',
              borderTop: `1px solid ${tokens.line}`,
              py: 1.25,
            }}
          >
            <Container maxWidth="sm" sx={{ px: 2 }}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="secondary"
                onClick={() => void startCountdown(selected)}
                startIcon={<PlayArrowRoundedIcon sx={{ fontSize: '2rem !important' }} />}
                sx={{ minHeight: 60, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.02em' }}
              >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  LARGAR #{selected.num} · {selected.name.split(' ')[0]}
                </Box>
                <Kbd sx={{ ml: 1.5 }}>Enter</Kbd>
              </Button>
            </Container>
          </Box>
        </>
      )}

      {/* CONTAGEM REGRESSIVA EM TELA CHEIA (3, 2, 1, VAI!) */}
      <Dialog
        fullScreen
        open={Boolean(countdownTarget)}
        onClose={() => setCountdownTarget(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: count === 'VAI!' ? '#063d1b' : '#000',
              border: 0,
              borderRadius: 0,
              transition: 'background-color 0.2s ease',
            },
          },
        }}
      >
        {countdownTarget && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'center',
              px: 3,
              pt: 'calc(24px + env(safe-area-inset-top))',
              pb: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip label={countdownTarget.stage.name} color="secondary" />
                <Chip label={countdownTarget.rider.cat} variant="outlined" />
              </Box>
              <RiderPlate num={countdownTarget.rider.num} size="xl" />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {countdownTarget.rider.name}
              </Typography>
              {countdownTarget.rider.team && (
                <Typography color="text.secondary" sx={{ mt: -1 }}>
                  {countdownTarget.rider.team}
                </Typography>
              )}
            </Box>

            <Box
              key={String(count)}
              aria-live="assertive"
              sx={{
                ...tabular,
                fontSize: count === 'VAI!' ? 'min(32vw, 10rem)' : 'min(52vw, 15rem)',
                fontWeight: 900,
                lineHeight: 1,
                color: count === 'VAI!' ? '#4ade80' : tokens.brand,
                animation: 'pop 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
              }}
            >
              {count}
            </Box>

            <Button
              variant="outlined"
              color="inherit"
              size="large"
              fullWidth
              startIcon={<CloseRoundedIcon />}
              onClick={() => setCountdownTarget(null)}
              disabled={count === 'VAI!'}
              sx={{ maxWidth: 400, minHeight: 56 }}
            >
              Cancelar largada
            </Button>
          </Box>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        icon={<UndoRoundedIcon />}
        tone="warning"
        title="Desfazer largada?"
        confirmLabel="Desfazer"
        onConfirm={() => {
          const run = undoTarget
          setUndoTarget(null)
          if (run) void act(() => api.undoRun(run.id), `Largada do piloto #${run.num} desfeita`)
        }}
      >
        A descida de #{undoTarget?.num} será apagada e o piloto volta para a fila.
      </ConfirmDialog>
    </Box>
  )
}
