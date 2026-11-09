import { useEffect, useState } from 'react'
import { api } from '../data'
import type { AppState, LogEntry } from '../types'
import { athleteKey } from '../lib/athletes'
import { tabular, tokens } from '../theme'
import { BottomSheet, FilterBar } from './ui'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'

const when = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Célula de CSV com aspas quando precisa (vírgula, aspas ou quebra de linha). */
const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Histórico de alterações das descidas: quem largou, chegou, corrigiu ou apagou, e quando. */
export function LogSheet({ open, onClose, state }: { open: boolean; onClose: () => void; state: AppState }) {
  const [entries, setEntries] = useState<LogEntry[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setEntries(null)
    api
      .getLog()
      .then((l) => alive && setEntries(l))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Não foi possível carregar'))
    return () => {
      alive = false
    }
  }, [open])

  const stageName = (id?: string) => state.stages.find((s) => s.id === id)?.name ?? ''
  const riderName = (num?: string) => state.riders.find((r) => r.num === num)?.name ?? ''
  const line = (e: LogEntry) => [e.action, e.num ? `#${e.num} ${riderName(e.num)}` : '', stageName(e.stageId), e.detail ?? '', e.actor ?? ''].join(' ')
  const q = athleteKey(search)
  const visible = (entries ?? []).filter((e) => !q || athleteKey(line(e)).includes(q))

  const exportCsv = () => {
    const rows = [['Quando', 'Ação', 'Placa', 'Atleta', 'Especial', 'Detalhe', 'Quem'], ...visible.map((e) => [when(e.at), e.action, e.num ?? '', riderName(e.num), stageName(e.stageId), e.detail ?? '', e.actor ?? ''])]
    const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `historico-${(state.event?.name ?? 'prova').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Histórico de alterações">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <FilterBar placeholder="Buscar placa, nome, ação ou fiscal" value={search} onChange={setSearch} count={`${visible.length} registros`} />
        {error ? (
          <Typography color="error.main">{error}</Typography>
        ) : !entries ? (
          <CircularProgress size={28} sx={{ alignSelf: 'center', my: 2 }} />
        ) : visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Nada registrado ainda.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {visible.slice(0, 300).map((e, i) => (
              <Box key={i} sx={{ py: 1, borderBottom: `1px solid ${tokens.line}` }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography sx={{ fontWeight: 800 }}>{e.action}</Typography>
                  {e.num && (
                    <Typography noWrap sx={{ minWidth: 0 }}>
                      #{e.num} {riderName(e.num)}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  <Box component="span" sx={tabular}>
                    {when(e.at)}
                  </Box>
                  {[stageName(e.stageId), e.detail, e.actor && `por ${e.actor}`].filter(Boolean).map((t) => ` · ${t}`)}
                </Typography>
              </Box>
            ))}
            {visible.length > 300 && (
              <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
                Mostrando os 300 mais recentes. O CSV leva todos.
              </Typography>
            )}
          </Box>
        )}
        <Button variant="outlined" color="inherit" startIcon={<DownloadRoundedIcon />} onClick={exportCsv} disabled={!entries || visible.length === 0}>
          Exportar CSV
        </Button>
      </Box>
    </BottomSheet>
  )
}
