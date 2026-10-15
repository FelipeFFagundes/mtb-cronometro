import { useState, useEffect, Fragment } from 'react'
import type { AppState, StartGridItem } from '../types'
import { buildEnduroRanking } from '../lib/ranking'
import { fmt } from '../lib/time'
import {
  Box,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardActionArea,
  Avatar,
  Collapse,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'

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
  const [expandedNums, setExpandedNums] = useState<Set<string>>(new Set())

  const [viewGridOpen, setViewGridOpen] = useState(false)
  const [viewGridStageFilter, setViewGridStageFilter] = useState<string>('all')
  const [gridItems, setGridItems] = useState<StartGridItem[]>(() => {
    try {
      const saved = localStorage.getItem('mtb_start_grid')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sincronizar com a grade gerada na aba Pilotos
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('mtb_start_grid')
        setGridItems(saved ? JSON.parse(saved) : [])
      } catch {
        setGridItems([])
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const categories = state.categories || []
  const { rows, stages } = buildEnduroRanking(state, cat, selectedStageId)

  const isOverall = selectedStageId === 'all'

  const toggleExpand = (num: string) => {
    setExpandedNums((prev) => {
      const next = new Set(prev)
      if (next.has(num)) {
        next.delete(num)
      } else {
        next.add(num)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedNums(new Set(rows.map((r) => r.rider.num)))
  }

  const collapseAll = () => {
    setExpandedNums(new Set())
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* CABEÇALHO */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
        }}
      >
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

      {/* FILTRO DE CATEGORIAS (DROPDOWN) E BOTÃO DE EXPANDIR/RECOLHER */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <FormControl
          size="small"
          sx={{
            minWidth: { xs: '100%', sm: 220 },
            bgcolor: 'background.paper',
            borderRadius: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontWeight: 700,
              fontSize: '0.85rem',
            },
          }}
        >
          <InputLabel id="category-filter-select-label" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Categoria
          </InputLabel>
          <Select
            labelId="category-filter-select-label"
            id="category-filter-select"
            value={cat}
            label="Categoria"
            onChange={(e) => setCat(e.target.value)}
            startAdornment={
              <FilterListRoundedIcon sx={{ fontSize: 18, color: 'primary.main', mr: 1, ml: -0.5 }} />
            }
          >
            <MenuItem value="Todas" sx={{ fontWeight: 700 }}>
              🏁 Todas as Categorias
            </MenuItem>
            {categories.map((c) => (
              <MenuItem key={c} value={c} sx={{ fontWeight: 600 }}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {gridItems.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => setViewGridOpen(true)}
              startIcon={<AccessTimeRoundedIcon />}
              sx={{
                fontWeight: 700,
                fontSize: '0.78rem',
                borderRadius: 2,
                py: 0.5,
              }}
            >
              Grade de Largada
            </Button>
          )}

          {rows.length > 0 && (
            <Chip
              label={expandedNums.size === rows.length ? 'Recolher Todos' : 'Expandir Todos'}
              size="small"
              variant="outlined"
              onClick={expandedNums.size === rows.length ? collapseAll : expandAll}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
              }}
            />
          )}
        </Box>
      </Box>

      {/* LISTA DE CARDS EXPANSÍVEIS (WEB E MOBILE) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rows.length === 0 && (
          <Card sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Nenhum atleta registrado nesta categoria
            </Typography>
          </Card>
        )}

        {rows.map((row, i) => {
          const isFirst = i === 0
          const isSecond = i === 1
          const isThird = i === 2
          const isExpanded = expandedNums.has(row.rider.num)

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
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: isFirst ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.4)',
                  },
                }}
              >
                {/* CABEÇALHO DO CARD (SEMPRE VISÍVEL E CLICÁVEL) */}
                <CardActionArea
                  onClick={() => toggleExpand(row.rider.num)}
                  sx={{
                    p: { xs: 1.8, sm: 2 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  {/* LADO ESQUERDO: POSIÇÃO, AVATAR, NOME E CATEGORIA */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    {/* Badge Posição */}
                    <Box
                      sx={{
                        minWidth: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isFirst
                          ? 'rgba(245, 158, 11, 0.18)'
                          : isSecond
                          ? 'rgba(203, 213, 225, 0.14)'
                          : isThird
                          ? 'rgba(180, 83, 9, 0.14)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isFirst
                          ? '#f59e0b'
                          : isSecond
                          ? '#cbd5e1'
                          : isThird
                          ? '#d97706'
                          : 'text.secondary',
                        fontWeight: 900,
                        fontSize: isFirst || isSecond || isThird ? '1.1rem' : '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `${i + 1}º`}
                    </Box>

                    {/* Avatar Número */}
                    <Avatar
                      sx={{
                        width: { xs: 34, sm: 38 },
                        height: { xs: 34, sm: 38 },
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        bgcolor: isFirst ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                        color: isFirst ? '#f59e0b' : 'primary.main',
                        border: '1px solid',
                        borderColor: isFirst ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      #{row.rider.num}
                    </Avatar>

                    {/* Nome & Categoria */}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body1"
                        noWrap
                        sx={{ fontWeight: 800, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}
                        title={row.rider.name}
                      >
                        {row.rider.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
                        <Chip
                          label={row.rider.cat}
                          size="small"
                          sx={{
                            fontSize: '0.68rem',
                            height: 19,
                            fontWeight: 700,
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {row.completedCount}/{stages.length} esp.
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* LADO DIREITO: TEMPO TOTAL, GAP E CHEVRON */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 }, flexShrink: 0 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' }}
                      >
                        TEMPO TOTAL
                      </Typography>
                      {row.hasDnf ? (
                        <Chip label="DNF GERAL" size="small" color="error" sx={{ fontWeight: 800, height: 22 }} />
                      ) : hasTime ? (
                        <Typography
                          variant="h6"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            color: isFirst ? '#4ade80' : 'text.primary',
                            lineHeight: 1.2,
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                          }}
                        >
                          {fmt(row.totalTime)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Pendente
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isFirst ? 'text.secondary' : 'warning.main',
                          display: 'block',
                          fontSize: '0.75rem',
                        }}
                      >
                        {isFirst || !hasTime ? 'Líder' : `+${fmt(row.totalGap)}`}
                      </Typography>
                    </Box>

                    {/* Ícone de Expandir */}
                    <ExpandMoreRoundedIcon
                      sx={{
                        color: 'text.secondary',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s ease-in-out',
                        fontSize: 24,
                      }}
                    />
                  </Box>
                </CardActionArea>

                {/* DETALHES DE TEMPO AO CLICAR NO CARD */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                  <Box
                    sx={{
                      p: { xs: 1.8, sm: 2.2 },
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <TimerRoundedIcon sx={{ fontSize: 18, color: 'primary.light' }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'primary.light' }}>
                        Parciais por Especial
                      </Typography>
                    </Box>

                    {/* Grid com cada especial */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'repeat(1, 1fr)',
                          sm: 'repeat(2, 1fr)',
                          md: `repeat(${Math.min(stages.length, 4)}, 1fr)`,
                        },
                        gap: 1.2,
                      }}
                    >
                      {stages.map((st) => {
                        const perf = row.stagePerformances[st.id]
                        return (
                          <Box
                            key={st.id}
                            sx={{
                              p: 1.5,
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                                {st.name}
                              </Typography>
                              {perf?.stageRank && (
                                <Chip
                                  label={`${perf.stageRank}º`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    bgcolor:
                                      perf.stageRank === 1
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : perf.stageRank === 2
                                        ? 'rgba(203, 213, 225, 0.15)'
                                        : perf.stageRank === 3
                                        ? 'rgba(180, 83, 9, 0.15)'
                                        : 'rgba(255, 255, 255, 0.06)',
                                    color:
                                      perf.stageRank === 1
                                        ? '#f59e0b'
                                        : perf.stageRank === 2
                                        ? '#cbd5e1'
                                        : perf.stageRank === 3
                                        ? '#d97706'
                                        : 'text.secondary',
                                  }}
                                />
                              )}
                            </Box>

                            {perf?.status === 'done' && perf.time != null ? (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.5 }}>
                                <Typography
                                  variant="body1"
                                  sx={{ fontFamily: 'monospace', fontWeight: 900, color: 'text.primary', fontSize: '1rem' }}
                                >
                                  {fmt(perf.time)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    color: perf.stageRank === 1 ? 'text.secondary' : 'warning.main',
                                  }}
                                >
                                  {perf.stageRank === 1 || perf.stageGap == null ? 'Melhor volta' : `+${fmt(perf.stageGap)}`}
                                </Typography>
                              </Box>
                            ) : perf?.status === 'dnf' ? (
                              <Box sx={{ mt: 0.5 }}>
                                <Chip label="DNF / Não Terminou" size="small" color="error" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 800 }} />
                              </Box>
                            ) : perf?.status === 'track' ? (
                              <Box sx={{ mt: 0.5 }}>
                                <Chip label="Atleta na Pista" size="small" color="warning" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                Não iniciou esta especial
                              </Typography>
                            )}
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                </Collapse>
              </Card>
            )
          } else {
            // Visualização em Especial isolada
            const perf = row.stagePerformances[selectedStageId]
            const isDone = perf?.status === 'done' && perf.time != null
            return (
              <Card
                key={row.rider.num}
                sx={{
                  bgcolor: cardBg,
                  border: cardBorder,
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: isFirst ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.4)',
                  },
                }}
              >
                {/* CABEÇALHO DO CARD */}
                <CardActionArea
                  onClick={() => toggleExpand(row.rider.num)}
                  sx={{
                    p: { xs: 1.8, sm: 2 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        minWidth: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isFirst
                          ? 'rgba(245, 158, 11, 0.18)'
                          : isSecond
                          ? 'rgba(203, 213, 225, 0.14)'
                          : isThird
                          ? 'rgba(180, 83, 9, 0.14)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isFirst
                          ? '#f59e0b'
                          : isSecond
                          ? '#cbd5e1'
                          : isThird
                          ? '#d97706'
                          : 'text.secondary',
                        fontWeight: 900,
                        fontSize: isFirst || isSecond || isThird ? '1.1rem' : '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `${i + 1}º`}
                    </Box>

                    <Avatar
                      sx={{
                        width: { xs: 34, sm: 38 },
                        height: { xs: 34, sm: 38 },
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        bgcolor: isFirst ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                        color: isFirst ? '#f59e0b' : 'primary.main',
                        border: '1px solid',
                        borderColor: isFirst ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      #{row.rider.num}
                    </Avatar>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body1"
                        noWrap
                        sx={{ fontWeight: 800, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}
                      >
                        {row.rider.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
                        <Chip
                          label={row.rider.cat}
                          size="small"
                          sx={{
                            fontSize: '0.68rem',
                            height: 19,
                            fontWeight: 700,
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 }, flexShrink: 0 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' }}
                      >
                        TEMPO DA ESPECIAL
                      </Typography>
                      {isDone ? (
                        <Typography
                          variant="h6"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            color: isFirst ? '#4ade80' : 'text.primary',
                            lineHeight: 1.2,
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                          }}
                        >
                          {fmt(perf.time!)}
                        </Typography>
                      ) : perf?.status === 'dnf' ? (
                        <Chip label="DNF" size="small" color="error" sx={{ height: 22, fontSize: '0.75rem', fontWeight: 800 }} />
                      ) : perf?.status === 'track' ? (
                        <Chip label="Na pista" size="small" color="warning" sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isFirst ? 'text.secondary' : 'warning.main',
                          display: 'block',
                          fontSize: '0.75rem',
                        }}
                      >
                        {isFirst || !isDone || perf.stageGap == null ? 'Líder' : `+${fmt(perf.stageGap)}`}
                      </Typography>
                    </Box>

                    <ExpandMoreRoundedIcon
                      sx={{
                        color: 'text.secondary',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s ease-in-out',
                        fontSize: 24,
                      }}
                    />
                  </Box>
                </CardActionArea>

                {/* DETALHES AO EXPANDIR NA ESPECIAL */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                  <Box
                    sx={{
                      p: { xs: 1.8, sm: 2.2 },
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Status do Piloto nesta especial
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3 }}>
                          {isDone ? `Concluída (${i + 1}º Lugar)` : perf?.status === 'dnf' ? 'Desclassificado / DNF' : perf?.status === 'track' ? 'Na pista' : 'Pendente'}
                        </Typography>
                      </Box>
                      {isDone && (
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Diferença para o 1º Colocado
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: isFirst ? '#4ade80' : 'warning.main', mt: 0.3 }}>
                            {isFirst ? 'Melhor tempo registrado' : `+${fmt(perf.stageGap ?? 0)}`}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </Card>
            )
          }
        })}
      </Box>

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

      {/* MODAL DE VISUALIZAÇÃO DA GRADE DE LARGADA */}
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
          {/* SELETOR DE ESPECIAL DENTRO DO MODAL DA GRADE */}
          {stages.length > 1 && (
            <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`Todas as Especiais (${gridItems.length})`}
                onClick={() => setViewGridStageFilter('all')}
                color={viewGridStageFilter === 'all' ? 'primary' : 'default'}
                variant={viewGridStageFilter === 'all' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
              {stages.map((st) => {
                const count = gridItems.filter((i) => (i.stageId || stages[0]?.id) === st.id).length
                return (
                  <Chip
                    key={st.id}
                    size="small"
                    label={`${st.name} (${count})`}
                    onClick={() => setViewGridStageFilter(st.id)}
                    color={viewGridStageFilter === st.id ? 'primary' : 'default'}
                    variant={viewGridStageFilter === st.id ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                  />
                )
              })}
            </Box>
          )}

          {(() => {
            const filteredItems = viewGridStageFilter === 'all'
              ? gridItems
              : gridItems.filter((i) => (i.stageId || stages[0]?.id) === viewGridStageFilter)

            if (filteredItems.length === 0) {
              return (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum piloto na grade para a especial selecionada.
                  </Typography>
                </Box>
              )
            }

            return (
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
                    {filteredItems.map((item, idx) => {
                      const prev = filteredItems[idx - 1]
                      const itemStage = stages.find((s) => s.id === (item.stageId || stages[0]?.id))
                      const isFirstOfCategory =
                        idx === 0 ||
                        prev.category !== item.category ||
                        (viewGridStageFilter === 'all' && (prev.stageId || stages[0]?.id) !== (item.stageId || stages[0]?.id))

                      return (
                        <Fragment key={`${item.stageId || 'default'}-${item.num}-${idx}`}>
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
                                {viewGridStageFilter === 'all' && stages.length > 1 && (
                                  <Box component="span" sx={{ color: 'secondary.main', mr: 1 }}>
                                    [{itemStage?.name || 'Especial'}]
                                  </Box>
                                )}
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
            )
          })()}
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1 }}>
          <Button variant="contained" color="primary" onClick={() => setViewGridOpen(false)} sx={{ fontWeight: 700 }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
