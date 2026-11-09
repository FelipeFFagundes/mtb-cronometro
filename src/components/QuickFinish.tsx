import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { clock } from '../lib/time'
import { radius, tabular, tokens } from '../theme'
import { BottomSheet, RiderPlate } from './ui'
import { Box, Button, ButtonBase, IconButton, TextField, Typography } from '@mui/material'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { uuid } from '../lib/uuid'

/** Uma passagem pela chegada: o instante é gravado no toque; a placa vem depois. */
interface Crossing {
  id: string
  at: number
  num: string
}

interface Props {
  open: boolean
  onClose: () => void
  state: AppState
  act: Act
  /** Especial da chegada (undefined = a de cada piloto). */
  stageId?: string
}

/**
 * Chegada rápida: para quando chegam vários juntos ou o piloto não aparece em "Na pista"
 * (a largada ainda não sincronizou). O toque em CRUZOU grava o horário; a placa é digitada depois.
 * Sem a largada no aparelho, a chegada fica guardada e vale quando a largada chegar ao servidor.
 */
export function QuickFinish({ open, onClose, state, act, stageId }: Props) {
  const [crossings, setCrossings] = useState<Crossing[]>([])

  const cross = () => {
    navigator.vibrate?.(40)
    setCrossings((c) => [{ id: uuid(), at: Date.now() + api.getClockOffset(), num: '' }, ...c])
  }

  const setNum = (id: string, num: string) =>
    setCrossings((c) => c.map((x) => (x.id === id ? { ...x, num: num.replace(/\D/g, '').slice(0, 4) } : x)))

  const remove = (id: string) => setCrossings((c) => c.filter((x) => x.id !== id))

  const confirm = async (x: Crossing) => {
    const rider = state.riders.find((r) => r.num === x.num)
    if (!rider) {
      await act(async () => {
        throw new Error(`Placa #${x.num} não cadastrada`)
      })
      return
    }
    const ok = await act(() => api.finishRun(x.num, x.at, stageId, true).then(() => undefined), `#${x.num} ${rider.name}: chegada às ${clock(x.at)}`)
    if (ok) remove(x.id)
  }

  // Sugestões: quem está na pista (o primeiro a largar costuma chegar primeiro)
  const onTrack = state.runs
    .filter((r) => r.status === 'track' && (!stageId || r.stageId === stageId))
    .sort((a, b) => a.start - b.start)
    .slice(0, 8)

  return (
    <BottomSheet open={open} onClose={onClose} title="Chegada rápida">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Toque em <b>CRUZOU</b> no instante em que cada piloto passa a linha. Depois digite a placa de cada passagem e confirme.
      </Typography>
      <Button
        fullWidth
        size="large"
        variant="contained"
        color="error"
        startIcon={<SportsScoreRoundedIcon />}
        onClick={cross}
        sx={{ minHeight: 72, fontSize: '1.4rem', fontWeight: 900, mb: 2 }}
      >
        CRUZOU
      </Button>

      {crossings.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          Nenhuma passagem gravada ainda.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {crossings.map((x) => {
            const rider = state.riders.find((r) => r.num === x.num)
            return (
              <Box key={x.id} sx={{ p: 1.5, borderRadius: radius.md, border: `1px solid ${tokens.lineStrong}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '1.4rem' }}>{clock(x.at)}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconButton aria-label="Descartar passagem" onClick={() => remove(x.id)} size="small">
                    <CloseRoundedIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="Placa"
                    value={x.num}
                    onChange={(e) => setNum(x.id, e.target.value)}
                    slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                    sx={{ width: 110 }}
                  />
                  <Typography variant="body2" noWrap color={rider ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0 }}>
                    {x.num ? (rider ? rider.name : 'placa não cadastrada') : 'digite ou toque numa sugestão'}
                  </Typography>
                  <Button variant="contained" color="error" disabled={!rider} onClick={() => void confirm(x)}>
                    Confirmar
                  </Button>
                </Box>
                {!x.num && onTrack.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {onTrack.map((r) => (
                      <ButtonBase key={r.id} onClick={() => setNum(x.id, r.num)} aria-label={`Placa ${r.num}`}>
                        <RiderPlate num={r.num} size="sm" tone="muted" />
                      </ButtonBase>
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </BottomSheet>
  )
}
