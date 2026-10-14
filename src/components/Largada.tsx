import { useState, useEffect, useRef } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock } from '../lib/time'
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

export function Largada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const [countdownRider, setCountdownRider] = useState<Rider | null>(null)
  const [count, setCount] = useState<number | 'VAI!'>(3)
  const timerRef = useRef<number | undefined>(undefined)

  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const [activeStageId, setActiveStageId] = useState<string>(() => stages[0]?.id || 'stage-1')

  const currentStage = stages.find((s) => s.id === activeStageId) || stages[0]

  const value = num.trim()
  const rider = state.riders.find((r) => r.num === value)
  const onTrack = state.runs.some((r) => r.num === value && r.status === 'track')
  const alreadyDoneThisStage = state.runs.some(
    (r) => r.num === value && (r.stageId || stages[0]?.id) === currentStage.id && r.status === 'done'
  )

  let previewMsg = `Digite o número ou selecione um piloto para a ${currentStage.name}`
  let previewSeverity: 'info' | 'success' | 'error' | 'warning' = 'info'
  if (value) {
    if (!rider) {
      previewMsg = `Piloto #${value} não encontrado`
      previewSeverity = 'error'
    } else if (onTrack) {
      previewMsg = `${rider.name} já está na pista!`
      previewSeverity = 'error'
    } else if (alreadyDoneThisStage) {
      previewMsg = `Atenção: ${rider.name} já completou a ${currentStage.name}`
      previewSeverity = 'warning'
    } else {
      previewMsg = `${rider.name} · ${rider.cat}`
      previewSeverity = 'success'
    }
  }

  // Efeito da Contagem Regressiva em Tela Cheia (3, 2, 1, VAI!)
  useEffect(() => {
    if (!countdownRider) return

    setCount(3)
    let current = 3

    timerRef.current = window.setInterval(() => {
      current -= 1
      if (current === 0) {
        setCount('VAI!')
        // Dispara a largada exata no momento do "VAI!"
        void act(
          () => api.startRun(countdownRider.num, currentStage.id).then(() => undefined),
          `🚦 #${countdownRider.num} ${countdownRider.name} largou na ${currentStage.name}!` + (online ? '' : ' (salvo offline)')
        )
      } else if (current < 0) {
        clearInterval(timerRef.current)
        setCountdownRider(null)
      } else {
        setCount(current)
      }
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [countdownRider, act, online, currentStage])

  const cancelCountdown = () => {
    clearInterval(timerRef.current)
    setCountdownRider(null)
  }

  const startCountdown = (r: Rider) => {
    if (state.runs.some((run) => run.num === r.num && run.status === 'track')) {
      return act(async () => { throw new Error(`${r.name} já está na pista`) })
    }
    setNum('')
    setCountdownRider(r)
  }

  const submit = () => {
    if (!value) return act(async () => { throw new Error('Informe ou selecione um piloto') })
    if (!rider) return act(async () => { throw new Error(`Piloto #${value} não encontrado`) })
    if (onTrack) return act(async () => { throw new Error(`${rider.name} já está na pista`) })
    startCountdown(rider)
  }

  // Pilotos disponíveis para largar nesta especial (não estão na pista e não concluíram esta especial ainda)
  const availableRiders = state.riders
    .filter((r) => {
      const isCurrentlyOnTrack = state.runs.some((run) => run.num === r.num && run.status === 'track')
      const hasFinishedThisStage = state.runs.some(
        (run) => run.num === r.num && (run.stageId || stages[0]?.id) === currentStage.id && run.status === 'done'
      )
      return !isCurrentlyOnTrack && !hasFinishedThisStage
    })
    .sort((a, b) => Number(a.num) - Number(b.num))

  const recent = state.runs.slice().sort((a, b) => b.start - a.start).slice(0, 8)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          🚦 Controle de Largada
        </Typography>
        <Chip
          label={`${availableRiders.length} prontos`}
          size="small"
          color="secondary"
          variant="outlined"
        />
      </Box>

      {/* SELETOR DE ESPECIAL / TRILHA ATIVA NA LARGADA */}
      <Card sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <RouteRoundedIcon color="primary" sx={{ fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Especial / Trilha de Largada
          </Typography>
        </Box>

        <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
          <ToggleButtonGroup
            value={activeStageId}
            exclusive
            onChange={(_, val) => val && setActiveStageId(val)}
            size="small"
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                fontWeight: 700,
                fontSize: '0.82rem',
                py: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                '&.Mui-selected': {
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  fontWeight: 900,
                  '&:hover': { bgcolor: 'secondary.dark' },
                },
              },
            }}
          >
            {stages.map((st) => (
              <ToggleButton key={st.id} value={st.id}>
                {st.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Card>

      {/* MODAL DE CONTAGEM REGRESSIVA EM TELA CHEIA */}
      <Dialog
        fullScreen
        open={Boolean(countdownRider)}
        onClose={cancelCountdown}
        slotProps={{
          paper: {
            sx: {
              bgcolor: count === 'VAI!' ? '#052e16' : '#0b1118',
              transition: 'background-color 0.25s ease',
            },
          },
        }}
      >
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 3, sm: 6 },
            textAlign: 'center',
          }}
        >
          {countdownRider && (
            <>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
                  <Chip
                    label={currentStage.name}
                    color="secondary"
                    sx={{ fontWeight: 800 }}
                  />
                  <Chip
                    label={`CATEGORIA: ${countdownRider.cat}`}
                    color="primary"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '3.2rem', sm: '4.8rem' } }}>
                  #{countdownRider.num}
                </Typography>
                <Typography variant="h4" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {countdownRider.name}
                </Typography>
              </Box>

              <Box
                sx={{
                  fontSize: { xs: '7rem', sm: '12rem' },
                  fontWeight: 900,
                  lineHeight: 1,
                  fontFamily: 'monospace',
                  color: count === 'VAI!' ? '#4ade80' : 'primary.main',
                  textShadow: count === 'VAI!' ? '0 0 40px rgba(74, 222, 128, 0.6)' : 'none',
                  animation: 'pulse 1s infinite alternate',
                }}
              >
                {count}
              </Box>

              <Button
                variant="outlined"
                color="error"
                size="large"
                startIcon={<CloseRoundedIcon />}
                onClick={cancelCountdown}
                sx={{ py: 1.5, px: 4, borderRadius: 3, fontWeight: 700, fontSize: '1.1rem' }}
              >
                Cancelar Largada
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CARD PRINCIPAL DE DISPARO */}
      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              NÚMERO DO ATLETA
            </Typography>
            <Chip
              label={`Largando na: ${currentStage.name}`}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Box>

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
            color="secondary"
            size="large"
            onClick={submit}
            startIcon={<PlayArrowRoundedIcon sx={{ fontSize: '2.4rem !important' }} />}
            sx={{
              py: 2.2,
              fontSize: '1.6rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              borderRadius: 3,
            }}
          >
            LARGAR NA {currentStage.name.toUpperCase()}
          </Button>
        </CardContent>
      </Card>

      {/* GRID DE PILOTOS PRONTOS PARA LARGAR NA ESPECIAL */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
          Prontos para largar na {currentStage.name} ({availableRiders.length})
        </Typography>

        {availableRiders.length === 0 ? (
          <Card sx={{ p: 3, textAlign: 'center', color: 'text.secondary', mt: 1 }}>
            <Typography variant="body2">
              {state.riders.length === 0
                ? 'Nenhum piloto cadastrado ainda'
                : `Todos os pilotos já largaram ou estão na pista na ${currentStage.name}`}
            </Typography>
          </Card>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              gap: 1.5,
              mt: 1,
            }}
          >
            {availableRiders.map((r) => {
              const isSelected = value === r.num
              return (
                <Card
                  key={r.num}
                  sx={{
                    border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    bgcolor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'background.paper',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <CardActionArea
                    onClick={() => setNum(r.num)}
                    onDoubleClick={() => startCountdown(r)}
                    sx={{ p: 1.5 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        #{r.num}
                      </Typography>
                      <Chip
                        label={r.cat}
                        size="small"
                        sx={{ fontSize: '0.68rem', height: 20 }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600, color: 'text.primary' }}
                      title={r.name}
                    >
                      {r.name}
                    </Typography>
                  </CardActionArea>
                </Card>
              )
            })}
          </Box>
        )}
      </Box>

      {/* ÚLTIMAS LARGADAS */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
          Últimas largadas realizadas
        </Typography>

        <List disablePadding sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recent.length === 0 && (
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhuma largada realizada ainda
              </Typography>
            </Card>
          )}

          {recent.map((run) => {
            const r = state.riders.find((x) => x.num === run.num)
            const st = stages.find((s) => s.id === run.stageId)
            const isTrack = run.status === 'track'
            return (
              <Card key={run.id} sx={{ bgcolor: 'background.paper' }}>
                <ListItem
                  secondaryAction={
                    isTrack && (
                      <IconButton
                        edge="end"
                        color="error"
                        size="small"
                        onClick={() => void act(() => api.undoRun(run.id), `Largada do piloto #${run.num} desfeita`)}
                        title="Desfazer largada"
                      >
                        <UndoRoundedIcon fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: isTrack ? 'secondary.main' : 'rgba(255, 255, 255, 0.08)',
                        color: isTrack ? '#052e16' : 'text.primary',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                      }}
                    >
                      #{run.num}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {r?.name ?? `Piloto #${run.num}`}
                        </Typography>
                        <Chip
                          label={st?.name ?? 'Especial'}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {`Largou às ${clock(run.start)} · ${r?.cat ?? 'Geral'}`}
                      </Typography>
                    }
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
