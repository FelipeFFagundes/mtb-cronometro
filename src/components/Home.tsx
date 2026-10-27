import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { EventInfo } from '../types'
import { formatEventDate, sortEvents, todayIso } from '../lib/events'
import { tokens } from '../theme'
import { EmptyState, ListCard, PageHeader, Section } from './ui'
import { Alert, Box, Button, ButtonBase, Chip, TextField, Typography } from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'

interface Props {
  events: EventInfo[]
  onOpen: (event: EventInfo) => void
  onOrganizer: () => void
}

function EventRow({ event, onOpen }: { event: EventInfo; onOpen: () => void }) {
  const today = event.startsOn === todayIso()
  return (
    <ButtonBase
      onClick={onOpen}
      sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, pr: 1, py: 1.25, minHeight: 64, textAlign: 'left' }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800 }}>
          {event.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {formatEventDate(event.startsOn)}
          {event.location && ` · ${event.location}`}
        </Typography>
      </Box>
      {today && event.status === 'aberto' && <Chip size="small" color="primary" label="Hoje" />}
      <ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />
    </ButtonBase>
  )
}

/** Início: eventos visíveis e entrada pelo código público do evento. */
export function Home({ events, onOpen, onOrganizer }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { open, closed } = sortEvents(events)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const found = await api.findEventByCode(code)
      if (found) onOpen(found)
      else setError('Nenhum evento com esse código.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível procurar o evento')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <PageHeader title="Eventos" subtitle="Escolha a prova para acompanhar os tempos" />

      {open.length === 0 && closed.length === 0 ? (
        <EmptyState icon={<EventRoundedIcon />} title="Nenhum evento publicado" text="Quando o organizador abrir uma prova, ela aparece aqui." />
      ) : (
        <>
          {open.length > 0 && (
            <Section title="Abertos" count={open.length}>
              <ListCard>
                {open.map((e) => (
                  <EventRow key={e.id} event={e} onOpen={() => onOpen(e)} />
                ))}
              </ListCard>
            </Section>
          )}
          {closed.length > 0 && (
            <Section title="Encerrados" count={closed.length}>
              <ListCard>
                {closed.map((e) => (
                  <EventRow key={e.id} event={e} onOpen={() => onOpen(e)} />
                ))}
              </ListCard>
            </Section>
          )}
        </>
      )}

      <Section title="Tenho um código">
        <Box component="form" onSubmit={(e) => void submit(e)} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Código do evento (ex.: K7MQ2)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))}
            fullWidth
            slotProps={{ htmlInput: { 'aria-label': 'Código do evento', autoCapitalize: 'characters', autoComplete: 'off', spellCheck: false } }}
          />
          <Button type="submit" variant="contained" disabled={busy || code.length < 4} sx={{ flexShrink: 0 }}>
            Abrir
          </Button>
        </Box>
        {error && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          O código do evento está no link ou no QR code da prova. Fiscais entram pelo botão "Fiscal", com o código de
          fiscal.
        </Typography>
      </Section>

      <Button
        color="inherit"
        startIcon={<ManageAccountsRoundedIcon />}
        onClick={onOrganizer}
        sx={{ alignSelf: 'center', color: tokens.muted }}
      >
        Área do organizador
      </Button>
    </Box>
  )
}
