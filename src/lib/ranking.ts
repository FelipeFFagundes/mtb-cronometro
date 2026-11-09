import type { AppState, OutStatus, Rider, Stage } from '../types'
import { isOut, runTime } from './runs'

export interface StagePerformance {
  stageId: string
  stageName: string
  /** Tempo que vale (já com a penalidade). */
  time: number | null
  status: 'done' | OutStatus | 'track' | 'none'
  stageGap: number | null
  stageRank: number | null
  /** Penalidade incluída no tempo (ms). */
  penaltyMs: number
  /** Descida que gerou este resultado (para corrigir pela matriz). */
  runId?: string
}

export interface EnduroRankRow {
  rider: Rider
  stagePerformances: Record<string, StagePerformance>
  completedCount: number
  totalStagesCount: number
  totalTime: number
  totalGap: number
  /** Fora da classificação geral por DNF, DNS ou DSQ em alguma especial. */
  hasDnf: boolean
  /** Qual situação tirou o atleta (DSQ pesa mais que DNF, que pesa mais que DNS). */
  outStatus?: OutStatus
  isCompletedAll: boolean
}

const outWeight: Record<OutStatus, number> = { dsq: 3, dnf: 2, dns: 1 }

type StageResult = { time: number; status: StagePerformance['status']; penaltyMs: number; runId: string }

export function buildEnduroRanking(
  state: AppState,
  category = 'Todas',
  selectedStageId = 'all',
): { rows: EnduroRankRow[]; stages: Stage[] } {
  const stages = state.stages && state.stages.length > 0 ? state.stages : []
  const filteredRiders = state.riders.filter((r) => category === 'Todas' || r.cat === category)

  // 1. Resultado de cada piloto em cada especial
  // (havendo mais de uma descida, vale o melhor tempo concluído; uma decisão como DSQ vale sobre ele)
  const riderStageRuns = new Map<string, Map<string, StageResult>>()

  for (const run of state.runs) {
    const stageId = run.stageId || stages[0]?.id || 'stage-1'
    if (!riderStageRuns.has(run.num)) riderStageRuns.set(run.num, new Map())
    const stageMap = riderStageRuns.get(run.num)!
    const current = stageMap.get(stageId)

    if (run.status === 'done') {
      const time = runTime(run) ?? 0
      if (!current || current.status === 'track' || current.status === 'none' || (current.status === 'done' && time < current.time)) {
        stageMap.set(stageId, { time, status: 'done', penaltyMs: run.penaltyMs ?? 0, runId: run.id })
      }
    } else if (isOut(run.status)) {
      // DSQ vale mesmo com um tempo concluído; DNF/DNS só quando não há tempo
      if (!current || current.status === 'track' || (run.status === 'dsq' && current.status !== 'dsq') || (current.status !== 'done' && !isOut(current.status))) {
        stageMap.set(stageId, { time: 0, status: run.status, penaltyMs: 0, runId: run.id })
      }
    } else if (run.status === 'track' && !current) {
      stageMap.set(stageId, { time: 0, status: 'track', penaltyMs: 0, runId: run.id })
    }
  }

  // 2. Melhor tempo de cada especial entre os pilotos filtrados (diferença e posição)
  const bestTimesByStage: Record<string, number> = {}
  stages.forEach((st) => {
    let minTime = Infinity
    filteredRiders.forEach((r) => {
      const info = riderStageRuns.get(r.num)?.get(st.id)
      if (info && info.status === 'done' && info.time < minTime) minTime = info.time
    })
    if (minTime !== Infinity) bestTimesByStage[st.id] = minTime
  })

  // 3. Linha de cada atleta
  const rows: EnduroRankRow[] = filteredRiders.map((rider) => {
    const stageMap = riderStageRuns.get(rider.num) || new Map<string, StageResult>()
    const stagePerformances: Record<string, StagePerformance> = {}
    let totalTime = 0
    let completedCount = 0
    let outStatus: OutStatus | undefined

    stages.forEach((st) => {
      const info = stageMap.get(st.id)
      const base = { stageId: st.id, stageName: st.name, stageGap: null, stageRank: null, penaltyMs: 0 }
      if (!info) {
        stagePerformances[st.id] = { ...base, time: null, status: 'none' }
      } else if (info.status === 'done') {
        completedCount += 1
        totalTime += info.time
        const best = bestTimesByStage[st.id]
        stagePerformances[st.id] = {
          ...base,
          time: info.time,
          status: 'done',
          stageGap: best != null ? info.time - best : 0,
          penaltyMs: info.penaltyMs,
          runId: info.runId,
        }
      } else {
        if (isOut(info.status) && (!outStatus || outWeight[info.status] > outWeight[outStatus])) outStatus = info.status
        stagePerformances[st.id] = { ...base, time: null, status: info.status, runId: info.runId }
      }
    })

    return {
      rider,
      stagePerformances,
      completedCount,
      totalStagesCount: stages.length,
      totalTime,
      totalGap: 0,
      hasDnf: Boolean(outStatus),
      outStatus,
      isCompletedAll: completedCount === stages.length && stages.length > 0 && !outStatus,
    }
  })

  // 4. Posição em cada especial
  stages.forEach((st) => {
    rows
      .filter((r) => r.stagePerformances[st.id]?.status === 'done')
      .sort((a, b) => (a.stagePerformances[st.id].time ?? 0) - (b.stagePerformances[st.id].time ?? 0))
      .forEach((r, i) => {
        r.stagePerformances[st.id].stageRank = i + 1
      })
  })

  // 5. Ordenação
  if (selectedStageId !== 'all') {
    // Uma especial: pelo tempo nela; quem ficou fora (DNF/DNS/DSQ) depois de quem não largou
    rows.sort((a, b) => {
      const aPerf = a.stagePerformances[selectedStageId]
      const bPerf = b.stagePerformances[selectedStageId]
      const aDone = aPerf?.status === 'done'
      const bDone = bPerf?.status === 'done'
      if (aDone && bDone) return (aPerf.time ?? 0) - (bPerf.time ?? 0)
      if (aDone) return -1
      if (bDone) return 1
      if (isOut(aPerf?.status) && !isOut(bPerf?.status)) return 1
      if (isOut(bPerf?.status) && !isOut(aPerf?.status)) return -1
      return Number(a.rider.num) - Number(b.rider.num)
    })
  } else {
    // Geral: quem completou mais especiais, depois o menor tempo somado; fora da prova por último
    rows.sort((a, b) => {
      if (a.hasDnf && !b.hasDnf) return 1
      if (!a.hasDnf && b.hasDnf) return -1
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount
      if (a.completedCount > 0 && b.completedCount > 0) return a.totalTime - b.totalTime
      return Number(a.rider.num) - Number(b.rider.num)
    })
  }

  // 6. Diferença para o líder
  const leaderTotalTime = rows.find((r) => r.completedCount > 0 && !r.hasDnf)?.totalTime
  if (leaderTotalTime != null) {
    rows.forEach((r) => {
      if (r.completedCount > 0 && !r.hasDnf) r.totalGap = r.totalTime - leaderTotalTime
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
