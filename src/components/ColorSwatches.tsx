import { radius, tokens } from '../theme'
import { Box, ButtonBase, Typography } from '@mui/material'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'

/** Cores de especiais e categorias: tons de trilha que se distinguem bem entre si e do amarelo do app. */
const TRAIL_COLORS = ['#16a34a', '#0ea5e9', '#a16207', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#64748b']

/** Escolha de uma cor (ou nenhuma). */
export function ColorSwatches({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Box role="radiogroup" aria-label={label} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <ButtonBase
          role="radio"
          aria-checked={!value}
          aria-label="Sem cor"
          onClick={() => onChange('')}
          sx={{ width: 36, height: 36, borderRadius: radius.sm, border: `2px solid ${!value ? tokens.brand : tokens.lineStrong}`, color: 'text.secondary' }}
        >
          <BlockRoundedIcon fontSize="small" />
        </ButtonBase>
        {TRAIL_COLORS.map((c) => (
          <ButtonBase
            key={c}
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            onClick={() => onChange(c)}
            sx={{ width: 36, height: 36, borderRadius: radius.sm, bgcolor: c, outline: value === c ? `3px solid ${tokens.brand}` : 'none', outlineOffset: 2 }}
          />
        ))}
      </Box>
    </Box>
  )
}
