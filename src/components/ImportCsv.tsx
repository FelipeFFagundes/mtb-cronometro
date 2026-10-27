import { useState, type ChangeEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { readRidersCsv, type CsvImport } from '../lib/csv'
import { tokens } from '../theme'
import { BottomSheet, ListCard, RiderPlate } from './ui'
import { Alert, Box, Button, Chip, Typography } from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'

const TEMPLATE_URL = `${import.meta.env.BASE_URL}modelo-pilotos.csv`
const PREVIEW_ROWS = 6

interface Props {
  open: boolean
  onClose: () => void
  state: AppState
  act: Act
}

/** Painel de importação de pilotos e categorias por planilha CSV. */
export function ImportCsv({ open, onClose, state, act }: Props) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<CsvImport | null>(null)
  const [busy, setBusy] = useState(false)

  const close = () => {
    onClose()
    setParsed(null)
    setFileName('')
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    setFileName(file.name)
    let text = await file.text()
    // Excel antigo salva em Windows-1252: se aparecer caractere inválido, relê nessa codificação
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
    setParsed(readRidersCsv(text))
  }

  const known = new Set(state.riders.map((r) => r.num))
  const riders = parsed?.riders ?? []
  const updated = riders.filter((r) => known.has(r.num)).length
  const added = riders.length - updated
  const newCats = (parsed?.categories ?? []).filter((c) => !state.categories.includes(c))
  const errors = parsed?.issues.filter((i) => !i.warning) ?? []
  const warnings = parsed?.issues.filter((i) => i.warning) ?? []
  const canImport = riders.length > 0 || newCats.length > 0

  const runImport = async () => {
    if (!parsed) return
    setBusy(true)
    const parts = [
      added > 0 && `${added} ${added === 1 ? 'atleta novo' : 'atletas novos'}`,
      updated > 0 && `${updated} ${updated === 1 ? 'atualizado' : 'atualizados'}`,
      newCats.length > 0 && `${newCats.length} ${newCats.length === 1 ? 'categoria nova' : 'categorias novas'}`,
    ].filter(Boolean)
    const ok = await act(() => api.importRiders(parsed.riders, parsed.categories), `Importado: ${parts.join(', ')}`)
    setBusy(false)
    if (ok) close()
  }

  return (
    <BottomSheet open={open} onClose={close} title="Importar planilha">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <Typography variant="body2" color="text.secondary">
          Arquivo CSV com as colunas <strong>numero</strong>, <strong>nome</strong> e <strong>categoria</strong>. Pilotos com
          número já cadastrado são atualizados; categorias que não existem são criadas.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component="label" variant="contained" startIcon={<UploadFileRoundedIcon />} sx={{ flex: 1 }}>
            {fileName ? 'Trocar arquivo' : 'Escolher arquivo'}
            <input hidden type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e)} />
          </Button>
          <Button component="a" href={TEMPLATE_URL} download="modelo-pilotos.csv" variant="outlined" color="inherit" startIcon={<DownloadRoundedIcon />}>
            Modelo
          </Button>
        </Box>

        {parsed && (
          <>
            <Typography variant="caption" color="text.secondary" noWrap>
              {fileName}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip color="success" label={`${added} novos`} />
              <Chip color="primary" variant="outlined" label={`${updated} atualizados`} />
              <Chip variant="outlined" label={`${newCats.length} categorias novas`} />
              {errors.length > 0 && <Chip color="error" label={`${errors.length} com erro`} />}
            </Box>

            {newCats.length > 0 && (
              <Typography variant="body2">
                Categorias novas: <strong>{newCats.join(', ')}</strong>
              </Typography>
            )}

            {(errors.length > 0 || warnings.length > 0) && (
              <Alert severity={errors.length > 0 ? 'error' : 'warning'} sx={{ '& ul': { m: 0, pl: 2 } }}>
                {errors.length > 0 && <strong>Linhas ignoradas:</strong>}
                <ul>
                  {[...errors, ...warnings].slice(0, 8).map((i) => (
                    <li key={`${i.line}-${i.message}`}>
                      Linha {i.line}: {i.message}
                    </li>
                  ))}
                  {errors.length + warnings.length > 8 && <li>e mais {errors.length + warnings.length - 8}…</li>}
                </ul>
              </Alert>
            )}

            {riders.length > 0 && (
              <ListCard>
                {riders.slice(0, PREVIEW_ROWS).map((r) => (
                  <Box key={r.num} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1 }}>
                    <RiderPlate num={r.num} size="sm" tone="muted" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 700 }}>
                        {r.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {r.cat}
                      </Typography>
                    </Box>
                    {known.has(r.num) && <Chip size="small" variant="outlined" label="atualiza" />}
                  </Box>
                ))}
                {riders.length > PREVIEW_ROWS && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.5, bgcolor: tokens.bg }}>
                    e mais {riders.length - PREVIEW_ROWS} atletas
                  </Typography>
                )}
              </ListCard>
            )}

            <Button variant="contained" size="large" disabled={!canImport || busy} onClick={() => void runImport()}>
              {riders.length > 0 ? `Importar ${riders.length} ${riders.length === 1 ? 'atleta' : 'atletas'}` : 'Criar categorias'}
            </Button>
          </>
        )}
      </Box>
    </BottomSheet>
  )
}
