import { useEffect, useState } from 'react'
import { api } from '../data'
import type { AppState, AthleteEntry } from '../types'
import { buildEnduroRanking } from '../lib/ranking'
import { fmt } from '../lib/time'
import { formatEventDate } from '../lib/events'
import { isOut, outDescription, outLabel, penaltyText } from '../lib/runs'
import { display, radius, tabular, tokens } from '../theme'
import { EmptyState, ListCard, RiderPlate, Section, StatStrip } from './ui'
import { ShareAthlete } from './ShareAthlete'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded'

/** km/h a partir da distância da especial e do tempo (sem a penalidade). */
const kmh = (km: number | undefined, ms: number | null) => (km && ms ? `${((km / ms) * 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/h` : '')

/**
 * Página pública do atleta no evento: posição na categoria, cada especial (tempo, posição,
 * diferença e velocidade) e os outros eventos de que ele participou.
 */
export function AthletePage({ state, num, onBack }: { state: AppState; num: string; onBack: () => void }) {
  const rider = state.riders.find((r) => r.num === num)
  const [history, setHistory] = useState<AthleteEntry[]>([])
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (!rider?.athleteId) return
    let alive = true
    api
      .getAthleteHistory(rider.athleteId)
      .then((h) => alive && setHistory(h.filter((e) => e.eventId !== state.event?.id)))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [rider?.athleteId, state.event?.id])

  if (!rider) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }} color="inherit">
          Voltar
        </Button>
        <EmptyState icon={<PersonOffRoundedIcon />} title={`Placa #${num} não encontrada`} text="Confira o número ou volte aos resultados." />
      </Box>
    )
  }

  const { rows, stages } = buildEnduroRanking(state, rider.cat, 'all')
  const ranked = rows.filter((r) => r.completedCount > 0 && !r.hasDnf)
  const row = rows.find((r) => r.rider.num === num)
  const pos = ranked.findIndex((r) => r.rider.num === num) + 1
  const leader = ranked[0]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }} color="inherit">
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <RiderPlate num={rider.num} size="lg" />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ ...display, fontWeight: 800, fontSize: '2rem', lineHeight: 1.05 }}>
            {rider.name}
          </Typography>
          <Typography color="text.secondary">{[rider.cat, rider.team].filter(Boolean).join(' · ')}</Typography>
        </Box>
      </Box>

      <StatStrip
        items={[
          { label: 'Posição', value: pos > 0 ? pos : 0 },
          { label: 'Atletas', value: rows.length },
          { label: 'Especiais', value: row?.completedCount ?? 0 },
        ]}
      />
      <Box sx={{ p: 2, borderRadius: radius.md, border: `1px solid ${tokens.line}`, bgcolor: 'background.paper' }}>
        <Typography variant="overline" color="text.secondary">
          Tempo total
        </Typography>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '2.4rem', lineHeight: 1 }}>
          {row?.outStatus ? outLabel(row.outStatus) : pos > 0 && row ? fmt(row.totalTime) : '—'}
        </Typography>
        <Typography color={row && leader && row === leader ? 'primary.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
          {row?.outStatus
            ? outDescription[row.outStatus]
            : !row || pos === 0
              ? 'Ainda sem tempo'
              : row === leader
                ? 'Líder da categoria'
                : row.completedCount === leader.completedCount
                  ? `+${fmt(row.totalGap)} do líder`
                  : `${row.completedCount}/${stages.length} especiais`}
        </Typography>
      </Box>

      <Section title="Especiais">
        <ListCard>
          {stages.map((st) => {
            const perf = row?.stagePerformances[st.id]
            const done = perf?.status === 'done' && perf.time != null
            const raw = done ? perf.time! - perf.penaltyMs : null
            return (
              <Box key={st.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderLeft: `4px solid ${st.color ?? 'transparent'}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700 }}>
                    {st.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {done
                      ? [perf.stageRank ? `${perf.stageRank}º da categoria` : '', perf.stageRank === 1 ? 'melhor tempo' : perf.stageGap ? `+${fmt(perf.stageGap)}` : '', kmh(st.km, raw)]
                          .filter(Boolean)
                          .join(' · ')
                      : isOut(perf?.status)
                        ? outDescription[perf.status as 'dnf']
                        : perf?.status === 'track'
                          ? 'Na pista agora'
                          : 'Ainda não largou'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ ...tabular, fontWeight: 900, color: isOut(perf?.status) ? 'error.main' : perf?.stageRank === 1 ? 'primary.main' : 'text.primary' }}>
                    {done ? fmt(perf.time!) : isOut(perf?.status) ? outLabel(perf.status as 'dnf') : '—'}
                  </Typography>
                  {done && perf.penaltyMs > 0 && (
                    <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                      {penaltyText(perf.penaltyMs)} de penalidade
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </ListCard>
      </Section>

      <Button variant="contained" startIcon={<ImageRoundedIcon />} onClick={() => setShareOpen(true)}>
        Imagem para compartilhar
      </Button>

      {history.length > 0 && (
        <Section title="Outros eventos" count={history.length}>
          <ListCard>
            {history.map((h) => (
              <Box key={`${h.eventId}-${h.num}`} sx={{ px: 2, py: 1.25 }}>
                <Typography noWrap sx={{ fontWeight: 700 }}>
                  {h.eventName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[formatEventDate(h.startsOn), h.category, `#${h.num}`].join(' · ')}
                </Typography>
              </Box>
            ))}
          </ListCard>
        </Section>
      )}

      <ShareAthlete state={state} num={shareOpen ? num : null} onClose={() => setShareOpen(false)} />
    </Box>
  )
}
