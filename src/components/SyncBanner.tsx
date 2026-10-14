import { useState } from 'react'
import { api } from '../data'
import type { PendingOp, SyncStatus } from '../types'
import { clock } from '../lib/time'
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'

interface Props {
  sync: SyncStatus
  pending: PendingOp[]
}

/** Faixa que aparece quando está sem conexão ou há ações aguardando envio. */
export function SyncBanner({ sync, pending }: Props) {
  const [openDetails, setOpenDetails] = useState(false)

  if (sync.online && pending.length === 0) return null

  const isOffline = !sync.online

  let text: string
  if (isOffline) {
    text = pending.length
      ? `Sem conexão · ${pending.length} ${pending.length === 1 ? 'ação guardada localmente' : 'ações guardadas localmente'}`
      : 'Sem conexão · os registros serão guardados e enviados automaticamente ao reconectar'
  } else {
    text = `Sincronizando ${pending.length} ${pending.length === 1 ? 'ação pendente' : 'ações pendentes'} com o servidor…`
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={isOffline ? 'warning' : 'info'}
        icon={isOffline ? <CloudOffRoundedIcon /> : <CloudSyncRoundedIcon />}
        sx={{
          borderRadius: 3,
          alignItems: 'center',
          '& .MuiAlert-message': { width: '100%' },
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {pending.length > 0 && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={sync.syncing}
                  onClick={() => void api.syncNow()}
                  sx={{ py: 0.4, px: 1.2, fontSize: '0.8rem' }}
                >
                  Sincronizar
                </Button>
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => setOpenDetails(!openDetails)}
                  aria-label="ver detalhes"
                >
                  {openDetails ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                </IconButton>
              </>
            )}
          </Box>
        }
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {text}
        </Typography>
      </Alert>

      {/* Lista de pendências detalhadas */}
      <Collapse in={openDetails && pending.length > 0}>
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            bgcolor: 'background.paper',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
            Fila de Ações Offline
          </Typography>
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {pending.map((p) => (
              <ListItem
                key={p.id}
                disableGutters
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="descartar"
                    size="small"
                    color="error"
                    onClick={() => api.discardPending(p.id)}
                    title="Descartar ação"
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{p.label}</Typography>}
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {clock(p.at)}
                      {p.attempts > 0 && ' · aguardando largada ser sincronizada'}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Collapse>
    </Box>
  )
}
