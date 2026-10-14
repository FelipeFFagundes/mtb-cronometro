import type { AppState, Rider, Stage } from '../types'

export interface StagePerformance {
  stageId: string
  stageName: string
  time: number | null
  status: 'done' | 'dnf' | 'track' | 'none'
  stageGap: number | null
  stageRank: number | null
}

export interface EnduroRankRow {
  rider: Rider
  stagePerformances: Record<string, StagePerformance>
  completedCount: number
  totalStagesCount: number
  totalTime: number
  totalGap: number
  hasDnf: boolean
  isCompletedAll: boolean
}

export function buildEnduroRanking(
  state: AppState,
  category = 'Todas',
  selectedStageId = 'all',
): { rows: EnduroRankRow[]; stages: Stage[] } {
  const stages = state.stages && state.stages.length > 0 ? state.stages : []
  const filteredRiders = state.riders.filter((r) => category === 'Todas' || r.cat === category)

  // 1. Mapeia as melhores descidas de cada piloto em cada especial
  // (caso haja repetição ou reinício, considera o melhor tempo concluído na especial)
  const riderStageRuns = new Map<string, Map<string, { time: number; status: 'done' | 'dnf' | 'track' }>>()

  for (const run of state.runs) {
    const stageId = run.stageId || stages[0]?.id || 'stage-1'
    if (!riderStageRuns.has(run.num)) {
      riderStageRuns.set(run.num, new Map())
    }
    const stageMap = riderStageRuns.get(run.num)!

    if (run.status === 'done' && run.end != null) {
      const time = run.end - run.start
      const current = stageMap.get(stageId)
      if (!current || current.status !== 'done' || time < current.time) {
        stageMap.set(stageId, { time, status: 'done' })
      }
    } else if (run.status === 'dnf') {
      if (!stageMap.has(stageId) || stageMap.get(stageId)?.status !== 'done') {
        stageMap.set(stageId, { time: 0, status: 'dnf' })
      }
    } else if (run.status === 'track') {
      if (!stageMap.has(stageId)) {
        stageMap.set(stageId, { time: 0, status: 'track' })
      }
    }
  }

  // 2. Determina o melhor tempo de cada especial entre os pilotos filtrados (para calcular stageGap e stageRank)
  const bestTimesByStage: Record<string, number> = {}
  stages.forEach((st) => {
    let minTime = Infinity
    filteredRiders.forEach((r) => {
      const runInfo = riderStageRuns.get(r.num)?.get(st.id)
      if (runInfo && runInfo.status === 'done' && runInfo.time < minTime) {
        minTime = runInfo.time
      }
    })
    if (minTime !== Infinity) {
      bestTimesByStage[st.id] = minTime
    }
  })

  // 3. Monta as linhas completas de cada atleta
  const rows: EnduroRankRow[] = filteredRiders.map((rider) => {
    const stageMap = riderStageRuns.get(rider.num) || new Map()
    const stagePerformances: Record<string, StagePerformance> = {}
    let totalTime = 0
    let completedCount = 0
    let hasDnf = false

    stages.forEach((st) => {
      const runInfo = stageMap.get(st.id)
      if (!runInfo) {
        stagePerformances[st.id] = {
          stageId: st.id,
          stageName: st.name,
          time: null,
          status: 'none',
          stageGap: null,
          stageRank: null,
        }
      } else if (runInfo.status === 'done') {
        completedCount += 1
        totalTime += runInfo.time
        const bestTime = bestTimesByStage[st.id]
        stagePerformances[st.id] = {
          stageId: st.id,
          stageName: st.name,
          time: runInfo.time,
          status: 'done',
          stageGap: bestTime != null ? runInfo.time - bestTime : 0,
          stageRank: null,
        }
      } else if (runInfo.status === 'dnf') {
        hasDnf = true
        stagePerformances[st.id] = {
          stageId: st.id,
          stageName: st.name,
          time: null,
          status: 'dnf',
          stageGap: null,
          stageRank: null,
        }
      } else {
        stagePerformances[st.id] = {
          stageId: st.id,
          stageName: st.name,
          time: null,
          status: 'track',
          stageGap: null,
          stageRank: null,
        }
      }
    })

    return {
      rider,
      stagePerformances,
      completedCount,
      totalStagesCount: stages.length,
      totalTime,
      totalGap: 0,
      hasDnf,
      isCompletedAll: completedCount === stages.length && stages.length > 0 && !hasDnf,
    }
  })

  // 4. Calcula stageRank em cada especial
  stages.forEach((st) => {
    const sortedForStage = [...rows]
      .filter((r) => r.stagePerformances[st.id]?.status === 'done')
      .sort((a, b) => (a.stagePerformances[st.id].time ?? 0) - (b.stagePerformances[st.id].time ?? 0))

    sortedForStage.forEach((r, rankIdx) => {
      r.stagePerformances[st.id].stageRank = rankIdx + 1
    })
  })

  // 5. Ordenação:
  // Se for uma especial específica selecionada: ordena pelo tempo dessa especial!
  if (selectedStageId !== 'all') {
    rows.sort((a, b) => {
      const aPerf = a.stagePerformances[selectedStageId]
      const bPerf = b.stagePerformances[selectedStageId]
      const aDone = aPerf?.status === 'done'
      const bDone = bPerf?.status === 'done'

      if (aDone && bDone) return (aPerf.time ?? 0) - (bPerf.time ?? 0)
      if (aDone) return -1
      if (bDone) return 1
      if (aPerf?.status === 'dnf' && bPerf?.status !== 'dnf') return 1
      if (bPerf?.status === 'dnf' && aPerf?.status !== 'dnf') return -1
      return Number(a.rider.num) - Number(b.rider.num)
    })
  } else {
    // Geral Acumulado (Enduro Overall):
    // 1º: Quem completou todas as especiais
    // 2º: Maior número de especiais completadas
    // 3º: Menor tempo total acumulado
    rows.sort((a, b) => {
      if (a.hasDnf && !b.hasDnf) return 1
      if (!a.hasDnf && b.hasDnf) return -1
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount
      if (a.completedCount > 0 && b.completedCount > 0) return a.totalTime - b.totalTime
      return Number(a.rider.num) - Number(b.rider.num)
    })
  }

  // 6. Calcula o totalGap em relação ao líder
  const leaderTotalTime = rows.find((r) => r.completedCount > 0 && !r.hasDnf)?.totalTime
  if (leaderTotalTime != null) {
    rows.forEach((r) => {
      if (r.completedCount > 0 && !r.hasDnf) {
        r.totalGap = r.totalTime - leaderTotalTime
      }
    })
  }

  return { rows, stages }
}

/** Compatibilidade com código anterior */
export interface RankRow {
  rider: Rider
  time: number
}

export function buildRanking(state: AppState, category: string): RankRow[] {
  const { rows } = buildEnduroRanking(state, category, 'all')
  return rows
    .filter((r) => r.completedCount > 0)
    .map((r) => ({
      rider: r.rider,
      time: r.totalTime,
    }))
}
