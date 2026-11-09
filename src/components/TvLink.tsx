import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { EventInfo, TvPanel } from '../types'
import { Box, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material'
import TvRoundedIcon from '@mui/icons-material/TvRounded'

const PANELS: { id: TvPanel; label: string }[] = [
  { id: 'track', label: 'Na pista (tempos ao vivo)' },
  { id: 'progress', label: 'Progresso na pista' },
  { id: 'standings', label: 'Classificação por categoria' },
  { id: 'images', label: 'Imagens do telão (patrocinadores, mapa)' },
]

const ZOOMS = [75, 90, 100, 110, 125, 150]

/** Liga uma TV pareada a este evento e escolhe o que ela mostra (dá para trocar depois, de longe). */
export function TvLink({ event, act }: { event: EventInfo; act: Act }) {
  const [code, setCode] = useState('')
  const [panels, setPanels] = useState<TvPanel[]>(['track', 'progress', 'standings'])
  const [zoom, setZoom] = useState(100)

  const toggle = (p: TvPanel) => setPanels((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  const valid = /^\d{6}$/.test(code) && panels.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'left' }}>
      <Typography variant="overline" color="text.secondary">
        Ligar uma TV
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Na TV, abra o app e toque em <b>Esta tela é uma TV</b> (ou o endereço <b>#/tv</b>). Digite aqui o código que ela mostrar.
      </Typography>
      <TextField
        label="Código da TV"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
        placeholder="123456"
      />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {PANELS.map((p) => (
          <FormControlLabel key={p.id} control={<Checkbox checked={panels.includes(p.id)} onChange={() => toggle(p.id)} />} label={p.label} />
        ))}
      </Box>
      <TextField select label="Tamanho na tela" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} slotProps={{ select: { native: true } }}>
        {ZOOMS.map((z) => (
          <option key={z} value={z}>
            {z === 100 ? 'Automático (100%)' : `${z}%`}
          </option>
        ))}
      </TextField>
      <Button
        variant="contained"
        startIcon={<TvRoundedIcon />}
        disabled={!valid}
        onClick={() => void act(() => api.tvLink(code, event.id, panels, zoom), `TV ${code} mostrando ${event.name}`)}
      >
        Ligar a TV a este evento
      </Button>
      <Typography variant="caption" color="text.secondary">
        Para mudar o que a TV mostra, ligue de novo com o mesmo código.
      </Typography>
    </Box>
  )
}
