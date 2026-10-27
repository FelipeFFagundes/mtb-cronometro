import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { EventInfo, NewEvent } from '../types'
import { formatEventDate, sortEvents, statusLabel, todayIso } from '../lib/events'
import { eventLink } from '../hooks/useRoute'
import { tabular, tokens } from '../theme'
import { BottomSheet, ConfirmDialog, EmptyState, PageHeader, Section } from './ui'
import { QrCode } from './QrCode'
import { Alert, Box, Button, Card, Chip, TextField, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FileCopyRoundedIcon from '@mui/icons-material/FileCopyRounded'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

interface Props {
  events: EventInfo[]
  act: Act
  /** Abre as telas do fiscal/organizador no evento. */
  onOpen: (event: EventInfo) => void
}

type Draft = { id?: string; name: string; startsOn: string; location: string; status: EventInfo['status']; copyFrom: string }

const statusColor: Record<EventInfo['status'], 'default' | 'success' | 'warning'> = {
  rascunho: 'warning',
  aberto: 'success',
  encerrado: 'default',
}

/** Área do organizador: lista, cria, edita, duplica, encerra, exclui e divulga eventos. */
export function EventsAdmin({ events, act, onOpen }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [sharing, setSharing] = useState<EventInfo | null>(null)
  const [deleting, setDeleting] = useState<EventInfo | null>(null)
  // Exclusão: quanto será apagado e o nome digitado para confirmar
  const [deleteStats, setDeleteStats] = useState<{ riders: number; runs: number } | null>(null)
  const [typedName, setTypedName] = useState('')
  const { open, closed } = sortEvents(events)

  const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

  const askDelete = (ev: EventInfo) => {
    setDeleting(ev)
    setDeleteStats(null)
    setTypedName('')
    api
      .getEventStats(ev.id)
      .then(setDeleteStats)
      .catch(() => setDeleteStats(null))
  }

  const closeInstead = (ev: EventInfo) => {
    setDeleting(null)
    setDraft(null)
    void act(() => api.updateEvent(ev.id, { status: 'encerrado' }), `Evento "${ev.name}" encerrado`)
  }

  const newDraft = (copyFrom = ''): Draft => {
    const source = events.find((e) => e.id === copyFrom)
    return { name: source ? `${source.name} (cópia)` : '', startsOn: todayIso(), location: source?.location ?? '', status: 'aberto', copyFrom }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const d = draft
    if (d.id) {
      const ok = await act(
        () => api.updateEvent(d.id!, { name: d.name, startsOn: d.startsOn, location: d.location, status: d.status }),
        `Evento "${d.name.trim()}" salvo`,
      )
      if (ok) setDraft(null)
    } else {
      const input: NewEvent = { name: d.name, startsOn: d.startsOn, location: d.location, copyFrom: d.copyFrom || undefined }
      const ok = await act(() => api.createEvent(input), `Evento "${d.name.trim()}" criado`)
      if (ok) setDraft(null)
    }
  }

  const link = sharing?.publicCode ? eventLink(sharing.publicCode) : ''
  const copyLink = () => void act(() => navigator.clipboard.writeText(link), 'Link copiado')
  const shareLink = async () => {
    try {
      await navigator.share({ title: sharing?.name, text: `Acompanhe os tempos de ${sharing?.name} ao vivo:`, url: link })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') copyLink()
    }
  }

  const card = (ev: EventInfo) => (
    <Card key={ev.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }}>{ev.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {formatEventDate(ev.startsOn)}
            {ev.location && ` · ${ev.location}`}
          </Typography>
        </Box>
        <Chip size="small" label={statusLabel[ev.status]} color={statusColor[ev.status]} variant={ev.status === 'aberto' ? 'filled' : 'outlined'} />
      </Box>
      {ev.publicCode && (
        <Typography variant="body2" color="text.secondary">
          Código do público:{' '}
          <Box component="span" sx={{ ...tabular, color: 'text.primary', fontWeight: 800, letterSpacing: '0.08em' }}>
            {ev.publicCode}
          </Box>
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => onOpen(ev)}>
          Abrir
        </Button>
        <Button variant="outlined" color="inherit" startIcon={<QrCode2RoundedIcon />} onClick={() => setSharing(ev)} disabled={!ev.publicCode}>
          Divulgar
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<EditRoundedIcon />}
          onClick={() => setDraft({ id: ev.id, name: ev.name, startsOn: ev.startsOn, location: ev.location ?? '', status: ev.status, copyFrom: '' })}
        >
          Editar
        </Button>
      </Box>
    </Card>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <PageHeader
        title="Eventos"
        subtitle="Área do organizador"
        right={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDraft(newDraft())} sx={{ flexShrink: 0 }}>
            Novo
          </Button>
        }
      />

      {events.length === 0 && <EmptyState icon={<EventRoundedIcon />} title="Nenhum evento" text="Crie o primeiro evento para começar." />}
      {open.length > 0 && (
        <Section title="Abertos e rascunhos" count={open.length}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{open.map(card)}</Box>
        </Section>
      )}
      {closed.length > 0 && (
        <Section title="Encerrados" count={closed.length}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{closed.map(card)}</Box>
        </Section>
      )}

      <Typography variant="caption" color="text.secondary">
        Rascunho fica escondido do público. Encerrado continua visível, mas os fiscais não registram mais tempos. O código
        dos fiscais de cada evento fica em Prova → Acesso, depois de abrir o evento.
      </Typography>

      {/* ===== Criar / editar ===== */}
      <BottomSheet open={Boolean(draft)} onClose={() => setDraft(null)} title={
          draft?.id
            ? `Editar · ${events.find((x) => x.id === draft.id)?.name ?? 'evento'}`
            : draft?.copyFrom
              ? `Duplicar · ${events.find((x) => x.id === draft.copyFrom)?.name ?? 'evento'}`
              : 'Novo evento'
        }>
        {draft && (
          <Box component="form" onSubmit={(e) => void save(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 60) })} required autoFocus fullWidth />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Data"
                type="date"
                value={draft.startsOn}
                onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField label="Local" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value.slice(0, 60) })} />
            </Box>
            {draft.id ? (
              <TextField
                select
                label="Situação"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as EventInfo['status'] })}
                slotProps={{ select: { native: true } }}
              >
                <option value="rascunho">Rascunho (escondido do público)</option>
                <option value="aberto">Aberto</option>
                <option value="encerrado">Encerrado (fiscais não registram mais)</option>
              </TextField>
            ) : (
              <TextField
                select
                label="Começar com"
                value={draft.copyFrom}
                onChange={(e) => setDraft({ ...draft, copyFrom: e.target.value })}
                slotProps={{ select: { native: true } }}
                helperText={draft.copyFrom ? 'Copia especiais, categorias e inscritos, sem tempos nem grade.' : 'Especial E1 e as categorias padrão.'}
              >
                <option value="">Evento vazio</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    Cópia de {ev.name}
                  </option>
                ))}
              </TextField>
            )}
            <Button type="submit" variant="contained" size="large">
              {draft.id ? 'Salvar' : 'Criar evento'}
            </Button>
            {draft.id && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Button color="inherit" startIcon={<FileCopyRoundedIcon />} onClick={() => setDraft(newDraft(draft.id))}>
                  Duplicar
                </Button>
                <Button
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => {
                    const ev = events.find((x) => x.id === draft.id)
                    if (ev) askDelete(ev)
                  }}
                >
                  Excluir
                </Button>
              </Box>
            )}
          </Box>
        )}
      </BottomSheet>

      {/* ===== Divulgar ===== */}
      <BottomSheet open={Boolean(sharing)} onClose={() => setSharing(null)} title={sharing ? `Divulgar · ${sharing.name}` : undefined}>
        {sharing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
            <QrCode value={link} />
            <Typography variant="body2" color="text.secondary">
              Quem apontar a câmera abre os tempos ao vivo. Código do evento:{' '}
              <Box component="span" sx={{ ...tabular, color: tokens.brand, fontWeight: 900, letterSpacing: '0.08em' }}>
                {sharing.publicCode}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ ...tabular, wordBreak: 'break-all', color: 'text.secondary' }}>
              {link}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Button variant="outlined" color="inherit" startIcon={<ContentCopyRoundedIcon />} onClick={copyLink}>
                Copiar link
              </Button>
              <Button variant="contained" startIcon={<IosShareRoundedIcon />} onClick={() => void shareLink()}>
                Compartilhar
              </Button>
            </Box>
          </Box>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const ev = deleting
          setDeleting(null)
          setDraft(null)
          if (ev) void act(() => api.deleteEvent(ev.id), `Evento "${ev.name}" excluído`)
        }}
        icon={<WarningAmberRoundedIcon />}
        title={`Excluir "${deleting?.name ?? ''}"?`}
        confirmLabel="Excluir tudo"
        confirmDisabled={!deleting || !sameName(typedName, deleting.name)}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <span>
            Apaga o evento{' '}
            {deleteStats ? (
              <>
                com <strong>{deleteStats.riders} inscritos</strong> e <strong>{deleteStats.runs} tempos registrados</strong>
              </>
            ) : (
              'com todos os inscritos e tempos'
            )}
            , além das especiais e grades, para todos os aparelhos. Não dá para desfazer.
          </span>
          {deleting && deleteStats && deleteStats.runs > 0 && deleting.status !== 'encerrado' && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={() => closeInstead(deleting)}>
                  Encerrar
                </Button>
              }
            >
              Tem tempos registrados. Para só tirar das telas dos fiscais, encerre em vez de excluir.
            </Alert>
          )}
          <TextField
            size="small"
            label="Digite o nome do evento para confirmar"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={deleting?.name}
            autoComplete="off"
            fullWidth
          />
        </Box>
      </ConfirmDialog>
    </Box>
  )
}
