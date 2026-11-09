import type { AppState, Stage } from '../types'
import type { EnduroRankRow, StagePerformance } from '../lib/ranking'
import { fmt } from '../lib/time'
import { isOut, outLabel, penaltyText } from '../lib/runs'
import { stageOutlier } from '../lib/outlier'
import { stageLabel } from '../lib/report'
import { tabular, tint, tokens } from '../theme'
import { Box, ButtonBase, Typography } from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

interface Props {
  state: AppState
  rows: EnduroRankRow[]
  stages: Stage[]
  /** Organizador: tocar numa célula abre as correções. */
  onCell?: (num: string, stageId: string, perf: StagePerformance) => void
  /** Equipe da prova: marca os tempos fora da curva. */
  staff?: boolean
}

/** Matriz de resultados: um atleta por linha, uma especial por coluna, o total no fim. */
export function ResultsMatrix({ state, rows, stages, onCell, staff = false }: Props) {
  const cols = `minmax(140px, 1.6fr) repeat(${stages.length}, minmax(86px, 1fr)) minmax(92px, 1fr)`
  const head = { ...tabular, fontWeight: 800, fontSize: '0.8rem', color: 'text.secondary', px: 1, py: 0.75 }
  return (
    <Box sx={{ overflowX: 'auto', mx: -2, px: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: cols, minWidth: 140 + stages.length * 86 + 92, border: `1px solid ${tokens.line}` }}>
        <Typography sx={head}>Atleta</Typography>
        {stages.map((st) => (
          <Typography key={st.id} sx={{ ...head, textAlign: 'right', borderLeft: `3px solid ${st.color ?? 'transparent'}` }} title={st.name}>
            {stageLabel(st)}
          </Typography>
        ))}
        <Typography sx={{ ...head, textAlign: 'right' }}>Total</Typography>

        {rows.map((row, i) => (
          <Box key={row.rider.num} sx={{ display: 'contents' }}>
            <Box sx={{ px: 1, py: 0.75, borderTop: `1px solid ${tokens.line}`, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {row.completedCount > 0 && !row.hasDnf ? `${i + 1}º ` : ''}#{row.rider.num} {row.rider.name}
              </Typography>
            </Box>
            {stages.map((st) => {
              const perf = row.stagePerformances[st.id]
              const outlier = staff && perf?.status === 'done' ? stageOutlier(state, row.rider.num, st.id, perf.time) : null
              const cell = (
                <Box sx={{ textAlign: 'right', width: '100%' }}>
                  <Typography
                    sx={{
                      ...tabular,
                      fontSize: '0.9rem',
                      fontWeight: perf?.stageRank === 1 ? 900 : 600,
                      color: isOut(perf?.status) ? 'error.main' : perf?.stageRank === 1 ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {perf?.status === 'done' && perf.time != null ? fmt(perf.time) : isOut(perf?.status) ? outLabel(perf.status as 'dnf') : perf?.status === 'track' ? 'pista' : '—'}
                  </Typography>
                  {(perf?.penaltyMs || outlier) && (
                    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'warning.main', fontWeight: 700 }}>
                      {outlier && <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />}
                      {penaltyText(perf?.penaltyMs)}
                    </Typography>
                  )}
                </Box>
              )
              return (
                <Box key={st.id} sx={{ borderTop: `1px solid ${tokens.line}`, display: 'flex' }}>
                  {onCell && perf ? (
                    <ButtonBase
                      onClick={() => onCell(row.rider.num, st.id, perf)}
                      aria-label={`Corrigir #${row.rider.num} na ${st.name}`}
                      sx={{ flex: 1, px: 1, py: 0.75, '&:hover': { bgcolor: tint(tokens.brand, 0.08) } }}
                    >
                      {cell}
                    </ButtonBase>
                  ) : (
                    <Box sx={{ flex: 1, px: 1, py: 0.75 }}>{cell}</Box>
                  )}
                </Box>
              )
            })}
            <Box sx={{ px: 1, py: 0.75, borderTop: `1px solid ${tokens.line}`, textAlign: 'right' }}>
              <Typography sx={{ ...tabular, fontSize: '0.9rem', fontWeight: 900, color: row.hasDnf ? 'error.main' : 'text.primary' }}>
                {row.outStatus ? outLabel(row.outStatus) : row.completedCount > 0 ? fmt(row.totalTime) : '—'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/** Painel da prova: uma barra por especial com concluídos, na pista, fora e quem ainda falta. */
export function StagePanel({ rows, stages }: { rows: EnduroRankRow[]; stages: Stage[] }) {
  const total = rows.length
  if (total === 0) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {stages.map((st) => {
        const count = { done: 0, track: 0, out: 0 }
        rows.forEach((r) => {
          const s = r.stagePerformances[st.id]?.status
          if (s === 'done') count.done++
          else if (s === 'track') count.track++
          else if (isOut(s)) count.out++
        })
        const rest = total - count.done - count.track - count.out
        const seg = (n: number, color: string) => (n > 0 ? <Box sx={{ flex: n, bgcolor: color }} /> : null)
        const km = st.km ? ` · ${st.km.toLocaleString('pt-BR')} km` : ''
        return (
          <Box key={st.id}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
                {st.name}
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  {km}
                </Box>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ...tabular, flexShrink: 0 }}>
                {count.done} chegaram · {count.track} na pista · {count.out} fora · {rest} faltam
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', height: 10, mt: 0.5, bgcolor: tokens.raised, borderLeft: `3px solid ${st.color ?? tokens.lineStrong}` }}>
              {seg(count.done, tokens.start)}
              {seg(count.track, tokens.brand)}
              {seg(count.out, tokens.finish)}
              {seg(rest, tokens.raised)}
            </Box>
          </Box>
        )
      })}
      <Typography variant="caption" color="text.secondary">
        Verde: chegaram · amarelo: na pista · vermelho: DNF, DNS ou DSQ · cinza: faltam
      </Typography>
    </Box>
  )
}
