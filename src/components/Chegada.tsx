import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, SyncStatus } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock, fmt } from '../lib/time'
import { closedRunText } from '../lib/runs'
import { LiveTimer } from './LiveTimer'
import { BeatHint, EtaHint } from './EtaHint'
import { QuickFinish } from './QuickFinish'
import { referenceTime } from '../lib/progress'
import { isOut, outLabel, penaltyText, runTime } from '../lib/runs'
import { LateAlert, TrackProgress } from './TrackProgress'
import { radius, tabular, tint, tokens } from '../theme'
import { BottomSheet, ChipSelect, ConfirmDialog, EmptyState, Kbd, ListCard, PageHeader, RiderPlate, Section, StickyBar } from './ui'
import { SyncStamp } from './SyncBanner'
import { isTyping, overlayOpen, useKeydown } from '../hooks/useKeyboard'
import { Alert, Box, Button, ButtonBase, Chip, IconButton, Typography } from '@mui/material'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

interface Props {
  state: AppState
  act: Act
  sync: SyncStatus
}

interface RunActionTarget {
  id: string
  num: string
  name: string
  stageName?: string
  timeStr?: string
  isDnf: boolean
}

interface ConfirmTarget {
  runId?: string
  num: string
  name: string
  stageId?: string
  stageName?: string
  /** Carimbo do instante em que o fiscal tocou no piloto */
  capturedAt: number
  startAt: number | null
}

interface DnfTarget {
  id: string
  num: string
  name: string
  stageName?: string
}

export function Chegada({ state, act, sync }: Props) {
  const online = sync.online
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [dnfTarget, setDnfTarget] = useState<DnfTarget | null>(null)
  const [runActionTarget, setRunActionTarget] = useState<RunActionTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RunActionTarget | null>(null)

  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [selectedFilterStage, setSelectedFilterStage] = useState<string>('all')
  // Ordem dos cartões: por largada, ou por quem deve chegar primeiro (largada + tempo de referência)
  const [order, setOrder] = useState<'start' | 'eta'>('start')
  const [quickOpen, setQuickOpen] = useState(false)

  const riderName = (num: string) => state.riders.find((r) => r.num === num)?.name ?? `Piloto #${num}`

  // Enquanto a confirmação está aberta, outro fiscal pode fechar a mesma descida (ou a largada ser cancelada)
  const targetRun = confirmTarget?.runId ? state.runs.find((r) => r.id === confirmTarget.runId) : undefined
  const targetGone = Boolean(confirmTarget?.runId) && targetRun?.status !== 'track'

  // Registra a chegada usando o tempo capturado no toque
  const executeFinish = async (target: ConfirmTarget) => {
    if (targetGone) return
    const stageLabel = target.stageName ? ` (${target.stageName})` : ''
    setConfirmTarget(null)
    return act(
      () => api.finishRun(target.num, target.capturedAt, target.stageId).then(() => undefined),
      `${target.name} chegou${stageLabel}! ` +
        (target.startAt ? `(${fmt(target.capturedAt - target.startAt)})` : '') +
        (online ? '' : ' (salvo offline)'),
    )
  }

  // Captura o instante do toque e pede confirmação
  const requestFinish = (runId: string, n: string) => {
    const capturedAt = Date.now() + api.getClockOffset()
    navigator.vibrate?.(40)
    const run = state.runs.find((r) => r.id === runId)
    const runStage = run ? stages.find((s) => s.id === run.stageId) : null
    setConfirmTarget({
      runId,
      num: n,
      name: riderName(n),
      stageId: run?.stageId,
      stageName: runStage?.name,
      capturedAt,
      startAt: run ? run.start : null,
    })
  }

  const executeDnf = async (target: DnfTarget) => {
    setDnfTarget(null)
    return act(() => api.dnfRun(target.id), `Piloto #${target.num} (${target.name}) marcado como DNF`)
  }

  const eta = (r: (typeof state.runs)[number]) => r.start + (referenceTime(state, r)?.ms ?? Number.MAX_SAFE_INTEGER / 2)
  const track = state.runs
    .filter((r) => r.status === 'track' && (selectedFilterStage === 'all' || (r.stageId || stages[0]?.id) === selectedFilterStage))
    .sort((a, b) => (order === 'eta' ? eta(a) - eta(b) : 0) || a.start - b.start)

  // Atalhos (computador): 1 a 9 registram a chegada do piloto naquela posição; Enter confirma
  useKeydown((e) => {
    if (isTyping(e.target)) return
    if (confirmTarget) {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        void executeFinish(confirmTarget)
      }
      return
    }
    if (overlayOpen() || !/^[1-9]$/.test(e.key)) return
    const run = track[Number(e.key) - 1]
    if (run) {
      e.preventDefault()
      requestFinish(run.id, run.num)
    }
  })

  const done = state.runs
    .filter((r) => r.status !== 'track' && r.end != null)
    .sort((a, b) => b.end! - a.end!)
    .slice(0, 8)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader
        title="Chegada"
        subtitle={
          <>
            <SyncStamp sync={sync} />
            {track.length > 0 && (
              <Box component="span" sx={{ display: 'block' }}>
                Toque no piloto quando ele cruzar a linha
              </Box>
            )}
          </>
        }
      />

      {stages.length > 1 && (
        <StickyBar>
          <ChipSelect
            ariaLabel="Filtrar especial"
            value={selectedFilterStage}
            onChange={setSelectedFilterStage}
            options={[{ value: 'all', label: 'Todas' }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </StickyBar>
      )}

      <LateAlert state={state} />
      {track.length > 0 && (
        <Section title="Progresso na pista">
          <TrackProgress state={state} stageId={selectedFilterStage} />
        </Section>
      )}

      <Section
        title="Na pista"
        count={track.length}
        action={
          <Button size="small" variant="outlined" color="inherit" startIcon={<BoltRoundedIcon />} onClick={() => setQuickOpen(true)}>
            Chegada rápida
          </Button>
        }
      >
        {track.length > 1 && (
          <Box sx={{ mb: 1 }}>
            <ChipSelect
              ariaLabel="Ordem dos pilotos na pista"
              value={order}
              onChange={(v) => setOrder(v as 'start' | 'eta')}
              options={[
                { value: 'start', label: 'Ordem de largada' },
                { value: 'eta', label: 'Chegada prevista' },
              ]}
            />
          </Box>
        )}
        {track.length === 0 ? (
          <EmptyState icon={<SportsScoreRoundedIcon />} title="Pista livre" text="Nenhum piloto descendo nesta seleção." />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
            {track.map((run, idx) => {
              const st = stages.find((s) => s.id === run.stageId)
              const expected = idx === 0
              return (
                <ButtonBase
                  key={run.id}
                  onClick={() => requestFinish(run.id, run.num)}
                  aria-label={`Registrar chegada de ${riderName(run.num)}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    textAlign: 'left',
                    gap: 1,
                    p: 1.5,
                    minHeight: 132,
                    borderRadius: radius.lg,
                    bgcolor: tokens.surface,
                    border: `2px solid ${expected ? tokens.finish : tokens.line}`,
                    transition: 'transform 0.1s',
                    '&:active': { transform: 'scale(0.97)', bgcolor: tint(tokens.finish, 0.12) },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <RiderPlate num={run.num} size="md" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      {stages.length > 1 && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
                          {st?.name ?? 'Especial'}
                        </Typography>
                      )}
                      {idx < 9 && <Kbd sx={{ color: 'text.secondary' }}>{idx + 1}</Kbd>}
                    </Box>
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                    }}
                  >
                    {riderName(run.num)}
                  </Typography>
                  <Box sx={{ ...tabular, fontSize: '2rem', lineHeight: 1, fontWeight: 800, color: expected ? 'error.main' : 'text.primary' }}>
                    <LiveTimer start={run.start} />
                  </Box>
                  <EtaHint state={state} run={run} />
                  <BeatHint state={state} run={run} />
                </ButtonBase>
              )
            })}
          </Box>
        )}
      </Section>

      <Section title="Últimas chegadas">
        {done.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma chegada registrada ainda.
          </Typography>
        ) : (
          <ListCard>
            {done.map((run) => {
              const r = state.riders.find((x) => x.num === run.num)
              const st = stages.find((s) => s.id === run.stageId)
              const isDnf = isOut(run.status)
              const time = runTime(run)
              return (
                <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, pr: 1, py: 1, minHeight: 60 }}>
                  <RiderPlate num={run.num} size="sm" tone="muted" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>
                      {r?.name ?? `Piloto #${run.num}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      <Box component="span" sx={tabular}>
                        {clock(run.end!)}
                      </Box>
                      {' · '}
                      {st?.name ?? 'Especial'}
                    </Typography>
                  </Box>
                  {isOut(run.status) ? (
                    <Chip label={outLabel(run.status)} size="small" color="error" />
                  ) : (
                    <Typography sx={{ ...tabular, fontWeight: 900, color: 'secondary.main' }}>
                      {fmt(time ?? 0)}
                      {run.penaltyMs ? (
                        <Box component="span" sx={{ color: 'warning.main', fontSize: '0.75rem', ml: 0.5 }}>
                          {penaltyText(run.penaltyMs)}
                        </Box>
                      ) : null}
                    </Typography>
                  )}
                  <IconButton
                    aria-label={`Corrigir descida de ${r?.name ?? run.num}`}
                    onClick={() =>
                      setRunActionTarget({
                        id: run.id,
                        num: run.num,
                        name: r?.name ?? `Piloto #${run.num}`,
                        stageName: st?.name ?? 'Especial',
                        timeStr: isOut(run.status) ? outLabel(run.status) : fmt(time ?? 0),
                        isDnf,
                      })
                    }
                    sx={{ color: 'text.secondary' }}
                  >
                    <MoreHorizRoundedIcon />
                  </IconButton>
                </Box>
              )
            })}
          </ListCard>
        )}
      </Section>

      {/* CONFIRMAÇÃO DE CHEGADA COM TEMPO CONGELADO */}
      <BottomSheet open={Boolean(confirmTarget)} onClose={() => setConfirmTarget(null)}>
        {confirmTarget && (
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 0.5 }}>
              <RiderPlate num={confirmTarget.num} size="lg" />
              <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {confirmTarget.name}
                </Typography>
                {confirmTarget.stageName && (
                  <Typography variant="body2" color="text.secondary">
                    {confirmTarget.stageName}
                  </Typography>
                )}
              </Box>
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Tempo capturado no toque
            </Typography>
            <Typography sx={{ ...tabular, fontSize: 'clamp(3rem, 16vw, 4.5rem)', fontWeight: 900, color: 'error.main', lineHeight: 1.05 }}>
              {confirmTarget.startAt ? fmt(confirmTarget.capturedAt - confirmTarget.startAt) : clock(confirmTarget.capturedAt)}
            </Typography>
            {confirmTarget.startAt && !targetGone && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Cronômetro continua correndo: <Box component="span" sx={tabular}><LiveTimer start={confirmTarget.startAt} /></Box>
              </Typography>
            )}

            {targetGone && (
              <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                {targetRun
                  ? closedRunText(confirmTarget.name, targetRun)
                  : `A largada de ${confirmTarget.name} foi cancelada em outro aparelho.`}
              </Alert>
            )}

            <Button
              fullWidth
              size="large"
              variant="contained"
              color="error"
              disabled={targetGone}
              onClick={() => void executeFinish(confirmTarget)}
              startIcon={<SportsScoreRoundedIcon />}
              sx={{ mt: 3, minHeight: 60, fontSize: '1.15rem', fontWeight: 900 }}
            >
              CONFIRMAR CHEGADA
              <Kbd sx={{ ml: 1.5 }}>Enter</Kbd>
            </Button>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button fullWidth variant="outlined" color="inherit" onClick={() => setConfirmTarget(null)}>
                {targetGone ? 'Fechar' : 'Cancelar'}
              </Button>
              {confirmTarget.runId && !targetGone && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockRoundedIcon />}
                  onClick={() => {
                    const t = confirmTarget
                    setConfirmTarget(null)
                    setDnfTarget({ id: t.runId!, num: t.num, name: t.name, stageName: t.stageName })
                  }}
                >
                  Não terminou
                </Button>
              )}
            </Box>
          </Box>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(dnfTarget)}
        onClose={() => setDnfTarget(null)}
        onConfirm={() => dnfTarget && void executeDnf(dnfTarget)}
        icon={<WarningRoundedIcon />}
        tone="warning"
        title="Marcar como DNF?"
        confirmLabel="Sim, DNF"
      >
        <strong>
          #{dnfTarget?.num} {dnfTarget?.name}
        </strong>
        {dnfTarget?.stageName ? ` na ${dnfTarget.stageName}` : ''}. A descida é encerrada sem tempo.
      </ConfirmDialog>

      {/* CORRIGIR DESCIDA JÁ REGISTRADA */}
      <BottomSheet open={Boolean(runActionTarget)} onClose={() => setRunActionTarget(null)} title="Corrigir descida">
        {runActionTarget && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <RiderPlate num={runActionTarget.num} size="md" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 800 }}>
                  {runActionTarget.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {runActionTarget.stageName} · <Box component="span" sx={tabular}>{runActionTarget.timeStr}</Box>
                </Typography>
              </Box>
            </Box>

            {!runActionTarget.isDnf && (
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<BlockRoundedIcon />}
                onClick={async () => {
                  const target = runActionTarget
                  setRunActionTarget(null)
                  await act(() => api.dnfRun(target.id), `Descida do piloto #${target.num} marcada como DNF`)
                }}
                sx={{ justifyContent: 'flex-start', minHeight: 56 }}
              >
                Marcar como DNF / desclassificado
              </Button>
            )}
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => {
                setDeleteTarget(runActionTarget)
                setRunActionTarget(null)
              }}
              sx={{ justifyContent: 'flex-start', minHeight: 56 }}
            >
              Excluir descida (piloto pode relargar)
            </Button>
          </Box>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (target) void act(() => api.undoRun(target.id), `Descida do piloto #${target.num} excluída. O piloto pode relargar.`)
        }}
        icon={<DeleteOutlineRoundedIcon />}
        title="Excluir descida?"
        confirmLabel="Excluir"
      >
        O tempo de #{deleteTarget?.num} {deleteTarget?.name} na {deleteTarget?.stageName} será apagado.
      </ConfirmDialog>

      <QuickFinish
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        state={state}
        act={act}
        stageId={selectedFilterStage === 'all' ? undefined : selectedFilterStage}
      />
    </Box>
  )
}
