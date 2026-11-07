import { useEffect, useState } from 'react'
import type { AppState } from '../types'
import { buildAthleteCard, CARD_FORMATS, CARD_LAYOUTS, renderAthleteCard, type CardFormat, type CardLayout } from '../lib/athleteCard'
import { saveOrShare } from '../lib/report'
import { PALETTES, PALETTE_INFO, paletteId, radius, tokens, type PaletteId } from '../theme'
import { BottomSheet, ChipSelect } from './ui'
import { Box, Button, ButtonBase, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'

interface Props {
  state: AppState
  /** Placa do atleta; null fecha. */
  num: string | null
  onClose: () => void
}

/** Card do atleta para compartilhar: prévia, formato e a opção sem fundo (para pôr sobre uma foto). */
export function ShareAthlete({ state, num, onClose }: Props) {
  const [format, setFormat] = useState<CardFormat>('story')
  const [layout, setLayout] = useState<CardLayout>('completo')
  // Começa no tema do app; trocar aqui muda só a imagem
  const [colors, setColors] = useState<PaletteId>(paletteId)
  const [transparent, setTransparent] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)

  const card = num ? buildAthleteCard(state, num) : null
  // O card muda quando chega um tempo novo; a prévia acompanha
  const cardKey = card ? JSON.stringify(card) : ''

  useEffect(() => {
    if (!card) return
    let alive = true
    let url = ''
    renderAthleteCard(card, { format, layout, palette: PALETTES[colors], transparent })
      .then((blob) => {
        url = URL.createObjectURL(blob)
        if (alive) {
          setImage({ blob, url })
          setError('')
        } else URL.revokeObjectURL(url)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Não foi possível gerar a imagem'))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // cardKey resume o card (o objeto é recriado a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, format, layout, colors, transparent])

  const share = async () => {
    if (!image || !card) return
    setSharing(true)
    try {
      await saveOrShare(image.blob, card.fileName, `${card.name} · ${card.event}`)
    } finally {
      setSharing(false)
    }
  }

  // Ao fechar, some a prévia: o próximo atleta não abre com a imagem do anterior
  const close = () => {
    setImage(null)
    onClose()
  }

  const f = CARD_FORMATS.find((x) => x.id === format)!
  return (
    <BottomSheet open={Boolean(num)} onClose={close} title={card ? `Imagem · ${card.name}` : 'Imagem'}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ChipSelect
          ariaLabel="Modelo"
          value={layout}
          onChange={(v) => setLayout(v as CardLayout)}
          options={CARD_LAYOUTS.map((x) => ({ value: x.id, label: x.label }))}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          {CARD_LAYOUTS.find((x) => x.id === layout)?.text}
        </Typography>
        <Box role="radiogroup" aria-label="Cores da imagem" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {PALETTE_INFO.map((t) => {
            const pal = PALETTES[t.id]
            const selected = t.id === colors
            return (
              <ButtonBase
                key={t.id}
                role="radio"
                aria-checked={selected}
                aria-label={t.name}
                title={t.name}
                onClick={() => setColors(t.id)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  p: 0.75,
                  borderRadius: radius.sm,
                  border: `1.5px solid ${selected ? tokens.brand : tokens.line}`,
                }}
              >
                <Box sx={{ display: 'flex', border: `1px solid ${tokens.lineStrong}` }}>
                  {[pal.bg, pal.brand, pal.text].map((c, i) => (
                    <Box key={i} sx={{ width: 12, height: 24, bgcolor: c }} />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: selected ? 800 : 500, lineHeight: 1 }}>
                  {t.name}
                </Typography>
              </ButtonBase>
            )
          })}
        </Box>
        <ChipSelect
          ariaLabel="Formato"
          value={format}
          onChange={(v) => setFormat(v as CardFormat)}
          options={CARD_FORMATS.map((x) => ({ value: x.id, label: x.label }))}
        />
        <FormControlLabel
          control={<Switch checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />}
          label={
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Sem fundo</Typography>
              <Typography variant="caption" color="text.secondary">
                PNG transparente para pôr por cima de uma foto do atleta
              </Typography>
            </Box>
          }
          sx={{ mx: 0, alignItems: 'center', gap: 1 }}
        />
        <Box
          sx={{
            position: 'relative',
            mx: 'auto',
            width: '100%',
            maxWidth: format === 'story' ? 260 : 420,
            aspectRatio: `${f.w} / ${f.h}`,
            borderRadius: radius.md,
            overflow: 'hidden',
            border: `1px solid ${tokens.lineStrong}`,
            // Xadrez atrás da prévia sem fundo, como nos editores de imagem
            background: transparent
              ? `repeating-conic-gradient(${tokens.raised} 0% 25%, ${tokens.surface} 0% 50%) 50% / 20px 20px`
              : tokens.surface,
          }}
        >
          {image ? (
            <Box component="img" src={image.url} alt={`Prévia ${f.label}`} sx={{ width: '100%', height: '100%', display: 'block' }} />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
        </Box>
        {error && (
          <Typography variant="body2" color="error.main">
            {error}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          {f.w} × {f.h} px · cores {PALETTE_INFO.find((t) => t.id === colors)?.name}
        </Typography>
        <Button variant="contained" size="large" startIcon={<IosShareRoundedIcon />} disabled={!image || sharing} onClick={() => void share()}>
          Compartilhar
        </Button>
      </Box>
    </BottomSheet>
  )
}
