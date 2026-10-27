import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { buildEnduroRanking, type EnduroRankRow } from '../lib/ranking'
import { fmt } from '../lib/time'
import { radius, tabular, tokens } from '../theme'
import { ChipSelect, EmptyState, ListCard, PageHeader, RiderPlate, StickyBar } from './ui'
import { ExportReport } from './ExportReport'
import { Box, Button, ButtonBase, Chip, Collapse, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'

interface Props {
  state: AppState
  title?: string
  subtitle?: string
}

const podium = [tokens.gold, tokens.silver, tokens.bronze]

function Position({ pos }: { pos: number }) {
  const color = podium[pos - 1]
  return (
    <Box
      sx={{
        ...tabular,
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: radius.pill,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '1.15rem',
        color: color ? '#000' : 'text.secondary',
        bgcolor: color ?? 'transparent',
      }}
    >
      {pos}
    </Box>
  )
}

/** Resultado principal da linha: tempo total (geral) ou tempo da especial. */
function MainResult({ row, stageId, isFirst }: { row: EnduroRankRow; stageId: string; isFirst: boolean }) {
  if (stageId === 'all') {
    if (row.hasDnf) return <Chip label="DNF" size="small" color="error" />
    if (row.completedCount === 0) return <Typography variant="body2" color="text.secondary">—</Typography>
    return (
      <>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>{fmt(row.totalTime)}</Typography>
        <Typography sx={{ ...tabular, fontSize: '0.75rem', fontWeight: 700, color: isFirst ? 'secondary.main' : 'warning.main' }}>
          {isFirst ? 'Líder' : `+${fmt(row.totalGap)}`}
        </Typography>
      </>
    )
  }
  const perf = row.stagePerformances[stageId]
  if (perf?.status === 'done' && perf.time != null) {
    return (
      <>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>{fmt(perf.time)}</Typography>
        <Typography sx={{ ...tabular, fontSize: '0.75rem', fontWeight: 700, color: isFirst ? 'secondary.main' : 'warning.main' }}>
          {isFirst || perf.stageGap == null ? 'Melhor' : `+${fmt(perf.stageGap)}`}
        </Typography>
      </>
    )
  }
  if (perf?.status === 'dnf') return <Chip label="DNF" size="small" color="error" />
  if (perf?.status === 'track') return <Chip label="Na pista" size="small" color="warning" variant="outlined" />
  return <Typography variant="body2" color="text.secondary">—</Typography>
}

export function EnduroLeaderboard({ state, title = 'Classificação', subtitle }: Props) {
  // Baixa o gerador de PDF em segundo plano: o "Exportar" funciona mesmo se o sinal cair no fim da prova
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    idle(() => void import('../lib/reportPdf').catch(() => undefined))
  }, [])

  const [cat, setCat] = useState('Todas')
  const [selectedStageId, setSelectedStageId] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const categories = state.categories || []
  const { rows, stages } = buildEnduroRanking(state, cat, selectedStageId)
  const isOverall = selectedStageId === 'all'

  // Só leva medalha/posição quem tem resultado válido
  const hasResult = (row: EnduroRankRow) =>
    isOverall
      ? row.completedCount > 0 && !row.hasDnf
      : row.stagePerformances[selectedStageId]?.status === 'done'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={
          <Button variant="outlined" color="inherit" startIcon={<IosShareRoundedIcon />} onClick={() => setExportOpen(true)} sx={{ flexShrink: 0 }}>
            Exportar
          </Button>
        }
      />

      <StickyBar>
        <ChipSelect
          ariaLabel="Especial"
          value={selectedStageId}
          onChange={(v) => {
            setSelectedStageId(v)
            setExpanded(null)
          }}
          options={[{ value: 'all', label: 'Geral' }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
        />
        {categories.length > 1 && (
          <ChipSelect
            ariaLabel="Categoria"
            value={cat}
            onChange={setCat}
            options={[{ value: 'Todas', label: 'Todas' }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
        )}
      </StickyBar>

      {rows.length === 0 ? (
        <EmptyState icon={<EmojiEventsRoundedIcon />} title="Sem atletas nesta categoria" />
      ) : (
        <ListCard>
          {rows.map((row, i) => {
            const open = expanded === row.rider.num
            const ranked = hasResult(row)
            return (
              <Box key={row.rider.num}>
                <ButtonBase
                  onClick={() => setExpanded(open ? null : row.rider.num)}
                  aria-expanded={open}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    pl: 1.5,
                    pr: 1,
                    py: 1.25,
                    minHeight: 64,
                    textAlign: 'left',
                  }}
                >
                  {ranked ? <Position pos={i + 1} /> : <Box sx={{ width: 32, flexShrink: 0 }} />}
                  <RiderPlate num={row.rider.num} size="sm" tone="muted" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800 }}>
                      {row.rider.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {row.rider.cat}
                      {isOverall && ` · ${row.completedCount}/${stages.length} esp.`}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <MainResult row={row} stageId={selectedStageId} isFirst={i === 0} />
                  </Box>
                  <ExpandMoreRoundedIcon
                    sx={{ color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </ButtonBase>

                <Collapse in={open} unmountOnExit>
                  <Box sx={{ bgcolor: tokens.bg, px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {stages.map((st) => {
                      const perf = row.stagePerformances[st.id]
                      return (
                        <Box key={st.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 32 }}>
                          <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: st.id === selectedStageId ? 800 : 500 }}>
                            {st.name}
                          </Typography>
                          {perf?.status === 'done' && perf.time != null ? (
                            <>
                              <Typography variant="caption" sx={{ ...tabular, color: podium[(perf.stageRank ?? 0) - 1] ?? 'text.secondary', fontWeight: 800, width: 28, textAlign: 'right' }}>
                                {perf.stageRank}º
                              </Typography>
                              <Typography sx={{ ...tabular, fontWeight: 800, width: 76, textAlign: 'right' }}>{fmt(perf.time)}</Typography>
                              <Typography variant="caption" sx={{ ...tabular, color: 'warning.main', width: 72, textAlign: 'right' }}>
                                {perf.stageRank === 1 || perf.stageGap == null ? '' : `+${fmt(perf.stageGap)}`}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="caption" color={perf?.status === 'dnf' ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                              {perf?.status === 'dnf' ? 'DNF' : perf?.status === 'track' ? 'Na pista' : 'Não largou'}
                            </Typography>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                </Collapse>
              </Box>
            )
          })}
        </ListCard>
      )}

      <Typography variant="caption" color="text.secondary">
        Classificação geral pela soma das especiais concluídas. Quem completou mais especiais fica à frente.
      </Typography>

      <ExportReport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        state={state}
        initialStageId={selectedStageId}
        initialCategory={cat}
      />
    </Box>
  )
}
