import type { AppState, Run } from '../types'
import { referenceTime, shortTime, trackState } from '../lib/progress'
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
