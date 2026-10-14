import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider, Stage } from '../types'
import { DEFAULT_STAGES } from '../types'
import { clock } from '../lib/time'
import {
  Box,
  Card,
  Typography,
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
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

export interface StartGridItem {
  num: string
  riderName: string
  category: string
  scheduledTimeStr: string
  scheduledEpoch: number
}

const STORAGE_GRID_KEY = 'mtb_start_grid'

export function Largada({ state, act, online }: Props) {
  const [activeStageId, setActiveStageId] = useState<string>(() => state.stages?.[0]?.id || 'stage-1')
  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const currentStage: Stage = stages.find((s) => s.id === activeStageId) || stages[0]

  // Estado da Contagem Regressiva
  const [countdownTarget, setCountdownTarget] = useState<{ rider: Rider; stage: Stage } | null>(null)
  const [count, setCount] = useState<number | 'VAI!'>(3)

  // Referências para evitar que o useEffect da contagem re-dispare se props ou estados mudarem
  const actRef = useRef(act)
  actRef.current = act
  const onlineRef = useRef(online)
  onlineRef.current = online

  // Efeito da Contagem Regressiva (3, 2, 1, VAI!) - Roda estritamente 1 vez por largada
  useEffect(() => {
    if (!countdownTarget) return

    setCount(3)
    let current = 3
    let hasFired = false

    const interval = window.setInterval(() => {
      current -= 1
      if (current === 0) {
        setCount('VAI!')
        if (!hasFired) {
          hasFired = true
          const { rider, stage } = countdownTarget
          void actRef.current(
            () => api.startRun(rider.num, stage.id).then(() => undefined),
            `🚦 #${rider.num} ${rider.name} largou na ${stage.name}!` + (onlineRef.current ? '' : ' (salvo offline)')
          )
        }
      } else if (current < 0) {
        clearInterval(interval)
        setCountdownTarget(null)
      } else {
        setCount(current)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [countdownTarget])

  const cancelCountdown = () => {
    setCountdownTarget(null)
  }

  const startCountdown = (r: Rider) => {
    if (!r.cat || r.cat === 'Sem Categoria' || r.cat.trim() === '') {
      return act(async () => {
        throw new Error(`Piloto #${r.num} (${r.name}) está sem categoria configurada. Defina uma categoria antes de largar.`)
      })
    }
    if (state.runs.some((run) => run.num === r.num && run.status === 'track')) {
      return act(async () => { throw new Error(`${r.name} já está na pista`) })
    }
    if (state.runs.some((run) => run.num === r.num && (run.stageId || stages[0]?.id) === currentStage.id && run.status !== 'track')) {
      return act(async () => { throw new Error(`${r.name} já possui descida registrada na ${currentStage.name}`) })
    }
    setCountdownTarget({ rider: r, stage: currentStage })
  }

  // ESTADO DA GRADE DE ORDEM DE LARGADA (gerenciada na aba Pilotos)
  const [gridItems, setGridItems] = useState<StartGridItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GRID_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sincronizar quando a grade for gerada/limpa em Pilotos.tsx
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_GRID_KEY)
        setGridItems(saved ? JSON.parse(saved) : [])
      } catch {
        setGridItems([])
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const [viewGridOpen, setViewGridOpen] = useState(false)

  // Mapeamento rápido da grade por número do piloto
  const gridMap = useMemo(() => {
    const map = new Map<string, { item: StartGridItem; index: number }>()
    gridItems.forEach((item, index) => {
      map.set(item.num, { item, index })
    })
    return map
  }, [gridItems])

  // Pilotos disponíveis para largar nesta especial (ordenados pela Grade se existir, ou por número)
  const availableRiders = useMemo(() => {
    const list = state.riders.filter((r) => {
      const isCurrentlyOnTrack = state.runs.some((run) => run.num === r.num && run.status === 'track')
      const hasFinishedThisStage = state.runs.some(
        (run) => run.num === r.num && (run.stageId || stages[0]?.id) === currentStage.id && run.status !== 'track'
      )
      return !isCurrentlyOnTrack && !hasFinishedThisStage
    })

    if (gridItems.length > 0) {
      list.sort((a, b) => {
        const orderA = gridMap.get(a.num)?.index ?? 999999
        const orderB = gridMap.get(b.num)?.index ?? 999999
        return orderA - orderB
      })
    } else {
      list.sort((a, b) => Number(a.num) - Number(b.num))
    }

    return list
  }, [state.riders, state.runs, stages, currentStage.id, gridItems, gridMap])

  const recent = state.runs.slice().sort((a, b) => b.start - a.start).slice(0, 8)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* CABEÇALHO */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          🚦 Controle de Largada
        </Typography>
        <Chip
          label={`${availableRiders.length} prontos para largar`}
          size="small"
          color="secondary"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      {/* SELETOR DE ESPECIAL / TRILHA ATIVA NA LARGADA */}
      <Card sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 2 }}>
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

      {/* BANNER DA GRADE DE ORDEM DE LARGADA */}
      {gridItems.length > 0 && (
        <Card
          sx={{
            p: 2,
            bgcolor: 'rgba(56, 189, 248, 0.04)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 2.5,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  bgcolor: 'rgba(56, 189, 248, 0.15)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FormatListNumberedRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Grade de Ordem de Largada Ativa
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`Início: ${gridItems[0]?.scheduledTimeStr} · ${gridItems.length} atletas ordenados (configurado na aba Pilotos)`}
                </Typography>
              </Box>
            </Box>

            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => setViewGridOpen(true)}
              startIcon={<AccessTimeRoundedIcon />}
              sx={{ fontWeight: 700, width: { xs: '100%', sm: 'auto' } }}
            >
              Ver Grade Completa
            </Button>
          </Box>
        </Card>
      )}

      {/* MODAL DE CONTAGEM REGRESSIVA EM TELA CHEIA (3, 2, 1, VAI!) */}
      <Dialog
        fullScreen
        open={Boolean(countdownTarget)}
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
          {countdownTarget && (
            <>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
                  <Chip
                    label={countdownTarget.stage.name}
                    color="secondary"
                    sx={{ fontWeight: 800 }}
                  />
                  <Chip
                    label={`CATEGORIA: ${countdownTarget.rider.cat}`}
                    color="primary"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '3.5rem', sm: '5rem' } }}>
                  #{countdownTarget.rider.num}
                </Typography>
                <Typography variant="h4" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {countdownTarget.rider.name}
                </Typography>
              </Box>

              <Box
                sx={{
                  fontSize: { xs: '7.5rem', sm: '13rem' },
                  fontWeight: 900,
                  lineHeight: 1,
                  fontFamily: 'monospace',
                  color: count === 'VAI!' ? '#4ade80' : 'primary.main',
                  textShadow: count === 'VAI!' ? '0 0 50px rgba(74, 222, 128, 0.7)' : 'none',
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

      {/* LISTA DE PILOTOS PRONTOS PARA LARGAR */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
            Pilotos prontos para largar na {currentStage.name} ({availableRiders.length})
          </Typography>
          {gridItems.length > 0 && (
            <Chip
              label="Ordenado por Grade de Largada"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.68rem', height: 20 }}
            />
          )}
        </Box>

        {availableRiders.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center', color: 'text.secondary', borderRadius: 2 }}>
            <Typography variant="body2">
              {state.riders.length === 0
                ? 'Nenhum piloto cadastrado ainda no sistema.'
                : `Todos os pilotos já largaram ou estão na pista na ${currentStage.name}.`}
            </Typography>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {availableRiders.map((r, index) => {
              const isNext = index === 0
              const gridInfo = gridMap.get(r.num)

              return (
                <Card
                  key={r.num}
                  sx={{
                    bgcolor: isNext ? 'rgba(34, 197, 94, 0.05)' : 'background.paper',
                    border: isNext ? '2px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2.5,
                    p: { xs: 1.8, sm: 2 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: isNext ? 'rgba(74, 222, 128, 0.8)' : 'rgba(56, 189, 248, 0.4)',
                    },
                  }}
                >
                  {/* ESQUERDA: AVATAR NÚMERO, NOME, CATEGORIA E HORÁRIO PREVISTO */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        bgcolor: isNext ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 189, 248, 0.12)',
                        color: isNext ? '#4ade80' : 'primary.main',
                        border: '1px solid',
                        borderColor: isNext ? 'rgba(74, 222, 128, 0.4)' : 'rgba(56, 189, 248, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      #{r.num}
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" noWrap sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                          {r.name}
                        </Typography>
                        {isNext && (
                          <Chip
                            label="PRÓXIMO A LARGAR"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 900, height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3, flexWrap: 'wrap' }}>
                        <Chip
                          label={r.cat || 'Sem Categoria'}
                          size="small"
                          color={!r.cat || r.cat === 'Sem Categoria' ? 'error' : 'default'}
                          variant={!r.cat || r.cat === 'Sem Categoria' ? 'filled' : 'outlined'}
                          sx={{ fontSize: '0.68rem', height: 20, fontWeight: 700 }}
                        />

                        {gridInfo && (
                          <Chip
                            icon={<AccessTimeRoundedIcon sx={{ fontSize: '14px !important' }} />}
                            label={`Previsto: ${gridInfo.item.scheduledTimeStr}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{
                              fontSize: '0.72rem',
                              height: 20,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* DIREITA: BOTÃO DE LARGADA DIRETA (3s) */}
                  <Button
                    variant="contained"
                    color={isNext ? 'secondary' : 'primary'}
                    onClick={() => startCountdown(r)}
                    startIcon={<PlayArrowRoundedIcon sx={{ fontSize: '1.6rem !important' }} />}
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 1.2,
                      fontWeight: 900,
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      borderRadius: 2.5,
                      flexShrink: 0,
                    }}
                  >
                    LARGAR
                  </Button>
                </Card>
              )
            })}
          </Box>
        )}
      </Box>



      {/* MODAL DE VISUALIZAÇÃO COMPLETA DA GRADE */}
      <Dialog
        open={viewGridOpen}
        onClose={() => setViewGridOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 2,
              borderRadius: 3,
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, px: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormatListNumberedRoundedIcon color="primary" /> Ordem Oficial de Largada
          </Typography>
          <Chip label={`${gridItems.length} Pilotos`} size="small" color="primary" sx={{ fontWeight: 700 }} />
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 0.5, sm: 1 }, py: 1 }}>
          <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflowX: 'hidden' }}>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                  <TableCell sx={{ fontWeight: 800, width: { xs: 52, sm: 64 }, pl: 1.5, pr: 0.5, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>POS</TableCell>
                  <TableCell sx={{ fontWeight: 800, pl: 1.5, pr: 1, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>PILOTO</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, width: { xs: 80, sm: 95 }, pr: 1.5, pl: 1, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>HORÁRIO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridItems.map((item, idx) => {
                  const isFirstOfCategory = idx === 0 || gridItems[idx - 1].category !== item.category
                  return (
                    <Fragment key={item.num}>
                      {isFirstOfCategory && (
                        <TableRow sx={{ bgcolor: 'rgba(56, 189, 248, 0.08)' }}>
                          <TableCell
                            colSpan={3}
                            sx={{
                              py: 0.8,
                              px: 1.5,
                              fontWeight: 900,
                              fontSize: '0.78rem',
                              letterSpacing: '0.04em',
                              color: 'primary.main',
                              borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                            }}
                          >
                            CATEGORIA: {item.category.toUpperCase()}
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 1.5, pr: 0.5, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                          {idx + 1}º
                        </TableCell>
                        <TableCell sx={{ pl: 1.5, pr: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                {item.riderName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                #{item.num}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'primary.light', fontSize: '0.68rem', display: { xs: 'block', sm: 'none' } }}>
                              {item.category}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.light', pr: 1.5, pl: 1, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                          {item.scheduledTimeStr}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1 }}>
          <Button variant="contained" color="primary" onClick={() => setViewGridOpen(false)} sx={{ fontWeight: 700 }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

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
