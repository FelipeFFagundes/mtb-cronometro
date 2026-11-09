import type { OutStatus, Run, RunStatus } from '../types'
import { clock, fmt } from './time'

/** Situações que tiram o atleta da classificação (DNF, DNS, DSQ). */
export const isOut = (status: RunStatus | 'none' | undefined): status is OutStatus => status === 'dnf' || status === 'dns' || status === 'dsq'

/** Sigla da situação para mostrar no lugar do tempo. */
export const outLabel = (status: OutStatus) => status.toUpperCase()

/** O que cada sigla quer dizer (dica para o público e para quem corrige). */
export const outDescription: Record<OutStatus, string> = {
  dnf: 'Largou, mas não terminou a especial',
  dns: 'Não largou nesta especial',
  dsq: 'Desclassificado pela organização',
}

/** Tempo que vale da descida concluída: chegada − largada + penalidade (ms). */
export const runTime = (run: Run): number | null =>
  run.status === 'done' && run.end != null ? run.end - run.start + (run.penaltyMs ?? 0) : null

/** "+10s" para mostrar ao lado do tempo. */
export const penaltyText = (ms?: number) => (ms ? `+${Math.round(ms / 1000)}s` : '')

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
  if (isOut(run.status)) return `${name} já está como ${outLabel(run.status)} nesta especial (registrado por outro aparelho).`
  return `${name} já chegou: ${fmt((run.end ?? run.start) - run.start)}, registrado por outro aparelho às ${clock(run.end ?? run.start)}.`
}
