import { useState } from 'react'
import { api } from '../data'
import type { PendingOp, SyncStatus } from '../types'
import { clock } from '../lib/time'
import { useNow } from '../hooks/useNow'
import { radius, tabular, tokens } from '../theme'
import { BottomSheet } from './ui'
import { Box, Button, IconButton, Typography } from '@mui/material'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

interface Props {
  sync: SyncStatus
  pending: PendingOp[]
}

/** "há 8 s", "há 3 min". */
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 5) return 'agora'
  if (s < 60) return `há ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`
}

/**
 * Quando foi o último contato com o servidor ("Sincronizado há 8 s"). Online, o app busca
 * os dados a cada 15 s, então um número alto aqui avisa que algo travou antes do indicador.
 */
export function SyncStamp({ sync }: { sync: SyncStatus }) {
  const now = useNow(1000)
  if (api.mode !== 'supabase') return <>Salvo neste aparelho</>
  const last = sync.lastOk != null ? ` · último contato ${ago(now - sync.lastOk)}` : ''
  if (!sync.online) {
    return (
      <Box component="span" sx={{ color: 'warning.main' }}>
        Offline{sync.pending > 0 ? ` · ${sync.pending} ${sync.pending === 1 ? 'guardado' : 'guardados'}` : ''}
        {last}
      </Box>
    )
  }
  if (sync.syncing || sync.pending > 0) return <>Enviando {sync.pending > 0 ? `${sync.pending} ` : ''}…</>
  if (sync.lastOk == null) return <>Conectando…</>
  return <>Sincronizado {ago(now - sync.lastOk)}</>
}

/** Faixa que aparece quando está sem conexão ou há ações aguardando envio. */
export function SyncBanner({ sync, pending }: Props) {
  const [openDetails, setOpenDetails] = useState(false)

  if (sync.online && pending.length === 0) return null

  const isOffline = !sync.online
  const n = pending.length
  const title = isOffline ? 'Sem conexão' : 'Enviando registros'
  const text = n
    ? `${n} ${n === 1 ? 'registro guardado' : 'registros guardados'} no aparelho`
    : 'Os registros serão guardados e enviados ao reconectar'

  return (
    <>
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: radius.md,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: isOffline ? 'rgba(251, 146, 60, 0.12)' : 'rgba(96, 165, 250, 0.12)',
          border: `1px solid ${isOffline ? 'rgba(251, 146, 60, 0.4)' : 'rgba(96, 165, 250, 0.4)'}`,
        }}
      >
        <Box sx={{ color: isOffline ? 'warning.main' : 'info.main', display: 'flex' }}>
          {isOffline ? <CloudOffRoundedIcon /> : <CloudSyncRoundedIcon sx={{ animation: 'spin 1.5s linear infinite' }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.3 }}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {text}
          </Typography>
        </Box>
        {n > 0 && (
          <Button size="small" variant="outlined" color="inherit" onClick={() => setOpenDetails(true)} sx={{ flexShrink: 0 }}>
            Ver fila
          </Button>
        )}
      </Box>

      <BottomSheet open={openDetails && n > 0} onClose={() => setOpenDetails(false)} title="Fila de envio">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {pending.map((p) => (
            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, pr: 0.5, borderRadius: radius.sm, bgcolor: tokens.surface }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {p.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <Box component="span" sx={tabular}>
                    {clock(p.at)}
                  </Box>
                  {p.attempts > 0 && ' · aguardando a largada sincronizar'}
                </Typography>
              </Box>
              <IconButton aria-label={`Descartar ${p.label}`} color="error" onClick={() => api.discardPending(p.id)}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Button fullWidth size="large" variant="contained" disabled={sync.syncing} onClick={() => void api.syncNow()}>
          Tentar enviar agora
        </Button>
      </BottomSheet>
    </>
  )
}
