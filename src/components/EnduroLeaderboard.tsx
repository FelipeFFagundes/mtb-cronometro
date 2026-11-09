import { useEffect, useState } from 'react'
import type { Act } from '../App'
import type { AppState, SyncStatus } from '../types'
import { buildEnduroRanking, type EnduroRankRow } from '../lib/ranking'
import { isOut, outDescription, outLabel, penaltyText } from '../lib/runs'
import { outlierText, stageOutlier } from '../lib/outlier'
import { RunActions, type RunActionTarget } from './RunActions'
import { ResultsMatrix, StagePanel } from './ResultsMatrix'
import { fmt } from '../lib/time'
import { rankingStats, statItems } from '../lib/report'
import { radius, tabular, tokens } from '../theme'
import { ChipSelect, EmptyState, ListCard, PageHeader, RiderPlate, StatStrip, StickyBar } from './ui'
import { SyncStamp } from './SyncBanner'
import { ExportReport } from './ExportReport'
import { ShareAthlete, ShareEvent } from './ShareAthlete'
import { Box, Button, ButtonBase, Chip, Collapse, IconButton, Tooltip, Typography } from '@mui/material'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'

interface Props {
  state: AppState
  title?: string
  subtitle?: string
  /** Mostra quando os dados foram atualizados pela última vez. */
  sync?: SyncStatus
  /** Organizador: penalidades, DSQ e DNS pela matriz e pelo ⋯ de cada especial. */
  act?: Act
  canEdit?: boolean
  /** Equipe da prova (fiscal ou organizador): painel e alertas de tempo fora da curva. */
  staff?: boolean
  /** Abre a página pública do atleta. */
  onOpenAthlete?: (num: string) => void
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
        color: color ? (tokens.mode === 'light' ? '#ffffff' : '#000000') : 'text.secondary',
        bgcolor: color ?? 'transparent',
      }}
    >
      {pos}
    </Box>
  )
}

/** Resultado principal da linha: tempo total (geral) ou tempo da especial. */
function MainResult({ row, stageId, isFirst, leader }: { row: EnduroRankRow; stageId: string; isFirst: boolean; leader?: EnduroRankRow }) {
  if (stageId === 'all') {
    if (row.outStatus) return <Chip label={outLabel(row.outStatus)} size="small" color="error" title={outDescription[row.outStatus]} />
    if (row.completedCount === 0) return <Typography variant="body2" color="text.secondary">—</Typography>
    return (
      <>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>{fmt(row.totalTime)}</Typography>
        <Typography sx={{ ...tabular, fontSize: '0.75rem', fontWeight: 700, color: isFirst ? 'primary.main' : 'text.secondary' }}>
          {isFirst
            ? 'Líder'
            : leader && row.completedCount !== leader.completedCount
              ? // Menos especiais concluídas: a diferença de tempo não compara
                `${row.completedCount}/${row.totalStagesCount} esp.`
              : `+${fmt(row.totalGap)}`}
        </Typography>
      </>
    )
  }
  const perf = row.stagePerformances[stageId]
  if (perf?.status === 'done' && perf.time != null) {
    return (
      <>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>{fmt(perf.time)}</Typography>
        <Typography sx={{ ...tabular, fontSize: '0.75rem', fontWeight: 700, color: isFirst ? 'primary.main' : 'text.secondary' }}>
          {isFirst || perf.stageGap == null ? 'Melhor' : `+${fmt(perf.stageGap)}`}
        </Typography>
      </>
    )
  }
  if (isOut(perf?.status)) return <Chip label={outLabel(perf.status as 'dnf')} size="small" color="error" />
  if (perf?.status === 'track') return <Chip label="Na pista" size="small" color="warning" variant="outlined" />
  return <Typography variant="body2" color="text.secondary">—</Typography>
}

export function EnduroLeaderboard({ state, title = 'Classificação', subtitle, sync, act, canEdit = false, staff = false, onOpenAthlete }: Props) {
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
  const [shareNum, setShareNum] = useState<string | null>(null)
  const [standingsImage, setStandingsImage] = useState(false)
  const [mode, setMode] = useState<'list' | 'matrix'>('list')
  const [fix, setFix] = useState<RunActionTarget | null>(null)

  const categories = state.categories || []
  const { rows, stages } = buildEnduroRanking(state, cat, selectedStageId)
  const isOverall = selectedStageId === 'all'

  // Tempos para conferir (só para a equipe da prova)
  const outliers = staff
    ? rows.flatMap((r) => stages.filter((st) => stageOutlier(state, r.rider.num, st.id, r.stagePerformances[st.id]?.time ?? null)))
    : []

  // Só leva medalha/posição quem tem resultado válido
  const hasResult = (row: EnduroRankRow) =>
    isOverall
      ? row.completedCount > 0 && !row.hasDnf
      : row.stagePerformances[selectedStageId]?.status === 'done'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader
        title={title}
        subtitle={
          sync ? (
            <>
              {subtitle && `${subtitle} · `}
              <SyncStamp sync={sync} />
            </>
          ) : (
            subtitle
          )
        }
        right={
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <IconButton aria-label="Imagem da classificação para redes sociais" onClick={() => setStandingsImage(true)} sx={{ border: `1px solid ${tokens.lineStrong}` }}>
              <ImageRoundedIcon />
            </IconButton>
            <Button variant="outlined" color="inherit" startIcon={<IosShareRoundedIcon />} onClick={() => setExportOpen(true)}>
              Exportar
            </Button>
          </Box>
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

      {rows.length > 0 && <StatStrip items={statItems(rankingStats(rows, selectedStageId))} />}

      {staff && rows.length > 0 && <StagePanel rows={rows} stages={stages} />}

      {staff && outliers.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
          <WarningAmberRoundedIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {outliers.length === 1 ? '1 tempo fora da curva' : `${outliers.length} tempos fora da curva`}: confira os marcados com ⚠
          </Typography>
        </Box>
      )}

      {stages.length > 0 && rows.length > 0 && (
        <ChipSelect
          ariaLabel="Forma de ver"
          value={mode}
          onChange={(v) => setMode(v as 'list' | 'matrix')}
          options={[
            { value: 'list', label: 'Lista' },
            { value: 'matrix', label: canEdit ? 'Matriz (corrigir)' : 'Matriz' },
          ]}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<EmojiEventsRoundedIcon />} title="Sem atletas nesta categoria" />
      ) : mode === 'matrix' ? (
        <ResultsMatrix state={state} rows={rows} stages={stages} staff={staff} onCell={canEdit ? (num, stageId, perf) => setFix({ num, stageId, perf }) : undefined} />
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
                    // Linha aberta: a mesma linha amarela fina que marca as seleções
                    boxShadow: open ? `inset 2px 0 0 ${tokens.brand}` : 'none',
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
                      {row.rider.team && ` · ${row.rider.team}`}
                      {isOverall && ` · ${row.completedCount}/${stages.length} esp.`}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <MainResult row={row} stageId={selectedStageId} isFirst={i === 0} leader={rows[0]} />
                  </Box>
                  <ExpandMoreRoundedIcon
                    sx={{ color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </ButtonBase>

                <Collapse in={open} unmountOnExit>
                  <Box sx={{ bgcolor: tokens.bg, px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {stages.map((st) => {
                      const perf = row.stagePerformances[st.id]
                      const outlier = staff && perf?.status === 'done' ? stageOutlier(state, row.rider.num, st.id, perf.time) : null
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
                              {outlier && (
                                <Tooltip title={outlierText(outlier)}>
                                  <WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} aria-label={outlierText(outlier)} />
                                </Tooltip>
                              )}
                              <Typography sx={{ ...tabular, fontWeight: 800, width: 76, textAlign: 'right' }}>{fmt(perf.time)}</Typography>
                              <Typography variant="caption" sx={{ ...tabular, color: perf.penaltyMs ? 'warning.main' : 'text.secondary', width: 72, textAlign: 'right' }}>
                                {perf.penaltyMs ? penaltyText(perf.penaltyMs) : perf.stageRank === 1 || perf.stageGap == null ? '' : `+${fmt(perf.stageGap)}`}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="caption" color={isOut(perf?.status) ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 700 }} title={isOut(perf?.status) ? outDescription[perf.status as 'dnf'] : undefined}>
                              {isOut(perf?.status) ? outLabel(perf.status as 'dnf') : perf?.status === 'track' ? 'Na pista' : 'Não largou'}
                            </Typography>
                          )}
                          {canEdit && perf && (
                            <IconButton size="small" aria-label={`Corrigir #${row.rider.num} na ${st.name}`} onClick={() => setFix({ num: row.rider.num, stageId: st.id, perf })} sx={{ color: 'text.secondary', minWidth: 32, minHeight: 32 }}>
                              <MoreHorizRoundedIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      )
                    })}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Button variant="outlined" color="inherit" size="small" startIcon={<ImageRoundedIcon />} onClick={() => setShareNum(row.rider.num)}>
                        Imagem do atleta
                      </Button>
                      {onOpenAthlete && (
                        <Button variant="outlined" color="inherit" size="small" startIcon={<PersonRoundedIcon />} onClick={() => onOpenAthlete(row.rider.num)}>
                          Página do atleta
                        </Button>
                      )}
                    </Box>
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

      <ShareAthlete state={state} num={shareNum} onClose={() => setShareNum(null)} />
      {standingsImage && <ShareEvent state={state} kind="standings" open onClose={() => setStandingsImage(false)} initialCategory={cat} />}
      {act && <RunActions target={fix} onClose={() => setFix(null)} state={state} act={act} />}

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
