import type { AppState, Run } from '../types'
import { referenceTime, shortTime, trackState } from '../lib/progress'
import { runTime } from '../lib/runs'
import { useNow } from '../hooks/useNow'
import { Typography } from '@mui/material'

/** "chega em ~0:12" ou "+0:05 da referência", pelo tempo de referência da especial. */
export function EtaHint({ state, run }: { state: AppState; run: Run }) {
  const now = useNow(1000)
  const ref = referenceTime(state, run)
  if (!ref) return null
  const elapsed = now - run.start
  const rest = ref.ms - elapsed
  const st = trackState(elapsed, ref.ms)
  return (
    <Typography
      variant="caption"
      sx={{ fontWeight: 700, color: st === 'late' ? 'warning.main' : st === 'normal' ? 'text.secondary' : 'error.main', lineHeight: 1.2 }}
    >
      {rest >= 0 ? `chega em ~${shortTime(rest)}` : `+${shortTime(-rest)} da referência`}
    </Typography>
  )
}

/** Melhor tempo da categoria do piloto nesta especial (o tempo a bater), com quem fez. */
function bestInCategory(state: AppState, run: Run): { ms: number; num: string } | null {
  const cat = state.riders.find((r) => r.num === run.num)?.cat
  let best: { ms: number; num: string } | null = null
  for (const r of state.runs) {
    if (r.stageId !== run.stageId || r.id === run.id) continue
    if (state.riders.find((x) => x.num === r.num)?.cat !== cat) continue
    const t = runTime(r)
    if (t != null && (!best || t < best.ms)) best = { ms: t, num: r.num }
  }
  return best
}

/** "a bater 0:18 · #3" enquanto ainda dá para fazer o melhor tempo da categoria; depois, quanto passou. */
export function BeatHint({ state, run }: { state: AppState; run: Run }) {
  const now = useNow(1000)
  const best = bestInCategory(state, run)
  if (!best) return null
  const rest = best.ms - (now - run.start)
  return (
    <Typography variant="caption" sx={{ fontWeight: 700, color: rest >= 0 ? 'primary.main' : 'text.secondary', lineHeight: 1.2 }}>
      {rest >= 0 ? `a bater ${shortTime(rest)} · #${best.num}` : `+${shortTime(-rest)} do melhor (#${best.num})`}
    </Typography>
  )
}
