import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../data'
import type { Act, UndoAction } from '../App'
import type { AppState, Rider, Run, Stage, SyncStatus } from '../types'
export type { StartGridItem } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock, fmt } from '../lib/time'
import { isOut, outLabel, penaltyText, runTime } from '../lib/runs'
import { median, shortTime } from '../lib/progress'
import { gridForStage } from '../lib/grid'
import { athleteKey } from '../lib/athletes'
import { playCountdownTick, playStartGo, unlockAudio } from '../lib/sound'
import { useNow } from '../hooks/useNow'
import { BOTTOMNAV_H, radius, tabular, tint, tokens } from '../theme'
import { ChipSelect, CountCards, EmptyState, FilterBar, Kbd, ListCard, PageHeader, RiderPlate, Section, StickyBar } from './ui'
import { SyncStamp } from './SyncBanner'
import { LiveTimer } from './LiveTimer'
import { useBackClose } from '../hooks/useBackClose'
import { isTyping, overlayOpen, useKeydown } from '../hooks/useKeyboard'
import { Box, ButtonBase, Button, Chip, Container, Dialog, IconButton, Typography } from '@mui/material'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'

interface Props {
  state: AppState
  act: Act
  sync: SyncStatus
}

/** O que a lista mostra: a fila ou as descidas da especial em cada situação. */
type View = 'fila' | 'track' | 'done' | 'out'

const viewEmpty: Record<Exclude<View, 'fila'>, string> = {
  track: 'Ninguém na pista nesta especial.',
  done: 'Ninguém chegou ainda nesta especial.',
  out: 'Ninguém fora (DNF, DNS ou DSQ) nesta especial.',
}

const noCategory = (r: Rider) => !r.cat || r.cat === 'Sem Categoria' || r.cat.trim() === ''

/** "14:32" */
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "em 2 min" / "atrasado 1 min" em relação ao horário previsto da grade. */
function ScheduleHint({ epoch }: { epoch: number }) {
  const now = useNow(1000)
  const diffMin = Math.round((epoch - now) / 60000)
  if (Math.abs(diffMin) < 1) return <Box component="span" sx={{ color: 'secondary.main' }}>agora</Box>
  if (diffMin > 0) return <>em {diffMin} min</>
  return <Box component="span" sx={{ color: 'warning.main' }}>atrasado {-diffMin} min</Box>
}

/** Depois de cancelar uma largada: seguir com ela, no horário em que aconteceu (o cronômetro não perde nada). */
function keepStart(run: Run): UndoAction {
  return {
    label: 'Seguir largada',
    run: () => api.startRun(run.num, run.stageId, run.start),
    doneMsg: `Largada de #${run.num} mantida, no horário original (${clock(run.start)}).`,
  }
}

const cancelMsg = (num: string) => `Largada de #${num} cancelada. O piloto voltou para a fila.`

export function Largada({ state, act, sync }: Props) {
  const online = sync.online
  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [activeStageId, setActiveStageId] = useState<string>(() => stages[0]?.id || 'stage-1')
  const currentStage: Stage = stages.find((s) => s.id === activeStageId) || stages[0]

  const [view, setView] = useState<View>('fila')
  // Relógio para o ritmo de largada (horários previstos e fim da prova)
  const now = useNow(5000)
  const [selectedNum, setSelectedNum] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

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
          let started: Run | null = null
          void actRef.current(
            async () => {
              started = await api.startRun(rider.num, stage.id)
            },
            `#${rider.num} ${rider.name} largou na ${stage.name}!` + (onlineRef.current ? '' : ' (salvo offline)'),
            {
              label: 'Cancelar',
              run: async () => {
                if (started) await api.undoRun(started.id)
              },
              doneMsg: cancelMsg(rider.num),
              then: () => (started ? keepStart(started) : undefined),
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

  const selectedGrid = selected ? gridMap.get(selected.num) : undefined

  // Descidas desta especial, por situação (os cartões de contagem e as listas fora da fila)
  const stageRuns = state.runs.filter((run) => (run.stageId || stages[0]?.id) === currentStage.id)
  const byStatus = (status: Run['status'] | 'out') =>
    stageRuns.filter((run) => (status === 'out' ? isOut(run.status) : run.status === status))
  const viewRuns =
    view === 'track'
      ? byStatus('track').sort((a, b) => a.start - b.start)
      : view === 'fila'
        ? []
        : byStatus(view).sort((a, b) => (b.end ?? b.start) - (a.end ?? a.start))

  // Ritmo de largada desta especial: intervalo médio das últimas 10 largadas (ignorando pausas de mais de 30 min)
  const starts = stageRuns
    .filter((r) => r.status !== 'dns')
    .map((r) => r.start)
    .sort((a, b) => a - b)
  const gaps = starts
    .slice(1)
    .map((t, i) => t - starts[i])
    .filter((g) => g > 0 && g < 30 * 60_000)
    .slice(-10)
  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
  const lastStart = starts[starts.length - 1]
  const stageRef = median(stageRuns.map((r) => runTime(r) ?? NaN))
  const endEstimate =
    avgGap && lastStart ? Math.max(now, lastStart + availableRiders.length * avgGap) + (stageRef ?? 0) : null
  /** Horário previsto de largada de quem está na fila (quando não há grade). */
  const predictedStart = (index: number) => (avgGap && lastStart ? Math.max(now, lastStart) + (index + 1) * avgGap : null)

  const runRow = (run: Run, showStage: boolean) => {
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
            largou{' '}
            <Box component="span" sx={tabular}>
              {clock(run.start)}
            </Box>
            {showStage && ` · ${st?.name ?? 'Especial'}`}
          </Typography>
        </Box>
        {isTrack ? (
          <>
            {!showStage && (
              <Typography sx={{ ...tabular, fontWeight: 800 }}>
                <LiveTimer start={run.start} />
              </Typography>
            )}
            {/* Cancela na hora, sem confirmação: o aviso seguinte oferece "Seguir largada" */}
            <IconButton
              aria-label={`Cancelar largada de ${r?.name ?? run.num}`}
              onClick={() => void act(() => api.undoRun(run.id), cancelMsg(run.num), keepStart(run))}
              sx={{ color: 'text.secondary' }}
            >
              <UndoRoundedIcon />
            </IconButton>
          </>
        ) : run.status === 'done' && run.end != null && !showStage ? (
          <Typography sx={{ ...tabular, fontWeight: 800 }}>
            {fmt(runTime(run) ?? 0)}
            {run.penaltyMs ? (
              <Box component="span" sx={{ color: 'warning.main', fontSize: '0.75rem', ml: 0.5 }}>
                {penaltyText(run.penaltyMs)}
              </Box>
            ) : null}
          </Typography>
        ) : (
          // Mesmas cores da Chegada: DNF/DNS/DSQ vermelho cheio, chegada em verde (o texto continua dizendo qual é)
          isOut(run.status) ? (
            <Chip label={outLabel(run.status)} size="small" color="error" />
          ) : (
            <Chip label="Chegou" size="small" color="secondary" variant="outlined" />
          )
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader title="Largada" subtitle={<SyncStamp sync={sync} />} />

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

      <CountCards
        ariaLabel={`Pilotos na ${currentStage.name}`}
        value={view}
        onChange={(v) => setView(v as View)}
        options={[
          { value: 'fila', label: 'Na fila', count: availableRiders.length },
          { value: 'track', label: 'Na pista', count: byStatus('track').length },
          { value: 'done', label: 'Chegaram', count: byStatus('done').length },
          { value: 'out', label: 'Fora', count: byStatus('out').length },
        ]}
      />

      {avgGap && (
        <Typography variant="body2" color="text.secondary" sx={{ ...tabular, mt: -0.5 }}>
          Ritmo: 1 a cada <b>{shortTime(avgGap)}</b> · {Math.round(3_600_000 / avgGap)}/h
          {availableRiders.length > 0 && endEstimate ? ` · faltam ${availableRiders.length} · fim previsto ~${hhmm(endEstimate)}` : ''}
        </Typography>
      )}

      {view !== 'fila' ? (
        viewRuns.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            {viewEmpty[view]}
          </Typography>
        ) : (
          <ListCard>{viewRuns.map((run) => runRow(run, false))}</ListCard>
        )
      ) : availableRiders.length === 0 ? (
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
                bgcolor: tint(tokens.start, 0.06),
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

          <Section title="Fila">
            {availableRiders.length > 5 && (
              <FilterBar
                placeholder="Buscar placa ou nome"
                value={search}
                onChange={setSearch}
                count={q ? `${visibleQueue.length} de ${availableRiders.length}` : `${availableRiders.length} na fila`}
                inputRef={searchRef}
                shortcut="/"
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
              />
            )}
            <Box sx={{ mt: availableRiders.length > 5 ? 1 : 0 }} />
            <ListCard>
              {visibleQueue.length === 0 && (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  Nenhum piloto encontrado
                </Typography>
              )}
              {visibleQueue.map((r) => {
                const isSel = r.num === selected?.num
                const g = gridMap.get(r.num)
                // Sem grade: horário previsto pelo ritmo das últimas largadas
                const guess = !g ? predictedStart(availableRiders.indexOf(r)) : null
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
                      bgcolor: isSel ? tint(tokens.start, 0.08) : 'transparent',
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
                    {g ? (
                      <Typography sx={{ ...tabular, fontWeight: 700, color: 'text.secondary', fontSize: '0.9rem' }}>
                        {g.scheduledTimeStr}
                      </Typography>
                    ) : guess ? (
                      <Typography title="Previsto pelo ritmo de largada" sx={{ ...tabular, fontWeight: 600, color: 'text.secondary', fontSize: '0.85rem' }}>
                        ~{hhmm(guess)}
                      </Typography>
                    ) : null}
                    {isSel && <CheckCircleRoundedIcon sx={{ color: 'secondary.main' }} />}
                  </ButtonBase>
                )
              })}
            </ListCard>
          </Section>
        </>
      )}

      {/* ÚLTIMAS LARGADAS (todas as especiais) */}
      {view === 'fila' && (
        <Section title="Últimas largadas">
          {recent.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma largada ainda.
            </Typography>
          ) : (
            <ListCard>{recent.map((run) => runRow(run, true))}</ListCard>
          )}
        </Section>
      )}

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
              bgcolor: tint(tokens.bg, 0.94),
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
              // VAI!: tela inteira verde sólida (pode largar); depois volta sozinha para a Largada
              bgcolor: count === 'VAI!' ? tokens.start : tokens.bg,
              color: count === 'VAI!' ? tokens.startInk : tokens.text,
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
                {/* No VAI! o fundo fica verde: os chips passam a usar a cor do texto para não sumirem */}
                <Chip label={countdownTarget.stage.name} color={count === 'VAI!' ? 'default' : 'secondary'} variant={count === 'VAI!' ? 'outlined' : 'filled'} sx={count === 'VAI!' ? { color: 'inherit', borderColor: 'currentColor' } : undefined} />
                <Chip label={countdownTarget.rider.cat} variant="outlined" sx={{ color: 'inherit', borderColor: 'currentColor' }} />
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

            {/* Semáforo de pórtico: acende um vermelho a cada segundo e todos ficam verdes no VAI */}
            <Box aria-hidden sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              {[0, 1, 2].map((i) => {
                const lit = count === 'VAI!' ? 'go' : 3 - (count as number) >= i ? 'red' : 'off'
                return (
                  <Box
                    key={i}
                    sx={{
                      width: 'min(14vw, 64px)',
                      height: 'min(14vw, 64px)',
                      borderRadius: '50%',
                      border: `3px solid ${lit === 'go' ? tokens.startInk : tokens.lineStrong}`,
                      bgcolor: lit === 'go' ? tokens.startInk : lit === 'red' ? tokens.finish : tokens.raised,
                      boxShadow: lit === 'red' ? `0 0 24px ${tokens.finish}` : 'none',
                      transition: 'background-color 0.1s',
                    }}
                  />
                )
              })}
            </Box>

            <Box
              key={String(count)}
              aria-live="assertive"
              sx={{
                ...tabular,
                fontSize: count === 'VAI!' ? 'min(32vw, 10rem)' : 'min(52vw, 15rem)',
                fontWeight: 900,
                lineHeight: 1,
                color: count === 'VAI!' ? tokens.startInk : tokens.brand,
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

    </Box>
  )
}
