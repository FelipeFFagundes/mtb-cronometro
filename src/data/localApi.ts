import type { Api, AppState, Rider, Run, Stage, StartGridItem } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_STAGES } from '../types'
import { DEMO_RIDERS, DEMO_STAGES } from './demo'

const KEY = 'mtb-cronometro-v3'
/** Grade das versões antigas, que ficava separada do estado. */
const LEGACY_GRID_KEY = 'mtb_start_grid'

/** Nome e categoria da grade sempre refletem o cadastro atual do piloto. */
function withRiderInfo(grid: StartGridItem[], riders: Rider[]): StartGridItem[] {
  return grid.flatMap((item) => {
    const rider = riders.find((r) => r.num === item.num)
    return rider ? [{ ...item, riderName: rider.name, category: rider.cat }] : []
  })
}

function legacyGrid(): StartGridItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_GRID_KEY)
    return raw ? (JSON.parse(raw) as StartGridItem[]) : []
  } catch {
    return []
  }
}

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      const stages: Stage[] =
        parsed.stages && parsed.stages.length > 0 ? parsed.stages : [...DEFAULT_STAGES]
      const categories =
        parsed.categories && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_CATEGORIES]
      const runs = (parsed.runs || []).map((r) => ({
        ...r,
        stageId: r.stageId || stages[0]?.id || 'stage-1',
      }))
      const riders = parsed.riders || []
      const grid = (parsed.grid ?? legacyGrid()).map((i) => ({ ...i, stageId: i.stageId || stages[0]?.id }))
      return {
        riders,
        runs,
        categories,
        stages,
        grid: withRiderInfo(grid, riders),
      }
    }
  } catch {
    /* ignora dados corrompidos */
  }
  return { riders: [], runs: [], categories: [...DEFAULT_CATEGORIES], stages: [...DEFAULT_STAGES], grid: [] }
}

export function createLocalApi(): Api {
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((l) => l())

  function write(state: AppState) {
    localStorage.setItem(KEY, JSON.stringify(state))
    localStorage.removeItem(LEGACY_GRID_KEY) // já migrada para dentro do estado
    emit()
  }

  const openRun = (s: AppState, num: string, stageId?: string) =>
    s.runs.find((r) => r.num === num && r.status === 'track' && (!stageId || r.stageId === stageId))

  return {
    mode: 'local',

    async load() {
      return read()
    },

    subscribe(onChange) {
      listeners.add(onChange)
      // Outras abas do mesmo navegador
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) onChange()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('storage', onStorage)
      }
    },

    getClockOffset: () => 0,

    getSync: () => ({ online: true, syncing: false, pending: 0 }),
    getPending: () => [],
    async syncNow() {},
    discardPending() {},
    onNotice: () => () => {},

    async addCategory(name: string) {
      const s = read()
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio')
      if (s.categories.includes(trimmed)) throw new Error(`Categoria "${trimmed}" já existe`)
      s.categories.push(trimmed)
      write(s)
    },

    async updateCategory(oldName: string, newName: string) {
      const s = read()
      const trimmed = newName.trim()
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio')
      if (oldName !== trimmed && s.categories.includes(trimmed)) {
        throw new Error(`Categoria "${trimmed}" já existe`)
      }
      const idx = s.categories.indexOf(oldName)
      if (idx !== -1) {
        s.categories[idx] = trimmed
      }
      // Atualiza os atletas vinculados a esta categoria
      s.riders = s.riders.map((r) => (r.cat === oldName ? { ...r, cat: trimmed } : r))
      write(s)
    },

    async removeCategory(name: string) {
      const s = read()
      s.categories = s.categories.filter((c) => c !== name)
      // Atletas vinculados a esta categoria ficam como 'Sem Categoria'
      s.riders = s.riders.map((r) => (r.cat === name ? { ...r, cat: 'Sem Categoria' } : r))
      write(s)
    },

    async addStage(name: string) {
      const s = read()
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da especial não pode ser vazio')
      if (s.stages.some((st) => st.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Especial "${trimmed}" já existe`)
      }
      const newStage: Stage = {
        id: `stage-${Date.now()}`,
        name: trimmed,
        order: s.stages.length + 1,
      }
      s.stages.push(newStage)
      write(s)
    },

    async updateStage(id: string, name: string) {
      const s = read()
      const stage = s.stages.find((st) => st.id === id)
      if (!stage) throw new Error('Especial não encontrada')
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da especial não pode ser vazio')
      stage.name = trimmed
      write(s)
    },

    async removeStage(id: string) {
      const s = read()
      if (s.stages.length <= 1) {
        throw new Error('A prova precisa de pelo menos uma especial cadastrada')
      }
      // Deleta a especial e remove em cascata todas as descidas vinculadas a ela
      s.stages = s.stages.filter((st) => st.id !== id)
      s.runs = s.runs.filter((r) => r.stageId !== id)
      s.grid = s.grid.filter((i) => i.stageId !== id)
      // reordena
      s.stages.forEach((st, idx) => {
        st.order = idx + 1
      })
      write(s)
    },

    async addRider(rider) {
      const s = read()
      if (s.riders.some((r) => r.num === rider.num)) throw new Error(`Número #${rider.num} já existe`)
      s.riders.push(rider)
      write(s)
    },

    async updateRider(oldNum, updated) {
      const s = read()
      const index = s.riders.findIndex((r) => r.num === oldNum)
      if (index === -1) throw new Error(`Piloto #${oldNum} não encontrado`)

      if (updated.num !== oldNum && s.riders.some((r) => r.num === updated.num)) {
        throw new Error(`Número #${updated.num} já está em uso por outro piloto`)
      }

      s.riders[index] = updated
      // Atualiza em cascata o número do piloto nas descidas se mudou
      if (updated.num !== oldNum) {
        s.runs = s.runs.map((run) => (run.num === oldNum ? { ...run, num: updated.num } : run))
        s.grid = s.grid.map((i) => (i.num === oldNum ? { ...i, num: updated.num } : i))
      }
      write(s)
    },

    async removeRider(num) {
      const s = read()
      s.riders = s.riders.filter((r) => r.num !== num)
      s.runs = s.runs.filter((r) => r.num !== num)
      s.grid = s.grid.filter((i) => i.num !== num)
      write(s)
    },

    async setStageGrid(stageId, items) {
      const s = read()
      if (!s.stages.some((st) => st.id === stageId)) throw new Error('Especial não encontrada')
      s.grid = [...s.grid.filter((i) => i.stageId !== stageId), ...items.map((i) => ({ ...i, stageId }))]
      write(s)
    },

    async clearAllGrids() {
      const s = read()
      s.grid = []
      write(s)
    },

    async startRun(num, stageId) {
      const s = read()
      const rider = s.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      
      // Bloqueia se o piloto não tiver categoria configurada
      if (!rider.cat || rider.cat === 'Sem Categoria' || rider.cat.trim() === '') {
        throw new Error(`Piloto #${rider.num} (${rider.name}) está sem categoria. Configure a categoria em "Pilotos" antes de iniciar a descida.`)
      }

      const targetStageId = stageId || s.stages[0]?.id || 'stage-1'
      const stage = s.stages.find((st) => st.id === targetStageId)
      const stageName = stage ? stage.name : 'Especial'

      if (s.runs.some((r) => r.num === num && r.status === 'track')) {
        throw new Error(`${rider.name} já está na pista neste momento!`)
      }
      if (s.runs.some((r) => r.num === num && r.stageId === targetStageId && (r.status === 'done' || r.status === 'dnf'))) {
        throw new Error(`${rider.name} já possui descida registrada na ${stageName}`)
      }

      const run: Run = {
        id: crypto.randomUUID(),
        num,
        stageId: targetStageId,
        start: Date.now(),
        end: null,
        status: 'track',
      }
      s.runs.push(run)
      write(s)
      return run
    },

    async finishRun(num, atEpochMs, stageId) {
      const s = read()
      const rider = s.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      const run = openRun(s, num, stageId)
      if (!run) throw new Error(`${rider.name} não está na pista`)
      run.end = atEpochMs ?? Date.now()
      run.status = 'done'
      write(s)
      return run
    },

    async dnfRun(id) {
      const s = read()
      const run = s.runs.find((r) => r.id === id)
      if (!run) return
      run.status = 'dnf'
      if (!run.end) run.end = Date.now()
      write(s)
    },

    async undoRun(id) {
      const s = read()
      s.runs = s.runs.filter((r) => r.id !== id)
      write(s)
    },

    async loadDemo() {
      write({
        riders: [...DEMO_RIDERS],
        runs: [],
        categories: [...DEFAULT_CATEGORIES],
        stages: [...DEMO_STAGES],
        grid: [],
      })
    },

    async reset() {
      write({
        riders: [],
        runs: [],
        categories: [...DEFAULT_CATEGORIES],
        stages: [...DEFAULT_STAGES],
        grid: [],
      })
    },
  }
}
