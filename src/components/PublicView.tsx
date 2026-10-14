import type { AppState } from '../types'
import { LiveTimer } from './LiveTimer'
import { EnduroLeaderboard } from './EnduroLeaderboard'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
} from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'

export function PublicView({ state }: { state: AppState }) {
  // Atletas que estão descendo a trilha neste exato momento
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* SEÇÃO AO VIVO: ATLETAS NA PISTA */}
      <Card
        sx={{
          border: '1px solid',
          borderColor: onTrack.length > 0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)',
          background: onTrack.length > 0
            ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, rgba(20, 30, 43, 1) 100%)'
            : 'background.paper',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SpeedRoundedIcon sx={{ fontSize: 16 }} /> Tempo real
            </Typography>
          </Box>

          {onTrack.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">
                Nenhum atleta na pista no momento. Aguardando largada...
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 1.5,
              }}
            >
              {onTrack.map((run) => {
                const rider = state.riders.find((r) => r.num === run.num)
                const stage = state.stages.find((s) => s.id === run.stageId)
                return (
                  <Card
                    key={run.id}
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.default',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                          }}
                        >
                          #{run.num}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                            {rider?.name ?? 'Piloto'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700 }}>
                            {stage?.name ?? 'Especial'}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip label={rider?.cat ?? 'Geral'} size="small" sx={{ height: 20, fontSize: '0.68rem' }} />
                    </Box>

                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'rgba(56, 189, 248, 0.08)',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: '1.6rem',
                        fontWeight: 900,
                        color: 'primary.main',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <LiveTimer start={run.start} />
                    </Box>
                  </Card>
                )
              })}
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
