import type { ReactNode } from 'react'
import { Box, Button, Card, Chip, Dialog, IconButton, Skeleton, SwipeableDrawer, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { TOPBAR_H, look, radius, tabular, tokens } from '../theme'
import { useBackClose } from '../hooks/useBackClose'

/* Peças de interface compartilhadas pelas telas. */

type Tone = 'brand' | 'start' | 'finish' | 'muted' | 'warn'

const toneColors: Record<Tone, { bg: string; fg: string; border: string }> = {
  brand: { bg: tokens.brand, fg: tokens.brandInk, border: tokens.brand },
  start: { bg: tokens.start, fg: tokens.startInk, border: tokens.start },
  finish: { bg: tokens.finish, fg: '#fff', border: tokens.finish },
  warn: { bg: 'rgba(251, 146, 60, 0.15)', fg: tokens.warn, border: 'rgba(251, 146, 60, 0.4)' },
  muted: { bg: tokens.raised, fg: tokens.text, border: tokens.lineStrong },
}

const plateSizes = {
  sm: { minWidth: 36, height: 28, fontSize: '1rem' },
  md: { minWidth: 48, height: 36, fontSize: '1.3rem' },
  lg: { minWidth: 64, height: 48, fontSize: '1.8rem' },
  xl: { minWidth: 112, height: 80, fontSize: '3.6rem' },
}

/** Placa de número do piloto, no estilo das placas de guidão. */
export function RiderPlate({ num, size = 'md', tone = 'brand' }: { num: string; size?: keyof typeof plateSizes; tone?: Tone }) {
  const c = toneColors[tone]
  const s = plateSizes[size]
  return (
    <Box
      aria-label={`Placa ${num}`}
      sx={{
        ...s,
        ...tabular,
        px: size === 'xl' ? 2 : 0.75,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size === 'xl' ? radius.md : radius.sm,
        bgcolor: c.bg,
        color: c.fg,
        border: `2px solid ${c.border}`,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {num}
    </Box>
  )
}

export interface ChipOption {
  value: string
  label: string
  count?: number
}

/** Linha de chips com rolagem horizontal: seleção única, sem quebrar a tela no celular. */
export function ChipSelect({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={ariaLabel}
      className="no-scrollbar"
      sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: -2, px: 2, py: 0.25 }}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <Chip
            key={o.value}
            role="radio"
            aria-checked={selected}
            label={o.count != null ? `${o.label} · ${o.count}` : o.label}
            onClick={() => onChange(o.value)}
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            sx={{
              flexShrink: 0,
              height: 36,
              px: 0.5,
              fontSize: '0.875rem',
              borderColor: selected ? undefined : tokens.lineStrong,
            }}
          />
        )
      })}
    </Box>
  )
}

/** Área que gruda logo abaixo da barra superior (filtros da tela). */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: TOPBAR_H,
        zIndex: 5,
        mx: -2,
        px: 2,
        py: 1.25,
        bgcolor: 'rgba(10, 10, 11, 0.92)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {children}
    </Box>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
      <Box
        sx={{
          minWidth: 0,
          // No visual angular, o título ganha uma barra amarela à esquerda
          ...(look.accentBar && { borderLeft: `4px solid ${tokens.brand}`, pl: 1.5 }),
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontSize: look.accentBar ? '2.1rem' : '1.75rem', lineHeight: 1 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {right}
    </Box>
  )
}

export function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, minHeight: 32 }}>
        <Typography variant="overline" component="h2" color="text.secondary">
          {title}
          {count != null && (
            <Box component="span" sx={{ color: 'text.primary', ml: 0.75 }}>
              {count}
            </Box>
          )}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  )
}

/** Card com linhas separadas por divisória (listas densas). */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <Card sx={{ overflow: 'hidden', '& > * + *': { borderTop: `1px solid ${tokens.line}` } }}>{children}</Card>
  )
}

export function EmptyState({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return (
    <Card sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
      {icon && <Box sx={{ color: 'text.secondary', mb: 1, '& svg': { fontSize: 32 } }}>{icon}</Box>}
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {text && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {text}
        </Typography>
      )}
    </Card>
  )
}

/** Painel que sobe da parte de baixo da tela (ações ao alcance do polegar). */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useBackClose(open, onClose)
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // Arrastar para baixo fecha; abrir só pelos botões
      onOpen={() => undefined}
      disableSwipeToOpen
      disableDiscovery
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.raised,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            ...(look.accentBar && { borderTop: `3px solid ${tokens.brand}` }),
            border: `1px solid ${tokens.line}`,
            borderBottom: 0,
            maxWidth: 600,
            mx: 'auto',
            maxHeight: '92dvh',
            px: 2,
            pt: 1,
            pb: 'calc(16px + env(safe-area-inset-bottom))',
          },
        },
      }}
    >
      <Box sx={{ width: 40, height: 4, borderRadius: radius.pill, bgcolor: tokens.lineStrong, mx: 'auto', mb: 1.5 }} />
      {title && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <IconButton onClick={onClose} aria-label="Fechar" edge="end">
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      )}
      {children}
    </SwipeableDrawer>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = 'error',
  icon,
  confirmDisabled = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children?: ReactNode
  confirmLabel: string
  tone?: 'error' | 'warning' | 'primary'
  icon?: ReactNode
  /** Mantém o botão de confirmar desligado (ex.: até digitar uma confirmação). */
  confirmDisabled?: boolean
}) {
  useBackClose(open, onClose)
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ p: 3, pb: 2.5 }}>
        {icon && (
          <Box sx={{ color: `${tone}.main`, mb: 1.5, '& svg': { fontSize: 36 } }}>{icon}</Box>
        )}
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
          {title}
        </Typography>
        <Box sx={{ color: 'text.secondary', typography: 'body2' }}>{children}</Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
          <Button variant="outlined" color="inherit" fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="contained" color={tone} fullWidth onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

/** Tempo com números alinhados. */
export function Time({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box component="span" sx={{ ...tabular, fontWeight: 800, ...sx }}>
      {children}
    </Box>
  )
}

/** Formato da tela enquanto os dados carregam (título, filtros e lista), sem pular o layout quando chegam. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  const bone = { bgcolor: tokens.raised, borderRadius: radius.sm }
  return (
    <Box role="status" aria-label="Carregando dados da prova" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ ...(look.accentBar && { borderLeft: `4px solid ${tokens.lineStrong}`, pl: 1.5 }) }}>
        <Skeleton variant="rectangular" animation="wave" width="55%" height={34} sx={bone} />
        <Skeleton variant="rectangular" animation="wave" width="35%" height={16} sx={{ ...bone, mt: 1 }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[72, 96, 96].map((w, i) => (
          <Skeleton key={i} variant="rectangular" animation="wave" width={w} height={36} sx={bone} />
        ))}
      </Box>
      <Card sx={{ overflow: 'hidden' }}>
        {Array.from({ length: rows }, (_, i) => (
          <Box
            key={i}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, minHeight: 60, borderTop: i ? `1px solid ${tokens.line}` : 0 }}
          >
            <Skeleton variant="rectangular" animation="wave" width={48} height={36} sx={bone} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="rectangular" animation="wave" width={`${60 - (i % 3) * 12}%`} height={16} sx={bone} />
              <Skeleton variant="rectangular" animation="wave" width="30%" height={12} sx={{ ...bone, mt: 0.75 }} />
            </Box>
            <Skeleton variant="rectangular" animation="wave" width={64} height={20} sx={bone} />
          </Box>
        ))}
      </Card>
    </Box>
  )
}

/** Dica de atalho de teclado; só aparece em aparelhos com mouse (computador). */
export function Kbd({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box
      component="kbd"
      aria-hidden
      sx={{
        display: 'none',
        '@media (hover: hover) and (pointer: fine)': { display: 'inline-flex' },
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        px: 0.75,
        borderRadius: radius.sm,
        border: '1px solid currentColor',
        opacity: 0.7,
        fontFamily: 'inherit',
        fontSize: '0.75rem',
        fontWeight: 700,
        lineHeight: 1,
        textTransform: 'none',
        letterSpacing: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}
