import type { Api, AppState, Run } from '../types'
import { DEFAULT_CATEGORIES } from '../types'
import { DEMO_RIDERS, DEMO_TIMES } from './demo'

const KEY = 'mtb-cronometro-v2'

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        riders: parsed.riders || [],
        runs: parsed.runs || [],
        categories: parsed.categories && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_CATEGORIES],
      }
    }
  } catch {
    /* ignora dados corrompidos */
  }
  return { riders: [], runs: [], categories: [...DEFAULT_CATEGORIES] }
}

export function createLocalApi(): Api {
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((l) => l())

  function write(state: AppState) {
    localStorage.setItem(KEY, JSON.stringify(state))
    emit()
  }

  const openRun = (s: AppState, num: string) => s.runs.find((r) => r.num === num && r.status === 'track')

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

    async removeCategory(name: string) {
      const s = read()
      if (s.riders.some((r) => r.cat === name)) {
        throw new Error(`Não é possível remover "${name}": existem pilotos vinculados a ela`)
      }
      s.categories = s.categories.filter((c) => c !== name)
      if (s.categories.length === 0) s.categories = ['Geral']
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
      }
      write(s)
    },

    async removeRider(num) {
      const s = read()
      s.riders = s.riders.filter((r) => r.num !== num)
      s.runs = s.runs.filter((r) => r.num !== num)
      write(s)
    },

    async startRun(num) {
      const s = read()
      const rider = s.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      if (openRun(s, num)) throw new Error(`${rider.name} já está na pista`)
      const run: Run = { id: crypto.randomUUID(), num, start: Date.now(), end: null, status: 'track' }
      s.runs.push(run)
      write(s)
      return run
    },

    async finishRun(num, atEpochMs) {
      const s = read()
      const rider = s.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      const run = openRun(s, num)
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
      run.end = Date.now()
      write(s)
    },

    async undoRun(id) {
      const s = read()
      s.runs = s.runs.filter((r) => r.id !== id)
      write(s)
    },

    async loadDemo() {
      const t = Date.now()
      write({
        riders: DEMO_RIDERS,
        runs: DEMO_RIDERS.map((r, i) => ({
          id: `demo-${r.num}`,
          num: r.num,
          start: t - 600000 + i * 30000,
          end: t - 600000 + i * 30000 + DEMO_TIMES[r.num],
          status: 'done' as const,
        })),
        categories: [...DEFAULT_CATEGORIES],
      })
    },

    async reset() {
      write({ riders: [], runs: [], categories: [...DEFAULT_CATEGORIES] })
    },
  }
}
