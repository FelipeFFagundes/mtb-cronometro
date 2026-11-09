import { useEffect, useState, type ReactNode } from 'react'
import { CARD_FORMATS, type CardFormat } from '../lib/athleteCard'
import { saveOrShare } from '../lib/report'
import { PALETTES, PALETTE_INFO, paletteId, radius, tokens, type Palette, type PaletteId } from '../theme'
import { BottomSheet, ChipSelect } from './ui'
import { Box, Button, ButtonBase, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'

export interface ImageOptions {
  format: CardFormat
  palette: Palette
  transparent: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  /** Controles próprios (modelo, categoria...) acima das cores. */
  children?: ReactNode
  /** Desenha a imagem com as opções escolhidas. */
  render: (opts: ImageOptions) => Promise<Blob>
  /** Muda quando o conteúdo muda (refaz a prévia). */
  renderKey: string
  fileName: string
  shareTitle: string
}

/** Prévia e compartilhamento de uma imagem: cores de qualquer tema, formato e opção sem fundo. */
export function ImageSheet({ open, onClose, title, children, render, renderKey, fileName, shareTitle }: Props) {
  const [format, setFormat] = useState<CardFormat>('story')
  // Começa no tema do app; trocar aqui muda só a imagem
  const [colors, setColors] = useState<PaletteId>(paletteId)
  const [transparent, setTransparent] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    let url = ''
    render({ format, palette: PALETTES[colors], transparent })
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
    // renderKey resume o conteúdo (a função render é recriada a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey, format, colors, transparent])

  const share = async () => {
    if (!image) return
    setSharing(true)
    try {
      await saveOrShare(image.blob, fileName, shareTitle)
    } finally {
      setSharing(false)
    }
  }

  // Ao fechar, some a prévia: a próxima imagem não abre com a anterior
  const close = () => {
    setImage(null)
    onClose()
  }

  const f = CARD_FORMATS.find((x) => x.id === format)!
  return (
    <BottomSheet open={open} onClose={close} title={title}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
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
                PNG transparente para pôr por cima de uma foto
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
