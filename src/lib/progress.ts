import type { AppState, Run } from '../types'

/*
 * Progresso na pista: onde cada piloto deve estar, pelo tempo que leva para descer a especial.
 * O app não guarda a distância das especiais, então a referência vem das chegadas da prova:
 * a mediana da categoria do piloto (com pelo menos 2 chegadas nela) ou, antes disso, a da especial.
 * Sem nenhuma chegada na especial ainda, a posição é só relativa entre quem está descendo.
 */

/** Atrasado: passou de 1,5× o tempo de referência e de pelo menos 1 minuto além dele. */
export const LATE_FACTOR = 1.5
export const LATE_MIN_MS = 60_000
/** A partir de 85% da referência o piloto está chegando. */
export const NEAR_FACTOR = 0.85

export type TrackState = 'rel' | 'normal' | 'near' | 'over' | 'late'

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

const doneTime = (r: Run) => (r.status === 'done' && r.end != null ? r.end - r.start : NaN)

/** Tempo de referência da especial para o piloto (ms) e de onde ele veio. */
export function referenceTime(state: AppState, run: Run): { ms: number; source: 'categoria' | 'especial' } | null {
  const cat = state.riders.find((r) => r.num === run.num)?.cat
  const stageDone = state.runs.filter((r) => r.stageId === run.stageId && r.status === 'done')
  const catDone = stageDone.filter((r) => state.riders.find((x) => x.num === r.num)?.cat === cat)
  if (catDone.length >= 2) {
    const ms = median(catDone.map(doneTime))
    if (ms) return { ms, source: 'categoria' }
  }
  const ms = median(stageDone.map(doneTime))
  return ms ? { ms, source: 'especial' } : null
}

export function trackState(elapsed: number, ref: number | null): TrackState {
  if (!ref) return 'rel'
  if (elapsed > ref * LATE_FACTOR && elapsed - ref > LATE_MIN_MS) return 'late'
  if (elapsed > ref) return 'over'
  if (elapsed >= ref * NEAR_FACTOR) return 'near'
  return 'normal'
}

export interface TrackRider {
  run: Run
  elapsed: number
  /** Referência do piloto (ms); null antes da primeira chegada na especial. */
  ref: number | null
  /** 0 = largada, 1 = chegada. */
  progress: number
  state: TrackState
}

/** Quem está descendo, por especial, com a posição estimada de cada um. */
export function trackRiders(state: AppState, now: number): { stageId: string; ref: number | null; riders: TrackRider[] }[] {
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)
  return state.stages
    .map((stage) => {
      const runs = onTrack.filter((r) => r.stageId === stage.id)
      const stageRef = median(state.runs.filter((r) => r.stageId === stage.id && r.status === 'done').map(doneTime))
      // Sem referência, a escala é o mais demorado de quem está descendo, com folga
      const relScale = Math.max(60_000, ...runs.map((r) => now - r.start)) * 1.25
      const riders = runs.map((run) => {
        const elapsed = Math.max(0, now - run.start)
        const ref = referenceTime(state, run)?.ms ?? null
        return { run, elapsed, ref, progress: Math.min(1, elapsed / (ref ?? relScale)), state: trackState(elapsed, ref) }
      })
      return { stageId: stage.id, ref: stageRef, riders }
    })
    .filter((g) => g.riders.length > 0)
}

/** "0:42" (minutos:segundos), com sinal quando negativo. */
export function shortTime(ms: number): string {
  const t = Math.floor(Math.abs(ms) / 1000)
  return `${ms < 0 ? '-' : ''}${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
