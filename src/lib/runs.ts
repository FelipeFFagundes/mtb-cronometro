import type { Run } from '../types'
import { clock, fmt } from './time'

/*
 * Chegada registrada por outro aparelho: dois fiscais na chegada podem tocar no mesmo piloto.
 * Quem chega depois precisa saber que a descida já fechou (e com que tempo), não ver um erro genérico.
 */

/** Descida já encerrada (chegada ou DNF) do piloto na especial, se ele não estiver mais na pista. */
export function closedRun(runs: Run[], num: string, stageId?: string): Run | undefined {
  const mine = runs.filter((r) => r.num === num && (!stageId || r.stageId === stageId))
  if (mine.some((r) => r.status === 'track')) return undefined
  return mine.filter((r) => r.status !== 'track').sort((a, b) => (b.end ?? 0) - (a.end ?? 0))[0]
}

export function closedRunText(name: string, run: Run): string {
  if (run.status === 'dnf') return `${name} já está como DNF nesta especial (registrado por outro aparelho).`
  return `${name} já chegou: ${fmt((run.end ?? run.start) - run.start)}, registrado por outro aparelho às ${clock(run.end ?? run.start)}.`
}
