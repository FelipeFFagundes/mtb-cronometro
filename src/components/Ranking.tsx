import type { AppState, SyncStatus } from '../types'
import { EnduroLeaderboard } from './EnduroLeaderboard'

export function Ranking({ state, sync }: { state: AppState; sync: SyncStatus }) {
  return (
    <EnduroLeaderboard state={state} sync={sync} title="Ranking" subtitle="Tempo acumulado, parciais e diferenças" />
  )
}
