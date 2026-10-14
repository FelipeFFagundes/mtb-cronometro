import type { AppState, Rider } from '../types'

export interface RankRow {
  rider: Rider
  time: number
}

export function buildRanking(state: AppState, category: string): RankRow[] {
  const best = new Map<string, number>()
  for (const run of state.runs) {
    if (run.status !== 'done' || run.end == null) continue
    const t = run.end - run.start
    const prev = best.get(run.num)
    if (prev === undefined || t < prev) best.set(run.num, t)
  }

  const rows: RankRow[] = []
  for (const [num, time] of best) {
    const rider = state.riders.find((r) => r.num === num)
    if (rider && (category === 'Todas' || rider.cat === category)) rows.push({ rider, time })
  }
  return rows.sort((a, b) => a.time - b.time)
}
