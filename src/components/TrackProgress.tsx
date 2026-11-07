import type { AppState } from '../types'
import { DEFAULT_STAGES } from '../types'
import { shortTime, trackRiders, type TrackRider, type TrackState } from '../lib/progress'
import { useNow } from '../hooks/useNow'
import { display, radius, tabular, tint, tokens } from '../theme'
import { Box, Typography } from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

const markerColor: Record<TrackState, { bg: string; fg: string }> = {
  rel: { bg: tokens.raised, fg: tokens.text },
  normal: { bg: tokens.brand, fg: tokens.brandInk },
  near: { bg: tokens.finish, fg: tokens.finishInk },
  over: { bg: tokens.finish, fg: tokens.finishInk },
  late: { bg: tokens.warn, fg: tokens.mode === 'light' ? '#ffffff' : '#1f0d00' },
}

interface Props {
  state: AppState
  /** Só uma especial (padrão: todas com gente descendo). */
  stageId?: string
  /** Tamanho de TV: placas e textos maiores. */
  big?: boolean
}

/**
 * Pista de cada especial com as placas de quem está descendo, andando da largada à chegada
 * pelo tempo de referência (mediana das chegadas). Vermelho: chegando; laranja: atrasado.
 */
export function TrackProgress({ state, stageId, big = false }: Props) {
  const now = useNow(500)
  const stages = state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const groups = trackRiders({ ...state, stages }, now).filter((g) => !stageId || stageId === 'all' || g.stageId === stageId)
  if (groups.length === 0) return null

  const plateH = big ? 40 : 26
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: big ? 2.5 : 1.5 }}>
      {groups.map((g) => {
        const stage = stages.find((s) => s.id === g.stageId)
        // Até 3 faixas, para as placas próximas não se cobrirem
        const lanes = Math.min(3, g.riders.length)
        return (
          <Box key={g.stageId} component="section" aria-label={`Progresso na ${stage?.name ?? 'especial'}`}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
              <Typography noWrap sx={{ ...display, fontWeight: 800, fontSize: big ? '1.6rem' : '1rem', minWidth: 0 }}>
                {stage?.name ?? 'Especial'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: big ? '1rem' : undefined, flexShrink: 0 }}>
                {g.ref ? `referência ${shortTime(g.ref)} (mediana)` : 'sem chegadas ainda · posição relativa'}
              </Typography>
            </Box>
            <Box
              role="img"
              aria-label={g.riders.map((r) => `#${r.run.num} ${Math.round(r.progress * 100)}%`).join(', ')}
              sx={{
                position: 'relative',
                height: lanes * (plateH + 6) + 10,
                bgcolor: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderLeft: `3px solid ${tokens.start}`,
                borderRight: `3px solid ${tokens.finish}`,
                borderRadius: radius.sm,
                overflow: 'hidden',
              }}
            >
              {[0.25, 0.5, 0.75].map((x) => (
                <Box key={x} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${x * 100}%`, borderLeft: `1px dashed ${tokens.line}` }} />
              ))}
              {g.riders.map((r, i) => (
                <Marker key={r.run.id} rider={r} lane={i % lanes} plateH={plateH} big={big} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
              {['Largada', '½', 'Chegada'].map((t) => (
                <Typography key={t} variant="caption" color="text.secondary" sx={{ fontSize: big ? '0.95rem' : '0.7rem' }}>
                  {t}
                </Typography>
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function Marker({ rider, lane, plateH, big }: { rider: TrackRider; lane: number; plateH: number; big: boolean }) {
  const c = markerColor[rider.state]
  return (
    <Box
      title={`#${rider.run.num} · ${shortTime(rider.elapsed)}`}
      sx={{
        ...tabular,
        position: 'absolute',
        top: 5 + lane * (plateH + 6),
        // A placa anda dentro da pista: em 0% fica encostada na largada, em 100% na chegada
        left: `calc(${rider.progress * 100}% - ${rider.progress * (big ? 64 : 42)}px)`,
        minWidth: big ? 64 : 42,
        height: plateH,
        px: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        borderRadius: radius.sm,
        bgcolor: c.bg,
        color: c.fg,
        border: rider.state === 'rel' ? `1px solid ${tokens.lineStrong}` : 'none',
        fontWeight: 900,
        fontSize: big ? '1.5rem' : '1rem',
        lineHeight: 1,
        transition: 'left 0.5s linear',
        animation: rider.state === 'late' ? 'pulse 1.2s infinite' : 'none',
      }}
    >
      {rider.state === 'late' && <WarningAmberRoundedIcon sx={{ fontSize: big ? 22 : 14 }} />}
      {rider.run.num}
    </Box>
  )
}

/** Aviso de segurança: quem passou muito do tempo de referência (pode ter caído). */
export function LateAlert({ state, big = false }: { state: AppState; big?: boolean }) {
  const now = useNow(1000)
  const stages = state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const late = trackRiders({ ...state, stages }, now).flatMap((g) => g.riders.filter((r) => r.state === 'late'))
  if (late.length === 0) return null
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        gap: 1.5,
        p: big ? 2 : 1.5,
        borderRadius: radius.md,
        bgcolor: tint(tokens.warn, 0.12),
        border: `1px solid ${tint(tokens.warn, 0.5)}`,
      }}
    >
      <WarningAmberRoundedIcon sx={{ color: 'warning.main', fontSize: big ? 36 : 24 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: big ? '1.4rem' : undefined }}>Bem acima do tempo de referência</Typography>
        {late.map((r) => {
          const name = state.riders.find((x) => x.num === r.run.num)?.name ?? `Piloto #${r.run.num}`
          return (
            <Typography key={r.run.id} variant="body2" sx={{ fontSize: big ? '1.1rem' : undefined }}>
              #{r.run.num} {name}: {shortTime(r.elapsed)} na pista, referência {shortTime(r.ref ?? 0)}
            </Typography>
          )
        })}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: big ? '0.95rem' : undefined }}>
          Confirme com o staff ou o resgate antes de marcar DNF.
        </Typography>
      </Box>
    </Box>
  )
}
