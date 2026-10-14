import type { Api, AppState, Run } from '../types'
import { DEMO_RIDERS, DEMO_TIMES } from './demo'

const KEY = 'mtb-cronometro-v2'

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* ignora dados corrompidos */
  }
  return { riders: [], runs: [] }
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

    async addRider(rider) {
      const s = read()
      if (s.riders.some((r) => r.num === rider.num)) throw new Error(`Número #${rider.num} já existe`)
      s.riders.push(rider)
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

    async finishRun(num) {
      const s = read()
      const rider = s.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      const run = openRun(s, num)
      if (!run) throw new Error(`${rider.name} não está na pista`)
      run.end = Date.now()
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
      })
    },

    async reset() {
      write({ riders: [], runs: [] })
    },
  }
}
