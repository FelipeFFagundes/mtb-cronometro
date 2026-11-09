import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { Organizer } from '../types'
import { ConfirmDialog, ListCard, Section } from './ui'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded'

/**
 * Quem pode criar e editar eventos. A conta precisa existir antes (Supabase → Authentication);
 * aqui ela só ganha ou perde o acesso de organizador. Ninguém remove o próprio acesso.
 */
export function Organizers({ act }: { act: Act }) {
  const [list, setList] = useState<Organizer[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [removing, setRemoving] = useState<Organizer | null>(null)

  const load = () =>
    void api
      .listOrganizers()
      .then((l) => {
        setList(l)
        setError('')
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar'))
  useEffect(load, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await act(() => api.addOrganizer(email.trim()), `${email.trim()} agora é organizador`)
    if (ok) {
      setEmail('')
      load()
    }
  }

  return (
    <Section title="Organizadores" count={list?.length}>
      {error ? (
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ListCard>
            {(list ?? []).map((o) => (
              <Box key={o.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, py: 1, minHeight: 52 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: o.me ? 800 : 500 }}>
                  {o.email}
                  {o.me && (
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                      {' '}
                      (você)
                    </Box>
                  )}
                </Typography>
                {!o.me && (
                  <IconButton aria-label={`Tirar o acesso de ${o.email}`} onClick={() => setRemoving(o)} color="error">
                    <PersonRemoveRoundedIcon />
                  </IconButton>
                )}
              </Box>
            ))}
          </ListCard>
          <Box component="form" onSubmit={(e) => void add(e)} sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" type="email" placeholder="E-mail da conta" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
            <Button type="submit" variant="contained" startIcon={<PersonAddRoundedIcon />} sx={{ flexShrink: 0 }}>
              Adicionar
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            A pessoa precisa ter uma conta (Supabase → Authentication → Add user). Aqui ela só ganha o acesso de organizador.
          </Typography>
        </Box>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const o = removing
          setRemoving(null)
          if (o) void act(() => api.removeOrganizer(o.userId), `${o.email} não é mais organizador`).then(load)
        }}
        tone="warning"
        title="Tirar o acesso de organizador?"
        confirmLabel="Tirar acesso"
      >
        {removing?.email} deixa de criar e editar eventos. A conta continua existindo.
      </ConfirmDialog>
    </Section>
  )
}
