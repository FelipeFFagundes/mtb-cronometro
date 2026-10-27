import { useState } from 'react'
import type { AppState } from '../types'
import { buildReport, reportFileName, saveOrShare } from '../lib/report'
import { BottomSheet, ChipSelect } from './ui'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'

const TITLE_KEY = 'mtb-report-title'

function savedTitle(): string {
  try {
    return localStorage.getItem(TITLE_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Props {
  open: boolean
  onClose: () => void
  state: AppState
  /** Filtros já escolhidos na tela de classificação. */
  initialStageId: string
  initialCategory: string
}

/** Painel para gerar o relatório de resultados em PDF ou imagem. */
export function ExportReport({ open, onClose, state, initialStageId, initialCategory }: Props) {
  const [title, setTitle] = useState(savedTitle)
  const [stageId, setStageId] = useState(initialStageId)
  const [category, setCategory] = useState(initialCategory)
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null)
  const [error, setError] = useState('')

  // Ao abrir, parte dos filtros que estão na tela
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStageId(initialStageId)
      setCategory(initialCategory)
      setError('')
    }
  }

  const generate = async (kind: 'pdf' | 'png') => {
    setBusy(kind)
    setError('')
    try {
      localStorage.setItem(TITLE_KEY, title.trim())
    } catch {
      /* noop */
    }
    try {
      const report = buildReport(state, { title: title || 'Resultado', stageId, category })
      const blob =
        kind === 'pdf'
          ? await (await import('../lib/reportPdf')).buildReportPdf(report)
          : await (await import('../lib/reportImage')).buildReportImage(report)
      await saveOrShare(blob, reportFileName(report, kind), `${report.title} · ${report.scope}`)
    } catch (e) {
      setError((e as Error).message || 'Não foi possível gerar o relatório')
    } finally {
      setBusy(null)
    }
  }

  const categories = state.categories || []

  return (
    <BottomSheet open={open} onClose={onClose} title="Relatório de resultados">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Nome da prova"
          placeholder="Ex.: 2ª Etapa Enduro SPET"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          fullWidth
        />
        <Box>
          <Typography variant="overline" color="text.secondary">
            Resultado
          </Typography>
          <ChipSelect
            ariaLabel="Resultado do relatório"
            value={stageId}
            onChange={setStageId}
            options={[{ value: 'all', label: 'Geral' }, ...state.stages.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </Box>
        {categories.length > 1 && (
          <Box>
            <Typography variant="overline" color="text.secondary">
              Categoria
            </Typography>
            <ChipSelect
              ariaLabel="Categoria do relatório"
              value={category}
              onChange={setCategory}
              options={[{ value: 'Todas', label: 'Todas' }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<PictureAsPdfRoundedIcon />}
            disabled={busy !== null}
            onClick={() => void generate('pdf')}
          >
            {busy === 'pdf' ? 'Gerando…' : 'PDF'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            color="inherit"
            startIcon={<ImageRoundedIcon />}
            disabled={busy !== null}
            onClick={() => void generate('png')}
          >
            {busy === 'png' ? 'Gerando…' : 'Imagem'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          PDF em A4 para imprimir ou arquivar. Imagem para mandar no WhatsApp ou postar. Com “Todas”, cada categoria tem a
          própria classificação.
        </Typography>
      </Box>
    </BottomSheet>
  )
}
