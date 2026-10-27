import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock, fmt } from '../lib/time'
import { LiveTimer } from './LiveTimer'
import { radius, tabular, tokens } from '../theme'
import { BottomSheet, ChipSelect, ConfirmDialog, EmptyState, Kbd, ListCard, PageHeader, RiderPlate, Section, StickyBar } from './ui'
import { isTyping, overlayOpen, useKeydown } from '../hooks/useKeyboard'
import { Box, Button, ButtonBase, Chip, IconButton, Typography } from '@mui/material'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

interface Props {
  state: AppState
  act: Act
  online: boolean
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

export function Chegada({ state, act, online }: Props) {
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [dnfTarget, setDnfTarget] = useState<DnfTarget | null>(null)
  const [runActionTarget, setRunActionTarget] = useState<RunActionTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RunActionTarget | null>(null)

  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [selectedFilterStage, setSelectedFilterStage] = useState<string>('all')

  const riderName = (num: string) => state.riders.find((r) => r.num === num)?.name ?? `Piloto #${num}`

  // Registra a chegada usando o tempo capturado no toque
  const executeFinish = async (target: ConfirmTarget) => {
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

  const track = state.runs
    .filter((r) => r.status === 'track' && (selectedFilterStage === 'all' || (r.stageId || stages[0]?.id) === selectedFilterStage))
    .sort((a, b) => a.start - b.start)

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
      <PageHeader title="Chegada" subtitle={track.length > 0 ? 'Toque no piloto quando ele cruzar a linha' : undefined} />

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

      <Section title="Na pista" count={track.length}>
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
                    '&:active': { transform: 'scale(0.97)', bgcolor: 'rgba(255, 77, 79, 0.12)' },
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
              const isDnf = run.status === 'dnf'
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
                  {isDnf ? (
                    <Chip label="DNF" size="small" color="error" />
                  ) : (
                    <Typography sx={{ ...tabular, fontWeight: 900, color: 'secondary.main' }}>{fmt(run.end! - run.start)}</Typography>
                  )}
                  <IconButton
                    aria-label={`Corrigir descida de ${r?.name ?? run.num}`}
                    onClick={() =>
                      setRunActionTarget({
                        id: run.id,
                        num: run.num,
                        name: r?.name ?? `Piloto #${run.num}`,
                        stageName: st?.name ?? 'Especial',
                        timeStr: isDnf ? 'DNF' : fmt(run.end! - run.start),
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
            {confirmTarget.startAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Cronômetro continua correndo: <Box component="span" sx={tabular}><LiveTimer start={confirmTarget.startAt} /></Box>
              </Typography>
            )}

            <Button
              fullWidth
              size="large"
              variant="contained"
              color="error"
              onClick={() => void executeFinish(confirmTarget)}
              startIcon={<SportsScoreRoundedIcon />}
              sx={{ mt: 3, minHeight: 60, fontSize: '1.15rem', fontWeight: 900 }}
            >
              CONFIRMAR CHEGADA
              <Kbd sx={{ ml: 1.5 }}>Enter</Kbd>
            </Button>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button fullWidth variant="outlined" color="inherit" onClick={() => setConfirmTarget(null)}>
                Cancelar
              </Button>
              {confirmTarget.runId && (
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
    </Box>
  )
}
