import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  Typography,
  Button,
  Box,
  Alert,
  IconButton,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export function AdminLogin({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  // PIN configurável via variável de ambiente VITE_ADMIN_PIN (padrão: 1234)
  const expectedPin = (import.meta.env.VITE_ADMIN_PIN as string | undefined) || '1234'

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (pin.trim() === expectedPin.trim()) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    }
  }

  const handleKeyClick = (val: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + val)
      setError(false)
    }
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
    setError(false)
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            p: 2,
            textAlign: 'center',
            position: 'relative',
          },
        },
      }}
    >
      <IconButton
        onClick={onCancel}
        aria-label="fechar"
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: 'text.secondary',
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      <DialogContent sx={{ pt: 3, pb: 1, px: { xs: 1, sm: 2 } }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            bgcolor: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'primary.main',
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 32 }} />
        </Box>

        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 800 }}>
          Área Restrita
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Digite o PIN de acesso de Fiscal / ADM
        </Typography>

        <form onSubmit={handleSubmit}>
          {/* Display do PIN */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              letterSpacing: '0.4em',
              fontSize: '2rem',
              fontWeight: 800,
              minHeight: 56,
              bgcolor: 'background.default',
              borderRadius: 3,
              border: '2px solid',
              borderColor: error ? 'error.main' : 'rgba(255, 255, 255, 0.15)',
              mb: 2,
              px: 2,
              userSelect: 'none',
            }}
          >
            {pin ? '•'.repeat(pin.length) : (
              <Typography variant="body1" sx={{ color: 'text.secondary', opacity: 0.5, letterSpacing: 'normal' }}>
                Digite o PIN
              </Typography>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, py: 0.5, borderRadius: 2 }}>
              PIN incorreto. Tente novamente.
            </Alert>
          )}

          {/* Teclado Numérico Touch Mobile */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
              mb: 3,
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <Button
                key={digit}
                type="button"
                variant="outlined"
                onClick={() => handleKeyClick(digit)}
                sx={{
                  py: 1.8,
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(56, 189, 248, 0.08)',
                  },
                }}
              >
                {digit}
              </Button>
            ))}

            <Button
              type="button"
              variant="outlined"
              onClick={handleDelete}
              aria-label="Apagar dígito"
              sx={{
                py: 1.8,
                color: 'warning.main',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <BackspaceOutlinedIcon />
            </Button>

            <Button
              type="button"
              variant="outlined"
              onClick={() => handleKeyClick('0')}
              sx={{
                py: 1.8,
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'text.primary',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              0
            </Button>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={pin.length === 0}
              aria-label="Entrar"
              sx={{
                py: 1.8,
              }}
            >
              <ArrowForwardRoundedIcon />
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              type="button"
              variant="outlined"
              fullWidth
              color="inherit"
              onClick={onCancel}
              sx={{ py: 1.2 }}
            >
              Voltar aos Resultados
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={pin.length === 0}
              sx={{ py: 1.2 }}
            >
              Entrar
            </Button>
          </Box>
        </form>
      </DialogContent>
    </Dialog>
  )
}
