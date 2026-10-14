import type { AppState } from '../types'
import { EnduroLeaderboard } from './EnduroLeaderboard'

export function Ranking({ state }: { state: AppState }) {
  return (
    <section>
      <EnduroLeaderboard
        state={state}
        title="Ranking Oficial de Enduro"
        subtitle="Tempos parciais por especial, tempo total acumulado e gaps"
      />
    </section>
  )
}
