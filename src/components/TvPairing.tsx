import { useEffect, useState } from 'react'
import { api } from '../data'
import type { AppState, SyncStatus, TvImage, TvScreen } from '../types'
import { display, logoSx, tabular, tokens } from '../theme'
import { TvMode } from './TvMode'
import { Box, Typography } from '@mui/material'

const DEVICE_KEY = 'mtb-tv-device-v1'

/** Código de 6 dígitos desta TV (fica salvo: a TV reabre já pareada). */
function deviceCode(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (saved && /^\d{6}$/.test(saved)) return saved
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
    localStorage.setItem(DEVICE_KEY, code)
    return code
  } catch {
    return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
  }
}

/**
 * TV pareada: mostra um código; o organizador digita o código no celular (Divulgar → Ligar uma TV)
 * e escolhe o evento e o que a TV exibe. Dá para trocar tudo de longe, sem mexer na TV.
 */
export function TvPairing({ state, sync, loading }: { state: AppState; sync: SyncStatus; loading: boolean }) {
  const [code] = useState(deviceCode)
  const [tv, setTv] = useState<TvScreen | null>(null)
  const [error, setError] = useState('')
  const [images, setImages] = useState<TvImage[]>([])

  useEffect(() => {
    const register = () =>
      api
        .tvRegister(code)
        .then((t) => {
          setTv(t)
          setError('')
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sem conexão com o servidor'))
    void register()
    // Avisa que a TV continua ligada e confere a configuração de minuto em minuto
    const id = setInterval(register, 60_000)
    const stop = api.watchTv(code, setTv)
    return () => {
      clearInterval(id)
      stop()
    }
  }, [code])

  // Evento escolhido pelo organizador: a TV passa a mostrar os dados dele
  const eventId = tv?.eventId ?? null
  useEffect(() => {
    if (eventId && state.event?.id !== eventId) void api.selectEvent(eventId)
  }, [eventId, state.event?.id])

  const wantsImages = Boolean(tv?.panels.includes('images'))
  const ready = Boolean(eventId && state.event?.id === eventId && !loading)
  useEffect(() => {
    if (!ready || !wantsImages) return
    const load = () => void api.listTvImages().then(setImages).catch(() => undefined)
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [ready, wantsImages])

  if (ready && tv) return <TvMode state={state} sync={sync} panels={tv.panels} zoom={tv.scale} images={images} />

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: tokens.bg,
        color: tokens.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box component="img" src="/logo.png" alt="SPET" sx={{ height: 'min(12vh, 96px)', width: 'auto', ...logoSx }} />
      <Typography sx={{ ...display, fontWeight: 800, fontSize: 'min(5vw, 3rem)', textTransform: 'uppercase' }}>Modo TV</Typography>
      <Typography sx={{ color: tokens.muted, fontSize: 'min(3vw, 1.5rem)', maxWidth: 900 }}>
        No celular do organizador: <b>Eventos → Divulgar → Ligar uma TV</b> e digite o código abaixo.
      </Typography>
      <Box sx={{ ...tabular, fontWeight: 900, fontSize: 'min(16vw, 12rem)', letterSpacing: '0.12em', color: tokens.brand, lineHeight: 1 }}>
        {code.slice(0, 3)} {code.slice(3)}
      </Box>
      <Typography sx={{ color: error ? tokens.finish : tokens.muted, fontSize: 'min(2.4vw, 1.2rem)' }}>
        {error || (tv?.eventId ? 'Carregando o evento…' : 'Aguardando o organizador ligar esta TV a um evento')}
      </Typography>
    </Box>
  )
}
