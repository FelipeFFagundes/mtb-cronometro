import { useEffect, useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, MarshalAccessInfo } from '../types'
import { tabular, tokens } from '../theme'
import { BottomSheet, ConfirmDialog } from './ui'
import { Box, Button, Card, Checkbox, FormControlLabel, Typography } from '@mui/material'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'

interface Props {
  state: AppState
  act: Act
}

const when = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Aba Prova > Acesso: o organizador gera o código que libera os celulares dos fiscais. */
export function MarshalAccess({ state, act }: Props) {
  const [info, setInfo] = useState<MarshalAccessInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revoke, setRevoke] = useState(false)
  const [code, setCode] = useState<string | null>(null)

  // Muda para buscar a situação de novo (ex.: depois de gerar um código)
  const [reloadKey, setReloadKey] = useState(0)
  const load = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let alive = true
    api
      .getMarshalAccessInfo()
      .then((i) => {
        if (!alive) return
        setInfo(i)
        setLoadError('')
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar'))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const generate = async () => {
    setConfirmOpen(false)
    let created = ''
    const ok = await act(async () => {
      created = await api.generateMarshalCode(revoke)
    })
    if (ok) {
      setCode(created)
      setRevoke(false)
      load()
    }
  }

  const eventName = state.event?.name ?? 'prova'
  const shareText = code
    ? `Código do fiscal (${eventName}): ${code}\nAbra ${location.origin} e toque em "Fiscal".`
    : ''

  const copy = () =>
    void act(() => navigator.clipboard.writeText(code ?? ''), 'Código copiado')

  const share = async () => {
    try {
      await navigator.share({ title: `Código do fiscal · ${eventName}`, text: shareText })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') copy()
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <KeyRoundedIcon sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800 }}>Código do fiscal</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {loadError
            ? loadError
            : !info
              ? 'Carregando…'
              : info.hasCode
                ? `Código ativo desde ${info.codeUpdatedAt ? when(info.codeUpdatedAt) : '—'}. ${info.marshals} ${info.marshals === 1 ? 'aparelho liberado' : 'aparelhos liberados'}.`
                : 'Nenhum código gerado ainda. Gere um e passe para quem vai cronometrar.'}
        </Typography>
        <Button
          variant="contained"
          startIcon={<KeyRoundedIcon />}
          onClick={() => (info?.hasCode ? setConfirmOpen(true) : void generate())}
        >
          {info?.hasCode ? 'Trocar código' : 'Gerar código'}
        </Button>
      </Card>

      <Typography variant="caption" color="text.secondary">
        O fiscal entra com o código uma vez, com internet, e o celular fica liberado para largada, chegada e DNF neste
        evento, mesmo sem sinal depois. Cadastros, grade e códigos ficam só com o organizador. O código não fica salvo em
        lugar nenhum: se perder, gere outro.
      </Typography>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void generate()}
        icon={<KeyRoundedIcon />}
        tone="warning"
        title="Trocar o código do fiscal?"
        confirmLabel="Trocar"
      >
        O código atual deixa de valer para novas entradas.
        {info && info.marshals > 0 && (
          <FormControlLabel
            sx={{ mt: 1.5, display: 'flex', alignItems: 'flex-start', color: 'text.primary' }}
            control={<Checkbox checked={revoke} onChange={(e) => setRevoke(e.target.checked)} sx={{ pt: 0 }} />}
            label={`Tirar também o acesso dos ${info.marshals} aparelho(s) que já entraram`}
          />
        )}
      </ConfirmDialog>

      <BottomSheet open={Boolean(code)} onClose={() => setCode(null)} title="Código do fiscal">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Anote ou compartilhe agora: o código não aparece de novo.
          </Typography>
          <Box
            sx={{
              ...tabular,
              fontSize: 'clamp(2.5rem, 14vw, 3.5rem)',
              fontWeight: 900,
              letterSpacing: '0.12em',
              color: tokens.brand,
              py: 1,
              userSelect: 'all',
            }}
          >
            {code}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<ContentCopyRoundedIcon />} onClick={copy}>
              Copiar
            </Button>
            <Button variant="contained" startIcon={<IosShareRoundedIcon />} onClick={() => void share()}>
              Compartilhar
            </Button>
          </Box>
        </Box>
      </BottomSheet>
    </Box>
  )
}
