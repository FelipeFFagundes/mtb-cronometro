import type { Act } from '../App'
import type { AppState, SyncStatus } from '../types'
import { EnduroLeaderboard } from './EnduroLeaderboard'

/** Ranking da equipe da prova: painel, alertas e, para o organizador, as correções. */
export function Ranking({
  state,
  sync,
  act,
  canEdit,
  onOpenAthlete,
}: {
  state: AppState
  sync: SyncStatus
  act: Act
  canEdit: boolean
  onOpenAthlete: (num: string) => void
}) {
  return (
    <EnduroLeaderboard
      state={state}
      sync={sync}
      act={act}
      canEdit={canEdit}
      staff
      onOpenAthlete={onOpenAthlete}
      title="Ranking"
      subtitle="Tempo acumulado, parciais e diferenças"
    />
  )
}
