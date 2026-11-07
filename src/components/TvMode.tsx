import { useEffect, useState, type ReactNode } from 'react'
import type { AppState, SyncStatus } from '../types'
import { DEFAULT_STAGES } from '../types'
import { buildEnduroRanking, type EnduroRankRow } from '../lib/ranking'
import { fmt } from '../lib/time'
import { useNow } from '../hooks/useNow'
import { display, logoSx, radius, tabular, tokens } from '../theme'
import { LiveTimer } from './LiveTimer'
import { TrackProgress } from './TrackProgress'
import { SyncStamp } from './SyncBanner'
import { RiderPlate } from './ui'
import { Box, Button, Typography } from '@mui/material'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

/*
 * Modo TV: o evento em tela cheia para uma TV ou telão, sem login (só leitura).
 * A tela é desenhada num "palco" fixo de 1920 × 1080 e escalada para caber: TVs que informam
 * uma largura pequena ao navegador (Fire TV, TVs antigas) mostram o mesmo layout, sem virar
 * tela de celular. A classificação troca de categoria sozinha a cada 12 segundos.
 */

const STAGE_W = 1920
const STAGE_H = 1080
export const TV_ROTATE_MS = 12_000

const podium = [tokens.gold, tokens.silver, tokens.bronze]

/** Fator para o palco de 1920 × 1080 caber na janela. */
function useStageScale() {
  const calc = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
  const [scale, setScale] = useState(calc)
  useEffect(() => {
    const onResize = () => setScale(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

/** Mantém a tela da TV acesa enquanto o modo TV está aberto (onde o navegador permite). */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
    if (!wl) return
    let lock: Lock | null = null
    const request = () => {
      if (document.visibilityState === 'visible') void wl.request('screen').then((l) => (lock = l)).catch(() => undefined)
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      void lock?.release().catch(() => undefined)
    }
  }, [])
}

function Panel({ title, right, children, grow = false }: { title: string; right?: ReactNode; children: ReactNode; grow?: boolean }) {
  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: grow ? 1 : undefined,
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.line}`,
        borderTop: `4px solid ${tokens.brand}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 3, py: 1.5, borderBottom: `1px solid ${tokens.line}` }}>
        <Typography sx={{ ...display, fontWeight: 800, fontSize: '2.2rem', lineHeight: 1 }}>{title}</Typography>
        {right}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', p: 2.5 }}>{children}</Box>
    </Box>
  )
}

function Clock() {
  const now = useNow(1000)
  return <>{new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
}

export function TvMode({ state, sync, onExit }: { state: AppState; sync: SyncStatus; onExit: () => void }) {
  useWakeLock()
  const scale = useStageScale()
  const stages = state.stages.length > 0 ? state.stages : DEFAULT_STAGES
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)

  // Categorias com atletas, em rodízio
  const categories = (state.categories ?? []).filter((c) => state.riders.some((r) => r.cat === c))
  const rotation = categories.length > 1 ? categories : ['Todas']
  const [catIndex, setCatIndex] = useState(0)
  useEffect(() => {
    if (rotation.length < 2) return
    const id = setInterval(() => setCatIndex((i) => i + 1), TV_ROTATE_MS)
    return () => clearInterval(id)
  }, [rotation.length])
  const cat = rotation[catIndex % rotation.length]
  const rows = buildEnduroRanking(state, cat, 'all').rows.slice(0, 10)

  const [isFull, setIsFull] = useState(() => Boolean(document.fullscreenElement))
  useEffect(() => {
    const on = () => setIsFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: tokens.bg, overflow: 'hidden', cursor: isFull ? 'none' : undefined }}>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          p: 3,
          color: tokens.text,
        }}
      >
        {/* Cabeçalho: evento, relógio e sincronização */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, borderLeft: `6px solid ${tokens.brand}`, pl: 2.5 }}>
          <Box component="img" src="/logo.png" alt="" sx={{ height: 64, width: 'auto', ...logoSx }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ ...display, fontWeight: 800, fontSize: '3.4rem', lineHeight: 1, textTransform: 'uppercase' }}>
              {state.event?.name ?? 'Race Timer'}
            </Typography>
            <Typography sx={{ color: tokens.muted, fontSize: '1.2rem', mt: 0.5 }}>
              <SyncStamp sync={sync} />
            </Typography>
          </Box>
          <Typography sx={{ ...tabular, fontWeight: 800, fontSize: '3.4rem', lineHeight: 1 }}>
            <Clock />
          </Typography>
          {!isFull && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                size="large"
                startIcon={<FullscreenRoundedIcon />}
                onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
              >
                Tela cheia
              </Button>
              <Button variant="outlined" color="inherit" size="large" startIcon={<CloseRoundedIcon />} onClick={onExit}>
                Sair
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 2.5 }}>
          {/* Esquerda: quem está descendo e onde deve estar */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: 0 }}>
            <Panel
              title="Na pista"
              grow
              right={
                <Typography sx={{ ...display, fontWeight: 800, fontSize: '1.6rem', color: onTrack.length ? tokens.finish : tokens.muted }}>
                  {onTrack.length ? `${onTrack.length} ao vivo` : 'pista livre'}
                </Typography>
              }
            >
              {onTrack.length === 0 ? (
                <Typography sx={{ color: tokens.muted, fontSize: '1.6rem', textAlign: 'center', mt: 6 }}>
                  Os tempos aparecem aqui assim que a próxima largada acontecer.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: onTrack.length > 3 ? '1fr 1fr' : '1fr', gap: 1.5 }}>
                  {onTrack.slice(0, 8).map((run) => {
                    const rider = state.riders.find((r) => r.num === run.num)
                    const stage = stages.find((s) => s.id === run.stageId)
                    return (
                      <Box
                        key={run.id}
                        sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: tokens.raised, borderRadius: radius.md, minWidth: 0 }}
                      >
                        <RiderPlate num={run.num} size="lg" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 800, fontSize: '1.7rem', lineHeight: 1.15 }}>
                            {rider?.name ?? `Piloto #${run.num}`}
                          </Typography>
                          <Typography noWrap sx={{ color: tokens.muted, fontSize: '1.15rem' }}>
                            {[rider?.cat, stage?.name].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: onTrack.length > 3 ? '2.4rem' : '3.2rem', lineHeight: 1 }}>
                          <LiveTimer start={run.start} />
                        </Typography>
                      </Box>
                    )
                  })}
                  {onTrack.length > 8 && (
                    <Typography sx={{ color: tokens.muted, fontSize: '1.3rem' }}>+ {onTrack.length - 8} na pista</Typography>
                  )}
                </Box>
              )}
            </Panel>
            {onTrack.length > 0 && (
              <Panel title="Progresso">
                <TrackProgress state={state} big />
              </Panel>
            )}
          </Box>

          {/* Direita: classificação geral, uma categoria por vez */}
          <Panel
            title={cat === 'Todas' ? 'Classificação' : cat}
            right={
              rotation.length > 1 ? (
                <Box sx={{ display: 'flex', gap: 1 }} aria-label={`Categoria ${(catIndex % rotation.length) + 1} de ${rotation.length}`}>
                  {rotation.map((c, i) => (
                    <Box
                      key={c}
                      sx={{ width: 14, height: 14, borderRadius: radius.pill, bgcolor: i === catIndex % rotation.length ? tokens.brand : tokens.lineStrong }}
                    />
                  ))}
                </Box>
              ) : undefined
            }
          >
            {rotation.length > 1 && (
              // Barra que enche até a próxima categoria
              <Box sx={{ height: 4, bgcolor: tokens.line, mb: 2, mx: -2.5, mt: -2.5 }}>
                <Box
                  key={catIndex}
                  sx={{
                    height: '100%',
                    bgcolor: tokens.brand,
                    animation: `tvfill ${TV_ROTATE_MS}ms linear`,
                    '@keyframes tvfill': { from: { width: '0%' }, to: { width: '100%' } },
                  }}
                />
              </Box>
            )}
            {rows.length === 0 ? (
              <Typography sx={{ color: tokens.muted, fontSize: '1.6rem', textAlign: 'center', mt: 6 }}>Sem atletas nesta categoria.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((row, i) => (
                  <StandingRow key={row.rider.num} row={row} pos={i + 1} leader={rows[0]} stagesCount={stages.length} />
                ))}
              </Box>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  )
}

function StandingRow({ row, pos, leader, stagesCount }: { row: EnduroRankRow; pos: number; leader: EnduroRankRow; stagesCount: number }) {
  const valid = row.completedCount > 0 && !row.hasDnf
  const color = valid ? podium[pos - 1] : undefined
  const sameStages = row.completedCount === leader.completedCount
  const gap = !valid ? '' : row === leader ? 'líder' : sameStages ? `+${fmt(row.totalGap)}` : `${row.completedCount}/${stagesCount} esp.`
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.1, borderBottom: `1px solid ${tokens.line}` }}>
      <Box
        sx={{
          ...tabular,
          width: 52,
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          fontWeight: 900,
          fontSize: '1.9rem',
          bgcolor: color ?? 'transparent',
          color: color ? (tokens.mode === 'light' ? '#ffffff' : '#000000') : tokens.muted,
        }}
      >
        {valid ? pos : '–'}
      </Box>
      <RiderPlate num={row.rider.num} size="md" tone="muted" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: '1.7rem', lineHeight: 1.15 }}>
          {row.rider.name}
        </Typography>
        {row.rider.team && (
          <Typography noWrap sx={{ color: tokens.muted, fontSize: '1.1rem' }}>
            {row.rider.team}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ ...tabular, fontWeight: 900, fontSize: '2.1rem', lineHeight: 1.1, color: row.hasDnf ? tokens.finish : tokens.text }}>
          {row.hasDnf ? 'DNF' : row.completedCount > 0 ? fmt(row.totalTime) : '—'}
        </Typography>
        <Typography sx={{ ...tabular, fontSize: '1.15rem', fontWeight: 700, color: row === leader && valid ? tokens.brand : tokens.muted }}>
          {gap}
        </Typography>
      </Box>
    </Box>
  )
}
