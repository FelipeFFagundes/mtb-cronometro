import { useEffect, useState } from 'react'
import { Dialog, Typography, Button, Box, IconButton } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { radius, tabular, tokens } from '../theme'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

const MAX_PIN = 8

export function AdminLogin({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  // PIN configurável via VITE_ADMIN_PIN (padrão: 1234). Só esconde a interface: ver docs/ARQUITETURA.md
  const expectedPin = (import.meta.env.VITE_ADMIN_PIN as string | undefined) || '1234'

  const submit = (value = pin) => {
    if (!value) return
    if (value.trim() === expectedPin.trim()) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      navigator.vibrate?.([100, 50, 100])
    }
  }

  const press = (digit: string) => {
    setError(false)
    setPin((prev) => (prev.length < MAX_PIN ? prev + digit : prev))
  }

  const erase = () => {
    setError(false)
    setPin((prev) => prev.slice(0, -1))
  }

  // Teclado físico (desktop / tablet com teclado)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') erase()
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keyStyle = {
    ...tabular,
    minHeight: 64,
    fontSize: '1.9rem',
    fontWeight: 700,
    color: 'text.primary',
    bgcolor: tokens.surface,
    border: `1px solid ${tokens.line}`,
    borderRadius: radius.md,
    '&:hover': { bgcolor: tokens.surface },
    '&:active': { bgcolor: 'rgba(255, 214, 10, 0.15)' },
  }

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <Box sx={{ p: 3, textAlign: 'center', position: 'relative' }}>
        <IconButton onClick={onCancel} aria-label="Fechar" sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}>
          <CloseRoundedIcon />
        </IconButton>

        <LockOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
          Modo fiscal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Digite o PIN da prova
        </Typography>

        {/* Indicador do PIN */}
        <Box
          role="status"
          aria-label={`${pin.length} dígitos digitados`}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1.5,
            my: 3,
            minHeight: 16,
            animation: error ? 'shake 0.3s ease-in-out' : 'none',
          }}
        >
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 14,
                height: 14,
                borderRadius: radius.pill,
                border: `2px solid ${error ? tokens.finish : tokens.lineStrong}`,
                bgcolor: i < pin.length ? 'primary.main' : 'transparent',
                borderColor: i < pin.length ? 'primary.main' : undefined,
              }}
            />
          ))}
        </Box>
        <Typography variant="body2" color="error.main" sx={{ minHeight: 20, mt: -1.5, mb: 1.5, fontWeight: 700 }}>
          {error ? 'PIN incorreto' : ''}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Button key={d} onClick={() => press(d)} sx={keyStyle}>
              {d}
            </Button>
          ))}
          <Button onClick={erase} aria-label="Apagar dígito" sx={{ ...keyStyle, color: 'text.secondary' }}>
            <BackspaceOutlinedIcon />
          </Button>
          <Button onClick={() => press('0')} sx={keyStyle}>
            0
          </Button>
          <Button
            onClick={() => submit()}
            disabled={pin.length === 0}
            variant="contained"
            aria-label="Entrar"
            sx={{ minHeight: 64, borderRadius: radius.md }}
          >
            <ArrowForwardRoundedIcon />
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}
