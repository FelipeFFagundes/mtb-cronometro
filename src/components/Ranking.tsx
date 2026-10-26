import type { AppState } from '../types'
import { EnduroLeaderboard } from './EnduroLeaderboard'

export function Ranking({ state }: { state: AppState }) {
  return (
    <EnduroLeaderboard state={state} title="Ranking" subtitle="Tempo acumulado, parciais e diferenças" />
  )
}
