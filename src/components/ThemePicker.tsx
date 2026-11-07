import { PALETTES, PALETTE_INFO, paletteId, radius, setPalette, tokens } from '../theme'
import { BottomSheet } from './ui'
import { Box, ButtonBase, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

/** Amostra das cores principais de um tema (fundo, cartão, destaque, largada, chegada). */
function Swatches({ id }: { id: keyof typeof PALETTES }) {
  const p = PALETTES[id]
  return (
    <Box sx={{ display: 'flex', flexShrink: 0, border: `1px solid ${tokens.lineStrong}` }}>
      {[p.bg, p.raised, p.brand, p.start, p.finish].map((c, i) => (
        <Box key={i} sx={{ width: 14, height: 36, bgcolor: c }} />
      ))}
    </Box>
  )
}

/** Escolha do tema de cores deste aparelho. Trocar recarrega a página. */
export function ThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Tema">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Vale só para este aparelho. A tela recarrega para aplicar as cores; nada do que foi registrado se perde.
      </Typography>
      <Box role="radiogroup" aria-label="Tema" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {PALETTE_INFO.map((t) => {
          const selected = t.id === paletteId
          return (
            <ButtonBase
              key={t.id}
              role="radio"
              aria-checked={selected}
              onClick={() => (selected ? onClose() : setPalette(t.id))}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                textAlign: 'left',
                borderRadius: radius.md,
                border: `1.5px solid ${selected ? tokens.brand : tokens.line}`,
              }}
            >
              <Swatches id={t.id} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>{t.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                  {t.text}
                </Typography>
              </Box>
              {selected && <CheckCircleRoundedIcon sx={{ color: 'primary.main' }} />}
            </ButtonBase>
          )
        })}
      </Box>
    </BottomSheet>
  )
}
