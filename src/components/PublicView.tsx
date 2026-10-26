import { useState, useMemo } from 'react'
import type { AppState } from '../types'
import { DEFAULT_STAGES } from '../types'
import { LiveTimer } from './LiveTimer'
import { EnduroLeaderboard } from './EnduroLeaderboard'
import { StartGridList } from './StartGridList'
import { clock, fmt } from '../lib/time'
import { gridForStage } from '../lib/grid'
import { display, radius, tabular, tokens } from '../theme'
import { ChipSelect, EmptyState, ListCard, PageHeader, RiderPlate, Section, StickyBar } from './ui'
import { Box, Typography } from '@mui/material'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'

export type PublicTab = 'live' | 'results' | 'grid'

export function PublicView({ state, tab }: { state: AppState; tab: PublicTab }) {
  if (tab === 'results') {
    return <EnduroLeaderboard state={state} title="Resultados" subtitle="Classificação oficial" />
  }
  if (tab === 'grid') return <PublicStartGrid state={state} />
  return <PublicLive state={state} />
}

function LiveBadge({ active }: { active: boolean }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        height: 28,
        borderRadius: radius.pill,
        bgcolor: active ? 'rgba(255, 77, 79, 0.15)' : tokens.raised,
        color: active ? 'error.main' : 'text.secondary',
        ...display,
        fontWeight: 700,
        fontSize: '0.85rem',
        letterSpacing: '0.08em',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: radius.pill,
          bgcolor: active ? 'error.main' : 'text.secondary',
          animation: active ? 'pulse 1.2s infinite' : 'none',
        }}
      />
      AO VIVO
    </Box>
  )
}

function PublicLive({ state }: { state: AppState }) {
  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)

  // Especial da fila de próximos: começa onde há gente descendo, depois é o público que escolhe
  const [selectedLiveStageId, setSelectedLiveStageId] = useState<string>(
    () => onTrack[0]?.stageId || stages[0]?.id || 'stage-1',
  )
  const activeStage = stages.find((s) => s.id === selectedLiveStageId) || stages[0]

  const gridItems = state.grid
  const gridMap = useMemo(() => {
    const map = new Map<string, { scheduledTimeStr: string; index: number }>()
    gridForStage(gridItems, activeStage.id, stages).forEach((item, index) => map.set(item.num, { ...item, index }))
    return map
  }, [gridItems, activeStage.id, stages])

  const nextToStart = useMemo(() => {
    const list = state.riders.filter((r) => {
      const isCurrentlyOnTrack = state.runs.some((run) => run.num === r.num && run.status === 'track')
      const hasFinishedThisStage = state.runs.some(
        (run) => run.num === r.num && (run.stageId || stages[0]?.id) === activeStage.id && run.status !== 'track',
      )
      return !isCurrentlyOnTrack && !hasFinishedThisStage
    })
    if (gridItems.length > 0) {
      list.sort((a, b) => (gridMap.get(a.num)?.index ?? 999999) - (gridMap.get(b.num)?.index ?? 999999))
    } else {
      list.sort((a, b) => Number(a.num) - Number(b.num))
    }
    return list.slice(0, 6)
  }, [state.riders, state.runs, stages, activeStage.id, gridItems, gridMap])

  const recentFinishes = state.runs
    .filter((r) => r.status === 'done' && r.end !== null)
    .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
    .slice(0, 5)

  // Posição de cada chegada na sua especial (para mostrar "3º na E2")
  const stageRank = (runId: string, stageId: string | undefined) => {
    const times = state.runs
      .filter((r) => r.status === 'done' && r.end != null && r.stageId === stageId)
      .sort((a, b) => a.end! - a.start - (b.end! - b.start))
    return times.findIndex((r) => r.id === runId) + 1
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Na pista"
        subtitle={onTrack.length > 0 ? `${onTrack.length} ${onTrack.length === 1 ? 'piloto descendo' : 'pilotos descendo'}` : 'Pista livre'}
        right={<LiveBadge active={onTrack.length > 0} />}
      />

      {onTrack.length === 0 ? (
        <EmptyState title="Ninguém na trilha agora" text="A próxima largada aparece aqui com o cronômetro correndo." />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {onTrack.map((run, idx) => {
            const rider = state.riders.find((r) => r.num === run.num)
            const stage = stages.find((s) => s.id === run.stageId)
            return (
              <Box
                key={run.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: radius.lg,
                  bgcolor: tokens.surface,
                  border: `1px solid ${idx === 0 ? 'rgba(255, 77, 79, 0.45)' : tokens.line}`,
                }}
              >
                <RiderPlate num={run.num} size="lg" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 800 }}>
                    {rider?.name ?? 'Piloto'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {rider?.cat ?? 'Geral'} · {stage?.name ?? 'Especial'}
                  </Typography>
                </Box>
                <Box sx={{ ...tabular, fontSize: '2.1rem', lineHeight: 1, fontWeight: 800, color: idx === 0 ? 'error.main' : 'text.primary' }}>
                  <LiveTimer start={run.start} />
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <Section title="Próximos a largar">
        {stages.length > 1 && (
          <Box sx={{ mb: 1 }}>
            <ChipSelect
              ariaLabel="Especial"
              value={activeStage.id}
              onChange={setSelectedLiveStageId}
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Box>
        )}
        {nextToStart.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {state.riders.length === 0 ? 'Nenhum piloto inscrito ainda.' : `Todos já largaram na ${activeStage.name}.`}
          </Typography>
        ) : (
          <ListCard>
            {nextToStart.map((rider, idx) => {
              const g = gridMap.get(rider.num)
              return (
                <Box key={rider.num} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
                  <RiderPlate num={rider.num} size="sm" tone={idx === 0 ? 'brand' : 'muted'} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>
                      {rider.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {rider.cat || 'Geral'}
                    </Typography>
                  </Box>
                  <Typography sx={{ ...tabular, fontWeight: 700, color: g ? 'primary.main' : 'text.secondary', fontSize: '0.9rem' }}>
                    {g ? g.scheduledTimeStr : `${idx + 1}º`}
                  </Typography>
                </Box>
              )
            })}
          </ListCard>
        )}
      </Section>

      <Section title="Últimas chegadas">
        {recentFinishes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma descida finalizada ainda.
          </Typography>
        ) : (
          <ListCard>
            {recentFinishes.map((run) => {
              const rider = state.riders.find((r) => r.num === run.num)
              const stage = stages.find((s) => s.id === run.stageId)
              const pos = stageRank(run.id, run.stageId)
              return (
                <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
                  <RiderPlate num={run.num} size="sm" tone="muted" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>
                      {rider?.name ?? 'Piloto'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {pos > 0 ? `${pos}º na ` : ''}
                      {stage?.name ?? 'Especial'} · {clock(run.end!)}
                    </Typography>
                  </Box>
                  <Typography sx={{ ...tabular, fontWeight: 900, color: 'secondary.main' }}>{fmt((run.end ?? 0) - run.start)}</Typography>
                </Box>
              )
            })}
          </ListCard>
        )}
      </Section>
    </Box>
  )
}

function PublicStartGrid({ state }: { state: AppState }) {
  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [stageId, setStageId] = useState(stages[0]?.id ?? 'stage-1')
  const items = gridForStage(state.grid, stageId, stages)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader title="Ordem de largada" subtitle={items.length > 0 ? `${items.length} pilotos` : undefined} />
      {stages.length > 1 && (
        <StickyBar>
          <ChipSelect
            ariaLabel="Especial"
            value={stageId}
            onChange={setStageId}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
          />
        </StickyBar>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={<FormatListNumberedRoundedIcon />}
          title="Grade ainda não publicada"
          text="Quando a organização gerar a ordem de largada desta especial, ela aparece aqui."
        />
      ) : (
        <StartGridList items={items} stages={stages} />
      )}
    </Box>
  )
}
