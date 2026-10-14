import { createClient } from '@supabase/supabase-js'
import type { Api, AppState, PendingOp, Run, RunStatus, SyncStatus, Stage } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_STAGES } from '../types'
import { DEMO_RIDERS, DEMO_STAGES } from './demo'

/*
 * Camada Supabase com FILA OFFLINE
 *
 * - Toda largada/chegada/DNF/desfazer vira uma "ação" gravada no aparelho (localStorage) com o
 *   horário do toque (relógio do servidor estimado = relógio local + offset medido online).
 * - A tela mostra o estado do servidor (cache) + as ações pendentes aplicadas por cima: a resposta é
 *   imediata mesmo sem sinal.
 * - Em segundo plano a fila é enviada em ordem. Falha de rede = tenta de novo; rejeição do servidor
 *   (ex.: piloto já está na pista) = descarta a ação e avisa.
 * - As funções do banco são idempotentes: reenviar uma ação não duplica nada.
 */

const CACHE_KEY = 'mtb-cache-v1'
const QUEUE_KEY = 'mtb-queue-v1'
const OFFSET_KEY = 'mtb-offset-v1'

const OFFLINE_MSG = 'Sem conexão. Tente novamente quando houver sinal.'
const REQUEST_TIMEOUT_MS = 8000
/** Chegada sem largada correspondente é descartada depois deste tempo. */
const WAIT_GIVE_UP_MS = 30 * 60 * 1000

interface RunRow {
  id: string
  rider_num: string
  stage_id?: string
  started_at: string
  finished_at: string | null
  status: RunStatus
}

type OpKind = 'start' | 'finish' | 'dnf' | 'undo'

interface Op {
  id: string
  kind: OpKind
  num?: string
  stageId?: string
  runId?: string
  /** Horário da ação (epoch ms, relógio do servidor estimado). */
  at: number
  label: string
  createdAt: number
  attempts: number
  nextTry?: number
}

interface Resp {
  error: { message: string; code?: string } | null
  status: number
}

type Outcome = 'ok' | 'network' | 'wait' | 'blocked' | 'rejected'

const toRun = (r: RunRow, fallbackStageId = 'stage-1'): Run => ({
  id: r.id,
  num: r.rider_num,
  stageId: r.stage_id || fallbackStageId,
  start: new Date(r.started_at).getTime(),
  end: r.finished_at ? new Date(r.finished_at).getTime() : null,
  status: r.status,
})

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* dados corrompidos: usa o padrão */
  }
  return fallback
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* armazenamento cheio/bloqueado */
  }
}

/** fetch com tempo limite: em sinal fraco a requisição não pode ficar pendurada para sempre. */
const timeoutFetch: typeof fetch = (input, init) => {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return fetch(input, init)
  const timer = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal =
    init?.signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([init.signal, timer]) : (init?.signal ?? timer)
  return fetch(input, { ...init, signal })
}

function classify(r: Resp): Outcome {
  if (!r.error) return 'ok'
  // status 0 = a requisição nem chegou ao servidor (sem rede / timeout)
  if (r.status === 0 || r.status === 408 || r.status === 429 || r.status >= 500) return 'network'
  if (r.error.code === 'MTB01') return 'wait'
  // função inexistente: o schema.sql novo ainda não foi aplicado no banco
  if (r.error.code === 'PGRST202' || r.status === 404) return 'blocked'
  return 'rejected'
}

/** Estado exibido = estado do servidor + ações pendentes aplicadas em ordem. */
function project(server: AppState, ops: Op[]): AppState {
  let runs = server.runs.map((r) => ({ ...r }))
  for (const op of ops) {
    if (op.kind === 'start') {
      if (!runs.some((r) => r.id === op.id)) {
        runs.push({
          id: op.id,
          num: op.num!,
          stageId: op.stageId || server.stages[0]?.id || 'stage-1',
          start: op.at,
          end: null,
          status: 'track',
        })
      }
    } else if (op.kind === 'finish') {
      const run = runs.find((r) => r.num === op.num && r.status === 'track' && (!op.stageId || r.stageId === op.stageId))
      if (run) {
        run.end = Math.max(op.at, run.start)
        run.status = 'done'
      }
    } else if (op.kind === 'dnf') {
      const run = runs.find((r) => r.id === op.runId)
      if (run) {
        run.end = run.end ?? Math.max(op.at, run.start)
        run.status = 'dnf'
      }
    } else if (op.kind === 'undo') {
      runs = runs.filter((r) => r.id !== op.runId)
    }
  }
  return { riders: server.riders, runs, categories: server.categories, stages: server.stages || [...DEFAULT_STAGES] }
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey, { global: { fetch: timeoutFetch } })

  let server: AppState = readJson<AppState>(CACHE_KEY, {
    riders: [],
    runs: [],
    categories: [...DEFAULT_CATEGORIES],
    stages: [...DEFAULT_STAGES],
  })
  if (!server.stages || server.stages.length === 0) {
    server.stages = [...DEFAULT_STAGES]
  }
  let queue: Op[] = readJson<Op[]>(QUEUE_KEY, [])
  let clockOffset = readJson<number>(OFFSET_KEY, 0)
  let online = typeof navigator === 'undefined' ? true : navigator.onLine
  let syncing = false
  let pulling = false
  let flushing = false

  const listeners = new Set<() => void>()
  const noticeListeners = new Set<(msg: string, isError: boolean) => void>()
  const emit = () => listeners.forEach((l) => l())
  const notice = (msg: string, isError = false) => noticeListeners.forEach((l) => l(msg, isError))

  const nowSrv = () => Date.now() + clockOffset
  const saveQueue = () => writeJson(QUEUE_KEY, queue)
  const view = () => project(server, queue)

  function setOnline(value: boolean) {
    if (online === value) return
    online = value
    emit()
  }

  function ensure(r: Resp) {
    if (!r.error) return
    if (classify(r) === 'network') {
      setOnline(false)
      throw new Error(OFFLINE_MSG)
    }
    throw new Error(r.error.message)
  }

  /** Busca o estado do servidor e guarda em cache. */
  async function pull(): Promise<boolean> {
    if (pulling) return online
    pulling = true
    try {
      const [riders, runs, categories] = await Promise.all([
        sb.from('riders').select('num,name,category').order('num'),
        sb.from('runs').select('id,rider_num,started_at,finished_at,status').order('started_at'),
        sb.from('categories').select('name').order('name'),
      ])
      if (riders.error || runs.error) {
        setOnline(false)
        return false
      }

      // Se a tabela categories não existir ainda no Supabase, usa o cache atual ou as categorias dos pilotos
      let cats: string[] = server.categories || [...DEFAULT_CATEGORIES]
      if (!categories.error && categories.data) {
        cats = categories.data.map((c: { name: string }) => c.name)
      } else if (riders.data && riders.data.length > 0) {
        const fromRiders = Array.from(new Set(riders.data.map((r: { category: string }) => r.category)))
        cats = Array.from(new Set([...cats, ...fromRiders]))
      }

      server = {
        riders: (riders.data ?? []).map((r) => ({ num: r.num, name: r.name, cat: r.category })),
        runs: ((runs.data ?? []) as RunRow[]).map((r) => toRun(r)),
        categories: cats.length > 0 ? cats : [...DEFAULT_CATEGORIES],
        stages: server.stages && server.stages.length > 0 ? server.stages : [...DEFAULT_STAGES],
      }
      writeJson(CACHE_KEY, server)
      online = true
      emit()
      return true
    } finally {
      pulling = false
    }
  }

  /** Mede a diferença entre o relógio do servidor e o do aparelho (menor latência vence). */
  async function syncClock() {
    let best: { rtt: number; offset: number } | null = null
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      const r = await sb.rpc('server_now')
      const t1 = Date.now()
      if (r.error || !r.data) {
        if (classify(r) === 'network') break
        continue
      }
      const offset = new Date(r.data as string).getTime() - (t0 + t1) / 2
      if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, offset }
    }
    if (best) {
      clockOffset = best.offset
      writeJson(OFFSET_KEY, clockOffset)
    }
  }

  async function send(op: Op): Promise<Resp> {
    const at = new Date(op.at).toISOString()
    if (op.kind === 'start') return sb.rpc('start_run', { p_num: op.num, p_at: at, p_id: op.id })
    if (op.kind === 'finish') return sb.rpc('finish_run', { p_num: op.num, p_at: at })
    if (op.kind === 'dnf') {
      const res = await sb.from('runs').update({ status: 'dnf' }).eq('id', op.runId!)
      return { error: res.error, status: res.status }
    }
    return sb.from('runs').delete().eq('id', op.runId!)
  }

  const removeOp = (id: string) => {
    queue = queue.filter((o) => o.id !== id)
  }

  /** Envia a fila em ordem. */
  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return
    flushing = true
    syncing = true
    emit()
    let sent = false
    try {
      for (const op of [...queue]) {
        if (op.nextTry && op.nextTry > Date.now()) continue
        const resp = await send(op)
        const outcome = classify(resp)
        if (outcome === 'ok') {
          removeOp(op.id)
          sent = true
          online = true
        } else if (outcome === 'network') {
          online = false
          break
        } else if (outcome === 'blocked') {
          const retryAt = Date.now() + 30000
          queue.forEach((o) => (o.nextTry = retryAt))
          notice('O banco precisa ser atualizado (rode supabase/schema.sql). As ações continuam guardadas.', true)
          break
        } else if (outcome === 'wait') {
          // Ex.: a chegada chegou antes da largada (celular da largada sem sinal). Tenta de novo depois.
          op.attempts += 1
          op.nextTry = Date.now() + Math.min(5000 * op.attempts, 30000)
          if (Date.now() - op.createdAt > WAIT_GIVE_UP_MS) {
            removeOp(op.id)
            notice(`Descartado: ${op.label} (largada correspondente não chegou)`, true)
          }
        } else {
          removeOp(op.id)
          notice(`${op.label}: ${resp.error?.message ?? 'rejeitado pelo servidor'}`, true)
        }
      }
    } finally {
      saveQueue()
      flushing = false
      syncing = false
    }
    if (sent) await pull()
    emit()
    // Ações criadas enquanto enviávamos
    if (online && queue.some((o) => (o.nextTry ?? 0) <= Date.now())) setTimeout(() => void flush(), 300)
  }

  function enqueue(op: Omit<Op, 'createdAt' | 'attempts'>) {
    queue = [...queue, { ...op, createdAt: Date.now(), attempts: 0 }]
    saveQueue()
    emit()
    void flush()
  }

  const who = (num: string) => {
    const r = server.riders.find((x) => x.num === num)
    return r ? `#${num} ${r.name}` : `#${num}`
  }

  // ---- Rotinas em segundo plano ----
  const reconnect = () => {
    void flush()
    void pull()
    void syncClock()
  }
  window.addEventListener('online', reconnect)
  window.addEventListener('offline', () => setOnline(false))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconnect()
  })
  setInterval(() => {
    if (queue.length > 0) void flush()
  }, 5000)
  setInterval(() => {
    if (queue.length === 0) void pull()
  }, 15000)
  setInterval(() => {
    if (online) void syncClock()
  }, 30000)
  reconnect()

  return {
    mode: 'supabase',

    async load() {
      return view()
    },

    subscribe(onChange) {
      listeners.add(onChange)
      const channel = sb
        .channel('mtb-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'runs' }, () => void pull())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => void pull())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => void pull())
        .subscribe()
      return () => {
        listeners.delete(onChange)
        void sb.removeChannel(channel)
      }
    },

    getClockOffset: () => clockOffset,

    getSync(): SyncStatus {
      return { online, syncing, pending: queue.length }
    },

    getPending(): PendingOp[] {
      return queue.map((o) => ({ id: o.id, label: o.label, at: o.at, attempts: o.attempts }))
    },

    async syncNow() {
      queue.forEach((o) => (o.nextTry = undefined))
      await flush()
      await pull()
    },

    discardPending(id) {
      removeOp(id)
      saveQueue()
      emit()
    },

    onNotice(cb) {
      noticeListeners.add(cb)
      return () => noticeListeners.delete(cb)
    },

    async addCategory(name: string) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio')
      if (server.categories.includes(trimmed)) throw new Error(`Categoria "${trimmed}" já existe`)

      // Tenta inserir na tabela categories
      const { error } = await sb.from('categories').insert({ name: trimmed })
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        ensure({ error, status: 400 })
      } else if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
        // Fallback local caso tabela categories ainda não tenha sido criada no Supabase
        server.categories.push(trimmed)
        writeJson(CACHE_KEY, server)
        emit()
      }
      await pull()
    },

    async removeCategory(name: string) {
      await sb.from('riders').update({ category: 'Sem Categoria' }).eq('category', name)
      const { error } = await sb.from('categories').delete().eq('name', name)
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        ensure({ error, status: 400 })
      }
      server.categories = server.categories.filter((c) => c !== name)
      server.riders = server.riders.map((r) => (r.cat === name ? { ...r, cat: 'Sem Categoria' } : r))
      writeJson(CACHE_KEY, server)
      emit()
      await pull()
    },

    async addStage(name: string) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da especial não pode ser vazio')
      if (server.stages.some((st) => st.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Especial "${trimmed}" já existe`)
      }
      const newStage: Stage = {
        id: `stage-${Date.now()}`,
        name: trimmed,
        order: server.stages.length + 1,
      }
      server.stages.push(newStage)
      writeJson(CACHE_KEY, server)
      emit()
    },

    async updateStage(id: string, name: string) {
      const stage = server.stages.find((st) => st.id === id)
      if (!stage) throw new Error('Especial não encontrada')
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da especial não pode ser vazio')
      stage.name = trimmed
      writeJson(CACHE_KEY, server)
      emit()
    },

    async removeStage(id: string) {
      if (server.stages.length <= 1) {
        throw new Error('A prova precisa de pelo menos uma especial cadastrada')
      }
      // Deleta a especial e remove em cascata as descidas vinculadas
      server.stages = server.stages.filter((st) => st.id !== id)
      server.runs = server.runs.filter((r) => r.stageId !== id)
      server.stages.forEach((st, idx) => {
        st.order = idx + 1
      })
      writeJson(CACHE_KEY, server)
      emit()
    },

    async addRider(rider) {
      const r = await sb.from('riders').insert({ num: rider.num, name: rider.name, category: rider.cat })
      if (r.error?.code === '23505') throw new Error(`Número #${rider.num} já existe`)
      ensure(r)
      await pull()
    },

    async updateRider(oldNum, updated) {
      const r = await sb
        .from('riders')
        .update({ num: updated.num, name: updated.name, category: updated.cat })
        .eq('num', oldNum)

      if (r.error?.code === '23505') throw new Error(`Número #${updated.num} já está em uso por outro piloto`)
      ensure(r)
      await pull()
    },

    async removeRider(num) {
      ensure(await sb.from('riders').delete().eq('num', num))
      await pull()
    },

    async startRun(num, stageId) {
      const st = view()
      const rider = st.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      
      // Bloqueia se o piloto não tiver categoria configurada
      if (!rider.cat || rider.cat === 'Sem Categoria' || rider.cat.trim() === '') {
        throw new Error(`Piloto #${rider.num} (${rider.name}) está sem categoria. Configure a categoria em "Pilotos" antes de iniciar a descida.`)
      }

      const targetStageId = stageId || st.stages[0]?.id || 'stage-1'
      const stage = st.stages.find((s) => s.id === targetStageId)
      const stageName = stage ? stage.name : 'Especial'

      if (st.runs.some((r) => r.num === num && r.status === 'track')) {
        throw new Error(`${rider.name} já está na pista neste momento!`)
      }
      if (st.runs.some((r) => r.num === num && r.stageId === targetStageId && (r.status === 'done' || r.status === 'dnf'))) {
        throw new Error(`${rider.name} já possui descida registrada na ${stageName}`)
      }

      const id = crypto.randomUUID()
      enqueue({
        id,
        kind: 'start',
        num,
        stageId: targetStageId,
        at: nowSrv(),
        label: `Largada · ${who(num)} (${stageName})`,
      })
      return view().runs.find((r) => r.id === id) ?? null
    },

    async finishRun(num, atEpochMs, stageId) {
      const st = view()
      const rider = st.riders.find((r) => r.num === num)
      if (!rider) throw new Error(`Piloto #${num} não cadastrado`)
      const open = st.runs.find((r) => r.num === num && r.status === 'track' && (!stageId || r.stageId === stageId))
      if (!open) {
        if (online) throw new Error(`${rider.name} não está na pista`)
        if (queue.some((o) => o.kind === 'finish' && o.num === num)) {
          throw new Error(`Chegada de ${rider.name} já foi guardada`)
        }
        notice(`Sem conexão: chegada de ${rider.name} guardada e será validada ao sincronizar.`)
      }
      const finishTime = atEpochMs ?? nowSrv()
      enqueue({
        id: crypto.randomUUID(),
        kind: 'finish',
        num,
        stageId: open?.stageId || stageId,
        at: finishTime,
        label: `Chegada · ${who(num)}`,
      })
      return open ? (view().runs.find((r) => r.id === open.id) ?? null) : null
    },

    async dnfRun(id) {
      const run = view().runs.find((r) => r.id === id)
      if (!run) return
      enqueue({ id: crypto.randomUUID(), kind: 'dnf', runId: id, at: nowSrv(), label: `DNF/DSQ · ${who(run.num)}` })
    },

    async undoRun(id) {
      const run = view().runs.find((r) => r.id === id)
      if (!run) return
      enqueue({ id: crypto.randomUUID(), kind: 'undo', runId: id, at: nowSrv(), label: `Desfazer · ${who(run.num)}` })
    },

    async loadDemo() {
      // Limpa descidas anteriores para deixar sem tempos preenchidos
      await sb.from('runs').delete().neq('id', '')
      ensure(await sb.from('riders').upsert(DEMO_RIDERS.map((r) => ({ num: r.num, name: r.name, category: r.cat }))))
      server.stages = [...DEMO_STAGES]
      server.categories = [...DEFAULT_CATEGORIES]
      writeJson(CACHE_KEY, server)
      await pull()
    },

    async reset() {
      ensure(await sb.from('riders').delete().neq('num', ''))
      queue = []
      saveQueue()
      await pull()
    },
  }
}
