import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Dialog, IconButton, Tab, Tabs, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { radius, tabular, tokens } from '../theme'
import { useBackClose } from '../hooks/useBackClose'
import { api } from '../data'

interface Props {
  onSuccess: () => void
  onCancel: () => void
  /** Aba aberta primeiro (Supabase). */
  defaultTab?: 'fiscal' | 'organizador'
}

const MAX_PIN = 8

/** Entrada do fiscal: código do evento (Supabase) ou PIN do aparelho (modo local). */
export function AdminLogin(props: Props) {
  useBackClose(true, props.onCancel)
  return api.mode === 'supabase' ? <CodeLogin {...props} /> : <PinLogin {...props} />
}

/** Modo local (sem servidor): PIN conferido no aparelho, configurável via VITE_ADMIN_PIN (padrão 1234). */
function PinLogin({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const submit = async (value = pin) => {
    if (!value) return
    try {
      await api.joinWithCode(value)
      onSuccess()
    } catch {
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
      else if (e.key === 'Enter') void submit()
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
            onClick={() => void submit()}
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

/** Formata o código enquanto digita: só letras e números, em maiúsculas, como "7KQ-4M2". */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6)
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean
}

/** Supabase: fiscal entra com o código do evento; organizador, com e-mail e senha. */
function CodeLogin({ onSuccess, onCancel, defaultTab = 'fiscal' }: Props) {
  const [tab, setTab] = useState<'fiscal' | 'organizador'>(defaultTab)
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (e: FormEvent, action: () => Promise<void>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await action()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar')
      navigator.vibrate?.([100, 50, 100])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <Box sx={{ p: 3, position: 'relative' }}>
        <IconButton onClick={onCancel} aria-label="Fechar" sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}>
          <CloseRoundedIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <LockOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
            Entrar
          </Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v: 'fiscal' | 'organizador') => {
            setTab(v)
            setError('')
          }}
          variant="fullWidth"
          sx={{ my: 2, borderBottom: `1px solid ${tokens.line}` }}
        >
          <Tab value="fiscal" label="Fiscal" />
          <Tab value="organizador" label="Organizador" />
        </Tabs>

        {tab === 'fiscal' ? (
          <Box component="form" onSubmit={(e) => void run(e, () => api.joinWithCode(code))} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Digite o código do fiscal que o organizador passou. Precisa de internet só agora; depois funciona sem sinal.
            </Typography>
            <TextField
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="ABC-123"
              autoFocus
              fullWidth
              slotProps={{
                htmlInput: {
                  'aria-label': 'Código do fiscal',
                  autoCapitalize: 'characters',
                  autoComplete: 'off',
                  spellCheck: false,
                  enterKeyHint: 'go',
                  style: { ...tabular, textAlign: 'center', fontSize: '2rem', letterSpacing: '0.15em', fontWeight: 800 },
                },
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy || code.replace('-', '').length < 6}>
              {busy ? 'Conferindo…' : 'Entrar como fiscal'}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={(e) => void run(e, () => api.signIn(email, password))} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              fullWidth
              required
            />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              required
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar como organizador'}
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
