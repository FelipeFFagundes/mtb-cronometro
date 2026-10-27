import { useEffect, useState, type Ref } from 'react'
import { api } from '../data'
import type { AthleteEntry, AthleteSummary } from '../types'
import { formatEventDate } from '../lib/events'
import { Autocomplete, Box, TextField, Typography } from '@mui/material'

const NAME_MAX = 35

interface NameProps {
  value: string
  onChange: (name: string) => void
  /** Atleta escolhido da base (preenche nome e equipe). */
  onPick: (athlete: AthleteSummary) => void
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
}

/** Nome do atleta com sugestões da base: quem já correu outro evento aparece ao digitar. */
export function AthleteNameField({ value, onChange, onPick, inputRef, autoFocus }: NameProps) {
  const [options, setOptions] = useState<AthleteSummary[]>([])

  useEffect(() => {
    if (value.trim().length < 2) return
    let alive = true
    const timer = setTimeout(() => {
      api
        .searchAthletes(value)
        .then((list) => alive && setOptions(list))
        .catch(() => alive && setOptions([]))
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [value])

  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={value.trim().length < 2 ? [] : options}
      filterOptions={(o) => o}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
      inputValue={value}
      onInputChange={(_, v, reason) => {
        if (reason !== 'reset') onChange(v.slice(0, NAME_MAX))
      }}
      onChange={(_, v) => {
        if (v && typeof v !== 'string') onPick(v)
      }}
      renderOption={({ key, ...props }, o) => (
        <Box component="li" key={key} {...props} sx={{ display: 'block !important' }}>
          <Typography sx={{ fontWeight: 700 }}>{o.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {[o.team, o.city, `${o.events} ${o.events === 1 ? 'evento' : 'eventos'}`].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Nome completo"
          required
          autoFocus={autoFocus}
          inputRef={inputRef}
          helperText={`${value.length}/${NAME_MAX}`}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, autoCapitalize: 'words' },
            formHelperText: { sx: { textAlign: 'right' } },
          }}
        />
      )}
    />
  )
}

/** Eventos de que o atleta participou (no painel de edição). */
export function AthleteHistory({ athleteId, currentEventId }: { athleteId?: string; currentEventId?: string }) {
  const [entries, setEntries] = useState<AthleteEntry[] | null>(null)

  useEffect(() => {
    if (!athleteId) return
    let alive = true
    api
      .getAthleteHistory(athleteId)
      .then((list) => alive && setEntries(list))
      .catch(() => alive && setEntries([]))
    return () => {
      alive = false
    }
  }, [athleteId])

  const others = (entries ?? []).filter((e) => e.eventId !== currentEventId)
  if (!athleteId || !entries || others.length === 0) return null
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Outros eventos
      </Typography>
      {others.map((e) => (
        <Typography key={e.eventId} variant="body2" sx={{ py: 0.25 }}>
          {formatEventDate(e.startsOn)} · <strong>{e.eventName}</strong> · #{e.num} · {e.category}
        </Typography>
      ))}
    </Box>
  )
}
