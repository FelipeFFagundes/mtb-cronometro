import { useEffect, useState, type ChangeEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, TvImage } from '../types'
import { radius, tokens } from '../theme'
import { EmptyState } from './ui'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'

/**
 * Imagens do telão (patrocinadores, mapa da trilha, avisos): aparecem em rodízio nas TVs
 * ligadas com o painel "Imagens". As fotos são reduzidas antes de enviar.
 */
export function TvImages({ state, act }: { state: AppState; act: Act }) {
  const [images, setImages] = useState<TvImage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(String(state.tvImageSeconds ?? 10))

  const load = () => void api.listTvImages().then(setImages).catch(() => setImages([]))
  useEffect(load, [state.event?.id])

  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    await act(async () => {
      for (const f of files) await api.addTvImage(f)
    }, files.length === 1 ? 'Imagem enviada' : `${files.length} imagens enviadas`)
    setBusy(false)
    load()
  }

  const remove = async (id: string) => {
    await act(() => api.removeTvImage(id), 'Imagem removida')
    load()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Patrocinadores, mapa da trilha, avisos: as imagens passam em rodízio nas TVs ligadas com o painel <b>Imagens do telão</b>{' '}
        (Eventos → Divulgar → Ligar uma TV).
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button component="label" variant="contained" startIcon={<AddPhotoAlternateRoundedIcon />} disabled={busy} sx={{ flex: 1 }}>
          {busy ? 'Enviando…' : 'Adicionar imagens'}
          <input hidden type="file" accept="image/*" multiple onChange={(e) => void add(e)} />
        </Button>
        <TextField
          size="small"
          label="Segundos cada"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={() => {
            const n = Number(seconds)
            if (n && n !== state.tvImageSeconds) void act(() => api.setTvImageSeconds(n), `Cada imagem fica ${Math.min(60, Math.max(3, n))} s na tela`)
          }}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          sx={{ width: 120 }}
        />
      </Box>
      {images && images.length === 0 ? (
        <EmptyState icon={<CollectionsRoundedIcon />} title="Nenhuma imagem" text="Adicione fotos do celular. Elas são reduzidas antes de enviar." />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
          {(images ?? []).map((img, i) => (
            <Box key={img.id} sx={{ position: 'relative', borderRadius: radius.md, overflow: 'hidden', border: `1px solid ${tokens.line}`, aspectRatio: '16 / 9', bgcolor: tokens.raised }}>
              <Box component="img" src={img.url} alt={`Imagem ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              <IconButton
                aria-label={`Remover imagem ${i + 1}`}
                onClick={() => void remove(img.id)}
                size="small"
                sx={{ position: 'absolute', top: 4, right: 4, bgcolor: tokens.bg, '&:hover': { bgcolor: tokens.raised } }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
