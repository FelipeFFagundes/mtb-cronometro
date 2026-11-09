import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import type { StagePerformance } from '../lib/ranking'
import { fmt } from '../lib/time'
import { isOut, outDescription, outLabel, penaltyText } from '../lib/runs'
import { outlierText, stageOutlier } from '../lib/outlier'
import { BottomSheet } from './ui'
import { Alert, Box, Button, Typography } from '@mui/material'

export interface RunActionTarget {
  num: string
  stageId: string
  perf: StagePerformance
}

/**
 * Correções da organização numa descida: penalidade, DSQ, voltar a valer e DNS.
 * Abre pela matriz de resultados ou pelo ⋯ da especial no ranking.
 */
export function RunActions({ target, onClose, state, act }: { target: RunActionTarget | null; onClose: () => void; state: AppState; act: Act }) {
  const rider = target ? state.riders.find((r) => r.num === target.num) : undefined
  const stage = target ? state.stages.find((s) => s.id === target.stageId) : undefined
  const perf = target?.perf
  const run = perf?.runId ? state.runs.find((r) => r.id === perf.runId) : undefined
  const who = rider ? `#${rider.num} ${rider.name}` : ''

  const run_ = (fn: () => Promise<unknown>, msg: string) => {
    onClose()
    void act(fn, msg)
  }
  const outlier = target && perf?.status === 'done' ? stageOutlier(state, target.num, target.stageId, perf.time) : null
  const penalty = run?.penaltyMs ?? 0

  return (
    <BottomSheet open={Boolean(target)} onClose={onClose} title={who ? `${who} · ${stage?.name ?? ''}` : undefined}>
      {target && perf && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography color="text.secondary">
            {perf.status === 'done' && perf.time != null
              ? `Tempo: ${fmt(perf.time)}${penalty ? ` (com ${penaltyText(penalty)} de penalidade)` : ''}`
              : isOut(perf.status)
                ? `${outLabel(perf.status)}: ${outDescription[perf.status]}`
                : perf.status === 'track'
                  ? 'Na pista agora.'
                  : 'Sem descida nesta especial.'}
          </Typography>
          {outlier && <Alert severity="warning">{outlierText(outlier)}</Alert>}

          {perf.status === 'done' && run && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Button variant="outlined" color="warning" onClick={() => run_(() => api.setPenalty(run.id, penalty + 10_000), `${who}: +10s de penalidade`)}>
                  +10s
                </Button>
                <Button variant="outlined" color="warning" onClick={() => run_(() => api.setPenalty(run.id, penalty + 30_000), `${who}: +30s de penalidade`)}>
                  +30s
                </Button>
              </Box>
              {penalty > 0 && (
                <Button variant="outlined" color="inherit" onClick={() => run_(() => api.setPenalty(run.id, 0), `${who}: penalidade retirada`)}>
                  Tirar a penalidade ({penaltyText(penalty)})
                </Button>
              )}
              <Button variant="outlined" color="error" onClick={() => run_(() => api.setRunStatus(run.id, 'dsq'), `${who}: DSQ na ${stage?.name ?? 'especial'}`)}>
                Desclassificar (DSQ)
              </Button>
            </>
          )}
          {perf.status === 'dsq' && run && (
            <Button variant="contained" onClick={() => run_(() => api.setRunStatus(run.id, 'done'), `${who}: a descida volta a valer`)}>
              Voltar a valer
            </Button>
          )}
          {perf.status === 'none' && (
            <Button variant="outlined" color="error" onClick={() => run_(() => api.markDns(target.num, target.stageId), `${who}: DNS na ${stage?.name ?? 'especial'}`)}>
              Não largou (DNS)
            </Button>
          )}
          {(perf.status === 'dns' || perf.status === 'dnf') && run && (
            <Button variant="outlined" color="inherit" onClick={() => run_(() => api.undoRun(run.id), `${who}: ${outLabel(perf.status as 'dns' | 'dnf')} apagado`)}>
              Apagar o {outLabel(perf.status)} (volta para a fila)
            </Button>
          )}
          <Typography variant="caption" color="text.secondary">
            Tudo fica no histórico de alterações, com quem fez e quando.
          </Typography>
        </Box>
      )}
    </BottomSheet>
  )
}
