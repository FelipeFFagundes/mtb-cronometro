import { useState, useRef, useMemo, useEffect } from 'react'
import type { AppState } from '../types'
import { DEFAULT_STAGES } from '../types'
import { LiveTimer } from './LiveTimer'
import { EnduroLeaderboard } from './EnduroLeaderboard'
import { clock, fmt } from '../lib/time'
import type { StartGridItem } from './Largada'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Badge,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import DirectionsBikeRoundedIcon from '@mui/icons-material/DirectionsBikeRounded'

export function PublicView({ state }: { state: AppState }) {
  // Controle das 2 páginas públicas:
  // - 'live': Acompanhar ao vivo na pista, próximos a largar e últimas chegadas
  // - 'results': Acompanhar os resultados consolidados e grade de largada
  const [currentTab, setCurrentTab] = useState<'live' | 'results'>('live')

  const stages = state.stages && state.stages.length > 0 ? state.stages : DEFAULT_STAGES

  // Atletas que estão descendo a trilha neste exato momento
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)
  const [activeIdx, setActiveIdx] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Especial ativa para a fila de próximos a largar
  const [selectedLiveStageId, setSelectedLiveStageId] = useState<string>(() => {
    return onTrack[0]?.stageId || stages[0]?.id || 'stage-1'
  })

  // Sincroniza a especial de foco se houver piloto descendo
  useEffect(() => {
    if (onTrack.length > 0 && onTrack[0].stageId) {
      setSelectedLiveStageId(onTrack[0].stageId)
    }
  }, [onTrack])

  // Grade de largada sincronizada do localStorage
  const [gridItems, setGridItems] = useState<StartGridItem[]>(() => {
    try {
      const saved = localStorage.getItem('mtb_start_grid')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('mtb_start_grid')
        setGridItems(saved ? JSON.parse(saved) : [])
      } catch {
        setGridItems([])
      }
    }

    const handleCustomGrid = (e: Event) => {
      const customEvt = e as CustomEvent<StartGridItem[]>
      if (customEvt.detail) {
        setGridItems(customEvt.detail)
      } else {
        handleStorage()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('mtb_grid_updated', handleCustomGrid)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('mtb_grid_updated', handleCustomGrid)
    }
  }, [])

  // Mapa rápido de informações da grade por número de placa para a especial selecionada
  const gridMap = useMemo(() => {
    const map = new Map<string, { item: StartGridItem; index: number }>()
    let stageItems = gridItems.filter(
      (item) => (item.stageId || stages[0]?.id) === selectedLiveStageId
    )
    if (stageItems.length === 0) {
      stageItems = gridItems.filter((item) => !item.stageId)
    }
    stageItems.forEach((item, index) => {
      map.set(item.num, { item, index })
    })
    return map
  }, [gridItems, selectedLiveStageId, stages])

  // Próximos pilotos a largar na especial selecionada
  const nextToStart = useMemo(() => {
    const list = state.riders.filter((r) => {
      const isCurrentlyOnTrack = state.runs.some((run) => run.num === r.num && run.status === 'track')
      const hasFinishedThisStage = state.runs.some(
        (run) => run.num === r.num && (run.stageId || stages[0]?.id) === selectedLiveStageId && run.status !== 'track'
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

    return list.slice(0, 6)
  }, [state.riders, state.runs, stages, selectedLiveStageId, gridItems, gridMap])

  // Últimas chegadas registradas na pista (mais recentes primeiro)
  const recentFinishes = useMemo(() => {
    return state.runs
      .filter((r) => r.status === 'done' && r.end !== null)
      .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
      .slice(0, 5)
  }, [state.runs])

  const currentIdx = Math.min(activeIdx, Math.max(0, onTrack.length - 1))

  const scrollTo = (idx: number) => {
    setActiveIdx(idx)
    if (!carouselRef.current) return
    const target = carouselRef.current.children[idx] as HTMLElement
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }

  const handleScroll = () => {
    const el = carouselRef.current
    if (!el) return
    const scrollLeft = el.scrollLeft
    const width = el.clientWidth
    if (width > 0) {
      const newIdx = Math.round(scrollLeft / width)
      if (newIdx !== activeIdx && newIdx >= 0 && newIdx < onTrack.length) {
        setActiveIdx(newIdx)
      }
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) scrollTo(currentIdx - 1)
  }

  const handleNext = () => {
    if (currentIdx < onTrack.length - 1) scrollTo(currentIdx + 1)
  }

  const activeStage = stages.find((s) => s.id === selectedLiveStageId) || stages[0]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* SELETOR DE PÁGINAS (AO VIVO / RESULTADOS) */}
      <Paper
        elevation={0}
        sx={{
          p: 0.6,
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, val: 'live' | 'results') => setCurrentTab(val)}
          variant="fullWidth"
          sx={{
            minHeight: 46,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              borderRadius: 2.5,
              minHeight: 44,
              py: 1,
              fontWeight: 800,
              textTransform: 'none',
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              color: 'text.secondary',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.35)',
              },
            },
          }}
        >
          <Tab
            value="live"
            iconPosition="start"
            icon={
              <Badge
                color="error"
                variant={onTrack.length > 0 ? 'dot' : 'standard'}
                sx={{
                  mr: 0.5,
                  '& .MuiBadge-badge': {
                    animation: onTrack.length > 0 ? 'pulse 1.2s infinite ease-in-out' : 'none',
                  },
                }}
              >
                <SensorsRoundedIcon sx={{ fontSize: 20 }} />
              </Badge>
            }
            label={onTrack.length > 0 ? `Ao Vivo (${onTrack.length})` : 'Ao Vivo'}
          />

          <Tab
            value="results"
            iconPosition="start"
            icon={<EmojiEventsRoundedIcon sx={{ fontSize: 20, mr: 0.5 }} />}
            label="Resultados"
          />
        </Tabs>
      </Paper>

      {/* ========================================================
          PÁGINA 1: AO VIVO (Pista, Próximos a Largar, Últimas Chegadas)
          ======================================================== */}
      {currentTab === 'live' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* 1. SEÇÃO AO VIVO: ATLETAS NA PISTA */}
          <Card
            sx={{
              border: '1px solid',
              borderColor: onTrack.length > 0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              background: onTrack.length > 0
                ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, rgba(20, 30, 43, 1) 100%)'
                : 'background.paper',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              {/* TOPO COM STATUS E CONTROLES DO CARROSSEL */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={
                      <FiberManualRecordIcon
                        sx={{
                          fontSize: '12px !important',
                          color: onTrack.length > 0 ? '#ef4444 !important' : 'rgba(255, 255, 255, 0.3) !important',
                          animation: onTrack.length > 0 ? 'pulse 1.2s infinite ease-in-out' : 'none',
                        }}
                      />
                    }
                    label={`AO VIVO NA PISTA (${onTrack.length})`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      bgcolor: onTrack.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: onTrack.length > 0 ? 'error.main' : 'text.secondary',
                      border: '1px solid',
                      borderColor: onTrack.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                    }}
                  />
                </Box>

                {onTrack.length > 1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      {currentIdx + 1} de {onTrack.length}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handlePrev}
                      disabled={currentIdx === 0}
                      sx={{
                        p: 0.5,
                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' },
                      }}
                    >
                      <ChevronLeftRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleNext}
                      disabled={currentIdx >= onTrack.length - 1}
                      sx={{
                        p: 0.5,
                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' },
                      }}
                    >
                      <ChevronRightRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>

              {onTrack.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                    Pista livre no momento
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum atleta na trilha agora. Aguardando a próxima largada...
                  </Typography>
                </Box>
              ) : (
                /* CARROSSEL HORIZONTAL COM TAMANHO FIXO DE 1 CARD */
                <Box
                  ref={carouselRef}
                  onScroll={handleScroll}
                  sx={{
                    display: 'flex',
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    gap: 2,
                    pb: 0.5,
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  {onTrack.map((run) => {
                    const rider = state.riders.find((r) => r.num === run.num)
                    const stage = state.stages.find((s) => s.id === run.stageId)
                    return (
                      <Box
                        key={run.id}
                        sx={{
                          minWidth: '100%',
                          flexShrink: 0,
                          scrollSnapAlign: 'start',
                        }}
                      >
                        <Card
                          sx={{
                            p: 2,
                            bgcolor: 'background.default',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: 2,
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 2,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                            <Avatar
                              sx={{
                                width: 44,
                                height: 44,
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                fontWeight: 900,
                                fontSize: '1rem',
                                flexShrink: 0,
                              }}
                            >
                              #{run.num}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                  {rider?.name ?? 'Piloto'}
                                </Typography>
                                <Chip label={rider?.cat ?? 'Geral'} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700, display: 'block', mt: 0.3 }}>
                                {stage?.name ?? 'Especial'} · Largou às {clock(run.start)}
                              </Typography>
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              px: 3,
                              py: 1,
                              borderRadius: 2,
                              bgcolor: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontSize: { xs: '1.8rem', sm: '2.2rem' },
                              fontWeight: 900,
                              color: 'primary.main',
                              letterSpacing: '0.04em',
                              flexShrink: 0,
                            }}
                          >
                            <LiveTimer start={run.start} />
                          </Box>
                        </Card>
                      </Box>
                    )
                  })}
                </Box>
              )}

              {/* INDICADORES EM PONTOS QUANDO HOUVER VÁRIOS ATLETAS */}
              {onTrack.length > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8, mt: 1.5 }}>
                  {onTrack.map((_, idx) => (
                    <Box
                      key={idx}
                      onClick={() => scrollTo(idx)}
                      sx={{
                        width: currentIdx === idx ? 20 : 6,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: currentIdx === idx ? 'primary.main' : 'rgba(255, 255, 255, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 2. PRÓXIMOS A LARGAR */}
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DirectionsBikeRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.8rem', color: 'text.secondary' }}>
                    Próximos a Largar
                  </Typography>
                </Box>

                {/* Alternador de Especial caso haja mais de 1 */}
                {stages.length > 1 && (
                  <ToggleButtonGroup
                    value={selectedLiveStageId}
                    exclusive
                    onChange={(_, val) => {
                      if (val) setSelectedLiveStageId(val)
                    }}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        py: 0.2,
                        px: 1,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    {stages.map((st) => (
                      <ToggleButton key={st.id} value={st.id}>
                        {st.name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
              </Box>

              {nextToStart.length === 0 ? (
                <Box sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">
                    Todos os pilotos já largaram na {activeStage.name}.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {nextToStart.map((rider, idx) => {
                    const gridInfo = gridMap.get(rider.num)?.item

                    return (
                      <Box
                        key={rider.num}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              bgcolor: 'rgba(56, 189, 248, 0.12)',
                              color: 'primary.main',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            #{rider.num}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                              {rider.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rider.cat || 'Geral'}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          {gridInfo ? (
                            <Chip
                              icon={<AccessTimeRoundedIcon sx={{ fontSize: '13px !important' }} />}
                              label={gridInfo.scheduledTimeStr}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                bgcolor: 'rgba(56, 189, 248, 0.1)',
                                color: 'primary.light',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                              }}
                            />
                          ) : (
                            <Chip
                              label={`${idx + 1}º da fila`}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(255, 255, 255, 0.06)',
                                color: 'text.secondary',
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 3. ÚLTIMAS CHEGADAS REGISTRADAS */}
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <FlagRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.8rem', color: 'text.secondary' }}>
                  Últimas Chegadas
                </Typography>
              </Box>

              {recentFinishes.length === 0 ? (
                <Box sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">
                    Nenhuma descida finalizada registrada ainda.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {recentFinishes.map((run) => {
                    const rider = state.riders.find((r) => r.num === run.num)
                    const stage = state.stages.find((s) => s.id === run.stageId)
                    const duration = (run.end ?? 0) - run.start

                    return (
                      <Box
                        key={run.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              bgcolor: 'rgba(34, 197, 94, 0.12)',
                              color: 'success.main',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                            }}
                          >
                            #{run.num}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                              {rider?.name ?? 'Piloto'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stage?.name ?? 'Especial'} · {rider?.cat ?? 'Geral'}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: 'success.main',
                              fontSize: '0.95rem',
                            }}
                          >
                            {fmt(duration)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {run.end ? clock(run.end) : ''}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ========================================================
          PÁGINA 2: RESULTADOS OFICIAIS & GRADE DE LARGADA
          ======================================================== */}
      {currentTab === 'results' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <EnduroLeaderboard
            state={state}
            title="Resultados Oficiais"
            subtitle="SPET Enduro & DH Series · Classificação Consolidada e Grade de Largada"
          />
        </Box>
      )}
    </Box>
  )
}
