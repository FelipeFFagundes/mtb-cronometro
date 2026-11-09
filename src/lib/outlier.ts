import type { AppState } from '../types'
import { median } from './progress'
import { runTime } from './runs'

/*
 * Tempo fora da curva, para a organização conferir: compara o tempo com a mediana de quem já
 * terminou a especial (da categoria, com pelo menos 3 chegadas; senão, da especial inteira).
 * Rápido demais costuma ser largada ou chegada registrada errada; lento demais, queda, parada
 * ou chegada marcada tarde.
 */
export const OUTLIER_MIN_SAMPLE = 3
/** 35% mais rápido ou mais lento que a mediana. */
export const OUTLIER_FAST = 0.65
export const OUTLIER_SLOW = 1.35

export interface Outlier {
  kind: 'fast' | 'slow'
  /** Diferença para a mediana, em %. */
  pct: number
  median: number
  scope: 'categoria' | 'especial'
}

export function stageOutlier(state: AppState, num: string, stageId: string, time: number | null): Outlier | null {
  if (time == null) return null
  const catOf = (n: string) => state.riders.find((r) => r.num === n)?.cat
  const cat = catOf(num)
  const done = state.runs.filter((r) => r.stageId === stageId && r.status === 'done')
  const inCat = done.filter((r) => catOf(r.num) === cat)
  const pool = inCat.length >= OUTLIER_MIN_SAMPLE ? inCat : done
  if (pool.length < OUTLIER_MIN_SAMPLE) return null
  const med = median(pool.map((r) => runTime(r) ?? NaN))
  if (!med) return null
  const ratio = time / med
  const kind = ratio <= OUTLIER_FAST ? 'fast' : ratio >= OUTLIER_SLOW ? 'slow' : null
  if (!kind) return null
  return { kind, pct: Math.round(Math.abs(ratio - 1) * 100), median: med, scope: pool === inCat ? 'categoria' : 'especial' }
}

export function outlierText(o: Outlier): string {
  return o.kind === 'fast'
    ? `${o.pct}% mais rápido que a mediana da ${o.scope}: confira os horários de largada e chegada`
    : `${o.pct}% mais lento que a mediana da ${o.scope}: confira se houve queda, parada ou chegada marcada tarde`
}
