import { useState, useRef } from 'react'
import type { AppState } from '../types'
import { LiveTimer } from './LiveTimer'
import { EnduroLeaderboard } from './EnduroLeaderboard'
import { clock } from '../lib/time'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'

export function PublicView({ state }: { state: AppState }) {
  // Atletas que estão descendo a trilha neste exato momento
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)
  const [activeIdx, setActiveIdx] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const currentIdx = Math.min(activeIdx, Math.max(0, onTrack.length - 1))

  const scrollTo = (idx: number) => {
    setActiveIdx(idx)
    if (!carouselRef.current) return
    const target = carouselRef.current.children[idx] as HTMLElement
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) scrollTo(currentIdx - 1)
  }

  const handleNext = () => {
    if (currentIdx < onTrack.length - 1) scrollTo(currentIdx + 1)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* SEÇÃO AO VIVO: ATLETAS NA PISTA (TAMANHO DE 1 CARD COM CARROSSEL HORIZONTAL) */}
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
            <Box sx={{ py: 2.5, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">
                Nenhum atleta na pista no momento. Aguardando largada...
              </Typography>
            </Box>
          ) : (
            /* CARROSSEL HORIZONTAL COM TAMANHO FIXO DE 1 CARD */
            <Box
              ref={carouselRef}
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

      {/* SEÇÃO DE RESULTADOS & CLASSIFICAÇÃO ENDURO */}
      <EnduroLeaderboard
        state={state}
        title="Classificação Oficial"
        subtitle="Enduro MTB Series · Tempos Acumulados"
      />
    </Box>
  )
}
