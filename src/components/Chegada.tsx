import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock, fmt } from '../lib/time'
import { LiveTimer } from './LiveTimer'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Alert,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

interface RunActionTarget {
  id: string
  num: string
  name: string
  stageName?: string
  timeStr?: string
  isDnf: boolean
}

interface ConfirmTarget {
  num: string
  name: string
  stageId?: string
  stageName?: string
  /** Carimbo do instante em que o fiscal apertou o botão */
  capturedAt: number
  startAt: number | null
}

interface DnfTarget {
  id: string
  num: string
  name: string
  stageName?: string
}

export function Chegada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [dnfTarget, setDnfTarget] = useState<DnfTarget | null>(null)
  const [runActionTarget, setRunActionTarget] = useState<RunActionTarget | null>(null)

  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [selectedFilterStage, setSelectedFilterStage] = useState<string>('all')

  const value = num.trim()
  const rider = state.riders.find((r) => r.num === value)
  const onTrackRun = state.runs.find((r) => r.num === value && r.status === 'track')
  const onTrack = Boolean(onTrackRun)
  const onTrackStage = onTrackRun ? stages.find((s) => s.id === onTrackRun.stageId) : null

  let previewMsg = 'Digite o número ou aperte CHEGOU na lista de atletas na pista'
  let previewSeverity: 'info' | 'success' | 'error' = 'info'
  if (value) {
    if (!rider) {
      previewMsg = `Piloto #${value} não encontrado`
      previewSeverity = 'error'
    } else if (!onTrack && !online) {
      previewMsg = `${rider.name} · largada não sincronizada (offline), será validada depois`
      previewSeverity = 'info'
    } else if (!onTrack) {
      previewMsg = `${rider.name} não está na pista`
      previewSeverity = 'error'
    } else {
      previewMsg = `${rider.name} · ${rider.cat} (${onTrackStage?.name ?? 'Especial'})`
      previewSeverity = 'success'
    }
  }

  // Registra a chegada de fato usando o tempo capturado no 1º clique
  const executeFinish = async (target: ConfirmTarget) => {
    const targetName = target.name
    const stageLabel = target.stageName ? ` (${target.stageName})` : ''
    setConfirmTarget(null)
    setNum('')
    return act(
      () => api.finishRun(target.num, target.capturedAt, target.stageId).then(() => undefined),
      `🏁 ${targetName} concluiu${stageLabel}! ` +
        (target.startAt ? `(${fmt(target.capturedAt - target.startAt)})` : '') +
        (online ? '' : ' (salvo offline)')
    )
  }

  // Captura o instante do clique e pede confirmação de chegada
  const requestFinish = (n: string) => {
    const rName = state.riders.find((r) => r.num === n)?.name ?? `Piloto #${n}`
    const run = state.runs.find((r) => r.num === n && r.status === 'track')
    const runStage = run ? stages.find((s) => s.id === run.stageId) : null
    // Captura o momento exato do clique com relógio sincronizado
    const capturedAt = Date.now() + api.getClockOffset()
    setConfirmTarget({
      num: n,
      name: rName,
      stageId: run?.stageId,
      stageName: runStage?.name,
      capturedAt,
      startAt: run ? run.start : null,
    })
  }

  // Executa o DNF após confirmação
  const executeDnf = async (target: DnfTarget) => {
    setDnfTarget(null)
    return act(
      () => api.dnfRun(target.id),
      `⚠️ Piloto #${target.num} (${target.name}) marcado como DNF`
    )
  }

  // Pede confirmação de DNF
  const requestDnf = (runId: string, riderNum: string) => {
    const rName = state.riders.find((r) => r.num === riderNum)?.name ?? `Piloto #${riderNum}`
    const run = state.runs.find((r) => r.id === runId)
    const runStage = run ? stages.find((s) => s.id === run.stageId) : null
    setDnfTarget({ id: runId, num: riderNum, name: rName, stageName: runStage?.name })
  }

  const submit = () => {
    if (!value) return act(async () => { throw new Error('Informe o número do piloto') })
    requestFinish(value)
  }

  // Filtra atletas na pista (pode filtrar por especial ou todas)
  const track = state.runs
    .filter((r) => r.status === 'track' && (selectedFilterStage === 'all' || (r.stageId || stages[0]?.id) === selectedFilterStage))
    .sort((a, b) => a.start - b.start)

  const done = state.runs
    .filter((r) => r.status !== 'track' && r.end != null)
    .sort((a, b) => b.end! - a.end!)
    .slice(0, 8)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          🏁 Controle de Chegada
        </Typography>
        <Chip
          label={`${track.length} na pista`}
          size="small"
          color={track.length > 0 ? 'primary' : 'default'}
          variant="outlined"
        />
      </Box>

      {/* FILTRO DE ESPECIAL PARA O FISCAL DE CHEGADA */}
      <Card sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <RouteRoundedIcon color="primary" sx={{ fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Filtrar Linha de Chegada
          </Typography>
        </Box>

        <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
          <ToggleButtonGroup
            value={selectedFilterStage}
            exclusive
            onChange={(_, val) => val && setSelectedFilterStage(val)}
            size="small"
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                fontWeight: 700,
                fontSize: '0.78rem',
                py: 0.8,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                '&.Mui-selected': {
                  bgcolor: 'error.main',
                  color: '#ffffff',
                  fontWeight: 900,
                  '&:hover': { bgcolor: 'error.dark' },
                },
              },
            }}
          >
            <ToggleButton value="all">Todas as Especiais</ToggleButton>
            {stages.map((st) => (
              <ToggleButton key={st.id} value={st.id}>
                {st.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Card>

      {/* MODAL DE CONFIRMAÇÃO DE CHEGADA COM TEMPO CONGELADO */}
      <Dialog
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              textAlign: 'center',
            },
          },
        }}
      >
        {confirmTarget && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'rgba(239, 68, 68, 0.15)',
                  color: 'error.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <FlagRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Confirmar Chegada?
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
                Atleta <strong>#{confirmTarget.num} - {confirmTarget.name}</strong>
              </Typography>
              {confirmTarget.stageName && (
                <Chip
                  label={confirmTarget.stageName}
                  color="primary"
                  size="small"
                  sx={{ mt: 1, fontWeight: 700 }}
                />
              )}
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  mb: 1.5,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Tempo capturado no clique
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: 'error.main',
                    my: 0.5,
                  }}
                >
                  {confirmTarget.startAt
                    ? fmt(confirmTarget.capturedAt - confirmTarget.startAt)
                    : clock(confirmTarget.capturedAt)}
                </Typography>
                {confirmTarget.startAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Se cancelar, o cronômetro continua: <LiveTimer start={confirmTarget.startAt} />
                  </Typography>
                )}
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setConfirmTarget(null)}
                sx={{ py: 1.2 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => void executeFinish(confirmTarget)}
                sx={{ py: 1.2, fontWeight: 800 }}
              >
                CONFIRMAR
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE DNF */}
      <Dialog
        open={Boolean(dnfTarget)}
        onClose={() => setDnfTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              textAlign: 'center',
              borderColor: 'error.main',
            },
          },
        }}
      >
        {dnfTarget && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'rgba(239, 68, 68, 0.15)',
                  color: 'error.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <WarningRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h5" color="error.main" sx={{ fontWeight: 800 }}>
                Confirmar DNF (Não Terminou)?
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
              <Typography variant="body1">
                Tem certeza que deseja marcar <strong>#{dnfTarget.num} - {dnfTarget.name}</strong> como DNF
                {dnfTarget.stageName ? ` na ${dnfTarget.stageName}` : ''}?
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                A descida será encerrada sem classificação de tempo.
              </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setDnfTarget(null)}
                sx={{ py: 1.2 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => void executeDnf(dnfTarget)}
                sx={{ py: 1.2, fontWeight: 800 }}
              >
                SIM, DNF
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* MODAL DE GERENCIAR/INVALIDAR DESCIDA REGISTRADA */}
      <Dialog
        open={Boolean(runActionTarget)}
        onClose={() => setRunActionTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 2,
              textAlign: 'center',
            },
          },
        }}
      >
        {runActionTarget && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'rgba(245, 158, 11, 0.15)',
                  color: 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <WarningRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Gerenciar Descida
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                Atleta <strong>#{runActionTarget.num} - {runActionTarget.name}</strong>
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
                {runActionTarget.stageName && (
                  <Chip label={runActionTarget.stageName} size="small" color="primary" variant="outlined" />
                )}
                <Chip
                  label={runActionTarget.timeStr}
                  size="small"
                  color={runActionTarget.isDnf ? 'error' : 'secondary'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>
            </DialogTitle>

            <DialogContent sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Escolha a ação desejada para esta descida:
              </Typography>

              {/* OPÇÃO 1: MARCAR COMO DNF / DSQ */}
              {!runActionTarget.isDnf ? (
                <Button
                  variant="outlined"
                  color="warning"
                  fullWidth
                  onClick={async () => {
                    const target = runActionTarget
                    setRunActionTarget(null)
                    await act(
                      () => api.dnfRun(target.id),
                      `⚠️ Descida do piloto #${target.num} marcada como DNF / Desclassificado`
                    )
                  }}
                  sx={{
                    py: 1.2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Marcar como DNF / Desclassificado
                  </Typography>
                  <Typography variant="caption" sx={{ textTransform: 'none', opacity: 0.85, fontSize: '0.72rem' }}>
                    Mantém a descida gravada, mas exclui o tempo do ranking oficial.
                  </Typography>
                </Button>
              ) : (
                <Alert severity="warning" sx={{ textAlign: 'left', py: 0.5 }}>
                  Esta descida já está marcada como <strong>DNF</strong> no ranking.
                </Alert>
              )}

              {/* OPÇÃO 2: EXCLUIR DESCIDA */}
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={async () => {
                  const target = runActionTarget
                  setRunActionTarget(null)
                  await act(
                    () => api.undoRun(target.id),
                    `🗑️ Descida do piloto #${target.num} excluída. O piloto pode relargar.`
                  )
                }}
                sx={{
                  py: 1.2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Excluir Descida Definitivamente
                </Typography>
                <Typography variant="caption" sx={{ textTransform: 'none', opacity: 0.85, fontSize: '0.72rem' }}>
                  Apaga a descida por completo do sistema e permite relargar nesta especial.
                </Typography>
              </Button>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 1 }}>
              <Button
                variant="text"
                color="inherit"
                fullWidth
                onClick={() => setRunActionTarget(null)}
              >
                Voltar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* CARD PRINCIPAL DE DISPARO DE CHEGADA */}
      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <CardContent sx={{ p: 0 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
            NÚMERO DO ATLETA NA CHEGADA
          </Typography>

          <TextField
            fullWidth
            value={num}
            onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="104"
            slotProps={{
              htmlInput: {
                inputMode: 'numeric',
                pattern: '[0-9]*',
                style: {
                  textAlign: 'center',
                  fontSize: '2.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '12px 14px',
                },
              },
            }}
            sx={{ mb: 2 }}
          />

          <Alert
            severity={previewSeverity}
            sx={{
              mb: 2.5,
              borderRadius: 2,
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '1rem',
            }}
          >
            {previewMsg}
          </Alert>

          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            onClick={submit}
            startIcon={<SportsScoreRoundedIcon sx={{ fontSize: '2.4rem !important' }} />}
            sx={{
              py: 2.2,
              fontSize: '1.6rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              borderRadius: 3,
            }}
          >
            CHEGOU
          </Button>
        </CardContent>
      </Card>

      {/* NA PISTA AGORA */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
          Na pista agora ({track.length})
        </Typography>

        <List disablePadding sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {track.length === 0 && (
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhum piloto descendo a trilha nesta seleção no momento
              </Typography>
            </Card>
          )}

          {track.map((run) => {
            const r = state.riders.find((x) => x.num === run.num)
            const st = stages.find((s) => s.id === run.stageId)
            return (
              <Card
                key={run.id}
                sx={{
                  p: 1.5,
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 900,
                        width: 44,
                        height: 44,
                      }}
                    >
                      #{run.num}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                        {r?.name ?? `Piloto #${run.num}`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.6, mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={st?.name ?? 'Especial'}
                          size="small"
                          color="secondary"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                        />
                        <Chip
                          label={r?.cat ?? 'Geral'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem' }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Relógio em tempo real da descida */}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      color: 'primary.main',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    <LiveTimer start={run.start} />
                  </Box>
                </Box>

                {/* Botões de Ação para cada piloto na pista */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    onClick={() => requestDnf(run.id, run.num)}
                    sx={{ flex: 1, py: 1, fontWeight: 700 }}
                  >
                    DNF
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    size="medium"
                    onClick={() => requestFinish(run.num)}
                    startIcon={<FlagRoundedIcon />}
                    sx={{ flex: 2, py: 1, fontWeight: 800, fontSize: '1rem' }}
                  >
                    CHEGOU
                  </Button>
                </Box>
              </Card>
            )
          })}
        </List>
      </Box>

      {/* ÚLTIMAS CHEGADAS */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
          Últimas chegadas registradas
        </Typography>

        <List disablePadding sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {done.length === 0 && (
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhuma chegada concluída ainda
              </Typography>
            </Card>
          )}

          {done.map((run) => {
            const r = state.riders.find((x) => x.num === run.num)
            const st = stages.find((s) => s.id === run.stageId)
            const isDnf = run.status === 'dnf'
            return (
              <Card key={run.id} sx={{ bgcolor: 'background.paper' }}>
                <ListItem
                  secondaryAction={
                    <IconButton
                      edge="end"
                      color="inherit"
                      size="small"
                      onClick={() =>
                        setRunActionTarget({
                          id: run.id,
                          num: run.num,
                          name: r?.name ?? `Piloto #${run.num}`,
                          stageName: st?.name ?? 'Especial',
                          timeStr: isDnf ? 'DNF' : fmt(run.end! - run.start),
                          isDnf,
                        })
                      }
                      title="Gerenciar / Invalidar descida"
                      sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main' } }}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: isDnf ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: isDnf ? 'error.main' : 'secondary.main',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                      }}
                    >
                      #{run.num}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{r?.name ?? `Piloto #${run.num}`}</span>
                        <Chip
                          label={st?.name ?? 'Especial'}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {isDnf ? (
                          <Chip label="DNF" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                        ) : (
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: 'secondary.main',
                              fontSize: '1rem',
                            }}
                          >
                            {fmt(run.end! - run.start)}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={<Typography variant="caption" color="text.secondary">{`Chegou às ${clock(run.end!)} · ${r?.cat ?? 'Geral'}`}</Typography>}
                  />
                </ListItem>
              </Card>
            )
          })}
        </List>
      </Box>
    </Box>
  )
}
