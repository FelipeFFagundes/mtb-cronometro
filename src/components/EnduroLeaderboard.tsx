import { useState } from 'react'
import type { AppState } from '../types'
import { buildEnduroRanking } from '../lib/ranking'
import { fmt } from '../lib/time'
import {
  Box,
  Typography,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Card,
  Avatar,
} from '@mui/material'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'

interface Props {
  state: AppState
  title?: string
  subtitle?: string
}

export function EnduroLeaderboard({
  state,
  title = 'Classificação Oficial de Enduro',
  subtitle = 'Tempos acumulados e parciais por especial',
}: Props) {
  const [cat, setCat] = useState('Todas')
  const [selectedStageId, setSelectedStageId] = useState<string>('all')

  const categories = state.categories || []
  const { rows, stages } = buildEnduroRanking(state, cat, selectedStageId)

  const isOverall = selectedStageId === 'all'
  const currentStageObj = stages.find((s) => s.id === selectedStageId)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* CABEÇALHO */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsRoundedIcon sx={{ color: '#f59e0b' }} /> {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle} · {stages.length} {stages.length === 1 ? 'Especial' : 'Especiais'}
          </Typography>
        </Box>

        {/* SELETOR DE VISÃO: GERAL ACUMULADO VS ESPECIAL INDIVIDUAL */}
        <Box sx={{ overflowX: 'auto', maxWidth: '100%', pb: 0.5 }}>
          <ToggleButtonGroup
            value={selectedStageId}
            exclusive
            onChange={(_, val) => val && setSelectedStageId(val)}
            size="small"
            sx={{
              bgcolor: 'background.paper',
              '& .MuiToggleButton-root': {
                fontWeight: 700,
                fontSize: '0.78rem',
                py: 0.6,
                px: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              },
            }}
          >
            <ToggleButton value="all">
              🏁 Geral Acumulado
            </ToggleButton>
            {stages.map((st) => (
              <ToggleButton key={st.id} value={st.id}>
                {st.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* FILTRO DE CATEGORIAS */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterListRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '::-webkit-scrollbar': { display: 'none' } }}>
          {['Todas', ...categories].map((c) => {
            const isSelected = c === cat
            return (
              <Chip
                key={c}
                label={c}
                onClick={() => setCat(c)}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  fontWeight: 700,
                  px: 0.5,
                  bgcolor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? 'primary.contrastText' : 'text.primary',
                }}
              />
            )
          })}
        </Box>
      </Box>

      {/* VISÃO EM CARDS PARA DISPOSITIVOS MÓVEIS (XS/SM) - ZERO SCROLL LATERAL */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {rows.length === 0 && (
          <Card sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="body2" color="text.secondary">
              Nenhum atleta registrado nesta categoria
            </Typography>
          </Card>
        )}

        {rows.map((row, i) => {
          const isFirst = i === 0
          const isSecond = i === 1
          const isThird = i === 2

          const posDisplay = isFirst ? '🥇 1º Lugar' : isSecond ? '🥈 2º Lugar' : isThird ? '🥉 3º Lugar' : `${i + 1}º Lugar`
          const cardBorder = isFirst
            ? '2px solid rgba(245, 158, 11, 0.4)'
            : isSecond
            ? '1px solid rgba(203, 213, 225, 0.3)'
            : isThird
            ? '1px solid rgba(180, 83, 9, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)'

          const cardBg = isFirst
            ? 'rgba(245, 158, 11, 0.04)'
            : isSecond
            ? 'rgba(203, 213, 225, 0.02)'
            : isThird
            ? 'rgba(180, 83, 9, 0.02)'
            : 'background.paper'

          if (isOverall) {
            const hasTime = row.completedCount > 0 && !row.hasDnf
            return (
              <Card
                key={row.rider.num}
                sx={{
                  bgcolor: cardBg,
                  border: cardBorder,
                  borderRadius: 2.5,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                {/* TOPO DO CARD: POSIÇÃO, NOME, NÚMERO E CATEGORIA */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 900,
                          color: isFirst ? '#f59e0b' : isSecond ? '#cbd5e1' : isThird ? '#d97706' : 'text.secondary',
                        }}
                      >
                        {posDisplay}
                      </Typography>
                      <Chip label={row.rider.cat} size="small" sx={{ fontSize: '0.68rem', height: 18 }} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 800, mt: 0.3, fontSize: '1.05rem' }}>
                      {row.rider.name}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      bgcolor: 'rgba(56, 189, 248, 0.12)',
                      color: 'primary.main',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    #{row.rider.num}
                  </Avatar>
                </Box>

                {/* TEMPO TOTAL E DIFERENÇA GERAL */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'background.default',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                      TEMPO TOTAL ({row.completedCount}/{stages.length} esp.)
                    </Typography>
                    {row.hasDnf ? (
                      <Chip label="DNF GERAL" size="small" color="error" sx={{ fontWeight: 800, mt: 0.2 }} />
                    ) : hasTime ? (
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 900,
                          color: isFirst ? '#4ade80' : 'text.primary',
                          lineHeight: 1.2,
                        }}
                      >
                        {fmt(row.totalTime)}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Pendente
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                      GAP LÍDER
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: isFirst ? 'text.secondary' : 'warning.main',
                      }}
                    >
                      {isFirst || !hasTime ? '—' : `+${fmt(row.totalGap)}`}
                    </Typography>
                  </Box>
                </Box>

                {/* PARCIAIS DE TODAS AS ESPECIAIS EM GRID RESPONSIVO (2 POR LINHA) */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {stages.map((st) => {
                    const perf = row.stagePerformances[st.id]
                    return (
                      <Box
                        key={st.id}
                        sx={{
                          p: 1,
                          bgcolor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 1.5,
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, fontSize: '0.68rem' }}
                          title={st.name}
                        >
                          {st.name}
                        </Typography>
                        {perf?.status === 'done' && perf.time != null ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.3 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.88rem' }}>
                              {fmt(perf.time)}
                            </Typography>
                            {perf.stageRank && (
                              <Typography variant="caption" sx={{ color: perf.stageRank === 1 ? '#f59e0b' : 'text.secondary', fontSize: '0.68rem', fontWeight: 700 }}>
                                {perf.stageRank}º
                              </Typography>
                            )}
                          </Box>
                        ) : perf?.status === 'dnf' ? (
                          <Chip label="DNF" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', mt: 0.3 }} />
                        ) : perf?.status === 'track' ? (
                          <Chip label="Na pista" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', mt: 0.3 }} />
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
                            —
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Card>
            )
          } else {
            // Visualização móvel em Especial isolada
            const perf = row.stagePerformances[selectedStageId]
            const isDone = perf?.status === 'done' && perf.time != null
            return (
              <Card
                key={row.rider.num}
                sx={{
                  bgcolor: cardBg,
                  border: cardBorder,
                  borderRadius: 2.5,
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      bgcolor: isFirst ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: isFirst ? '#f59e0b' : 'primary.main',
                    }}
                  >
                    #{row.rider.num}
                  </Avatar>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          color: isFirst ? '#f59e0b' : isSecond ? '#cbd5e1' : isThird ? '#d97706' : 'text.secondary',
                        }}
                      >
                        {posDisplay}
                      </Typography>
                      <Chip label={row.rider.cat} size="small" sx={{ fontSize: '0.68rem', height: 18 }} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>
                      {row.rider.name}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  {isDone ? (
                    <>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 900,
                          fontSize: '1.1rem',
                          color: isFirst ? '#4ade80' : 'text.primary',
                        }}
                      >
                        {fmt(perf.time!)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isFirst ? 'text.secondary' : 'warning.main',
                          display: 'block',
                        }}
                      >
                        {isFirst || perf.stageGap == null ? 'Líder' : `+${fmt(perf.stageGap)}`}
                      </Typography>
                    </>
                  ) : perf?.status === 'dnf' ? (
                    <Chip label="DNF" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </Box>
              </Card>
            )
          }
        })}
      </Box>

      {/* TABELA DE CLASSIFICAÇÃO PARA DESKTOP/TABLET (MD+) */}
      <TableContainer
        component={Paper}
        square
        sx={{
          display: { xs: 'none', md: 'block' },
          borderRadius: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(56, 189, 248, 0.35) rgba(255, 255, 255, 0.02)',
          '&::-webkit-scrollbar': {
            height: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            mx: 1.5,
            mb: 0.5,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(56, 189, 248, 0.35)',
            '&:hover': {
              bgcolor: 'rgba(56, 189, 248, 0.7)',
            },
          },
        }}
      >
        <Table size="small" sx={{ minWidth: isOverall && stages.length > 1 ? 650 : '100%' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
              <TableCell sx={{ fontWeight: 800, width: 50, color: 'text.secondary' }}>POS</TableCell>
              <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>PILOTO</TableCell>
              <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>CAT</TableCell>

              {/* Se estiver no Geral Acumulado, exibe colunas para cada especial */}
              {isOverall ? (
                <>
                  {stages.map((st) => (
                    <TableCell
                      key={st.id}
                      align="right"
                      sx={{ fontWeight: 800, color: 'primary.light', whiteSpace: 'nowrap' }}
                    >
                      <Tooltip title={st.name} arrow>
                        <span>{st.name.length > 12 ? `${st.name.slice(0, 10)}…` : st.name}</span>
                      </Tooltip>
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'secondary.main', minWidth: 100 }}>
                    TOTAL GERAL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', width: 90 }}>
                    DIFERENÇA
                  </TableCell>
                </>
              ) : (
                /* Se estiver em uma especial isolada */
                <>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.light' }}>
                    TEMPO ({currentStageObj?.name ?? 'Especial'})
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', width: 90 }}>
                    DIFERENÇA
                  </TableCell>
                </>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isOverall ? 4 + stages.length : 5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  Nenhum atleta registrado nesta categoria
                </TableCell>
              </TableRow>
            )}

            {rows.map((row, i) => {
              const isFirst = i === 0
              const isSecond = i === 1
              const isThird = i === 2

              // Destaques de pódio
              const posDisplay = isFirst ? '🥇 1º' : isSecond ? '🥈 2º' : isThird ? '🥉 3º' : `${i + 1}º`
              const rowBg = isFirst
                ? 'rgba(245, 158, 11, 0.08)'
                : isSecond
                ? 'rgba(203, 213, 225, 0.05)'
                : isThird
                ? 'rgba(180, 83, 9, 0.05)'
                : 'transparent'

              if (isOverall) {
                const hasTime = row.completedCount > 0 && !row.hasDnf
                return (
                  <TableRow
                    key={row.rider.num}
                    sx={{
                      bgcolor: rowBg,
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 800, fontSize: isFirst || isSecond || isThird ? '1.05rem' : '0.9rem' }}>
                      {posDisplay}
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {row.rider.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          #{row.rider.num}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip label={row.rider.cat} size="small" sx={{ fontSize: '0.68rem', height: 20 }} />
                    </TableCell>

                    {/* Tempos por especial */}
                    {stages.map((st) => {
                      const perf = row.stagePerformances[st.id]
                      return (
                        <TableCell key={st.id} align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {perf?.status === 'done' && perf.time != null ? (
                            <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem' }}>
                                {fmt(perf.time)}
                              </Typography>
                              {perf.stageRank && (
                                <Typography variant="caption" sx={{ color: perf.stageRank === 1 ? '#f59e0b' : 'text.secondary', fontSize: '0.68rem' }}>
                                  ({perf.stageRank}º)
                                </Typography>
                              )}
                            </Box>
                          ) : perf?.status === 'dnf' ? (
                            <Chip label="DNF" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                          ) : perf?.status === 'track' ? (
                            <Chip label="Pista" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      )
                    })}

                    {/* Tempo Total Acumulado */}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.hasDnf ? (
                        <Chip label="DNF GERAL" size="small" color="error" sx={{ fontWeight: 800 }} />
                      ) : hasTime ? (
                        <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 900,
                              fontSize: '1.05rem',
                              color: isFirst ? '#4ade80' : 'text.primary',
                            }}
                          >
                            {fmt(row.totalTime)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {row.completedCount}/{stages.length} esp.
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Pendente
                        </Typography>
                      )}
                    </TableCell>

                    {/* Gap para o líder */}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isFirst ? 'text.secondary' : 'warning.main',
                        }}
                      >
                        {isFirst || !hasTime ? '—' : `+${fmt(row.totalGap)}`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              } else {
                // Tabela para Especial isolada
                const perf = row.stagePerformances[selectedStageId]
                const isDone = perf?.status === 'done' && perf.time != null
                return (
                  <TableRow
                    key={row.rider.num}
                    sx={{
                      bgcolor: rowBg,
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 800 }}>{posDisplay}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.rider.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          #{row.rider.num}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={row.rider.cat} size="small" sx={{ fontSize: '0.68rem', height: 20 }} />
                    </TableCell>
                    <TableCell align="right">
                      {isDone ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '1rem',
                            color: isFirst ? '#4ade80' : 'text.primary',
                          }}
                        >
                          {fmt(perf.time!)}
                        </Typography>
                      ) : perf?.status === 'dnf' ? (
                        <Chip label="DNF" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isFirst ? 'text.secondary' : 'warning.main',
                        }}
                      >
                        {isFirst || !isDone || perf.stageGap == null ? '—' : `+${fmt(perf.stageGap)}`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              }
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Regra oficial de Enduro: tempo acumulado pela <strong>soma de todas as especiais concluídas</strong>.
        </Typography>
        <Chip
          icon={<RouteRoundedIcon sx={{ fontSize: '14px !important' }} />}
          label={`${stages.length} Especiais no Percurso`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
      </Box>
    </Box>
  )
}
