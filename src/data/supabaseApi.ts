import { createClient } from '@supabase/supabase-js'
import type { Access, Api, AppState, AthleteEntry, AthleteSummary, EventInfo, MarshalAccessInfo, NewEvent, PendingOp, Rider, Role, Run, RunStatus, SyncStatus, Stage, StartGridItem } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_STAGES } from '../types'
import { DEMO_RIDERS, DEMO_STAGES } from './demo'
import { clock } from '../lib/time'

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
 * - Tudo vale para o evento em uso: lido do aparelho ou, na primeira vez, o evento aberto mais recente.
 */

const CACHE_KEY = 'mtb-cache-v1'
const QUEUE_KEY = 'mtb-queue-v1'
const OFFSET_KEY = 'mtb-offset-v1'
const EVENT_KEY = 'mtb-event-v1'
const ACCESS_KEY = 'mtb-access-v1'

const OFFLINE_MSG = 'Sem conexão. Tente novamente quando houver sinal.'
const SCHEMA_MSG = 'O banco precisa ser atualizado: rode supabase/schema.sql no Supabase.'
const DENIED_MSG = 'Sem permissão para enviar: entre de novo com o código do fiscal. As ações continuam guardadas.'
const ANON_DISABLED_MSG = 'O login anônimo está desligado no Supabase. Ative em Authentication > Sign In / Providers > Allow anonymous sign-ins.'
const REQUEST_TIMEOUT_MS = 8000
/** Chegada sem largada correspondente é descartada depois deste tempo. */
const WAIT_GIVE_UP_MS = 30 * 60 * 1000

interface RunRow {
  id: string
  rider_num: string
  stage_id: string | null
  started_at: string
  finished_at: string | null
  status: RunStatus
}

interface StageRow {
  id: string
  name: string
  position: number
}

interface GridRow {
  stage_id: string
  rider_num: string
  position: number
  scheduled_at: string
}

interface RiderRow {
  num: string
  name: string
  category: string
  athlete_id: string | null
  // Equipe vem do atleta (embutido pela chave estrangeira)
  athletes: { team: string | null } | { team: string | null }[] | null
}

interface EventRow {
  id: string
  name: string
  starts_on: string
  location: string | null
  status: EventInfo['status']
  public_code: string | null
}

const EVENT_COLUMNS = 'id,name,starts_on,location,status,public_code'

const toEvent = (e: EventRow): EventInfo => ({
  id: e.id,
  name: e.name,
  startsOn: e.starts_on,
  location: e.location ?? undefined,
  status: e.status,
  publicCode: e.public_code ?? undefined,
})

type OpKind = 'start' | 'finish' | 'dnf' | 'undo'

interface Op {
  id: string
  kind: OpKind
  num?: string
  stageId?: string
  runId?: string
  /** Evento da ação (ações gravadas por versões antigas não têm: vão para o evento em uso). */
  eventId?: string
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

type Outcome = 'ok' | 'network' | 'wait' | 'blocked' | 'denied' | 'rejected'

const toRun = (r: RunRow, fallbackStageId: string): Run => ({
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
  // Sessão expirada ou acesso revogado: guarda a ação até o fiscal entrar de novo
  if (r.error.code === 'MTB08') return 'denied'
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
  return {
    event: server.event,
    events: server.events,
    riders: server.riders,
    runs,
    categories: server.categories,
    stages: server.stages || [...DEFAULT_STAGES],
    grid: server.grid,
  }
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey, { global: { fetch: timeoutFetch } })

  let server: AppState = readJson<AppState>(CACHE_KEY, {
    riders: [],
    runs: [],
    categories: [...DEFAULT_CATEGORIES],
    stages: [...DEFAULT_STAGES],
    grid: [],
  })
  if (!server.stages || server.stages.length === 0) {
    server.stages = [...DEFAULT_STAGES]
  }
  if (!server.grid) server.grid = [] // cache de versões antigas
  /** Evento em uso; null até a primeira busca escolher um. */
  let eventId: string | null = readJson<string | null>(EVENT_KEY, null) ?? server.event?.id ?? null
  let eventList: EventInfo[] = server.events ?? []
  let queue: Op[] = readJson<Op[]>(QUEUE_KEY, [])
  let clockOffset = readJson<number>(OFFSET_KEY, 0)
  let online = typeof navigator === 'undefined' ? true : navigator.onLine
  let syncing = false
  let lastOk: number | undefined
  let pulling = false
  let flushing = false

  // Papel do aparelho no evento, guardado para valer sem sinal
  let access: Access & { eventId?: string } = readJson<Access & { eventId?: string }>(ACCESS_KEY, { role: 'public' })
  let deniedWarned = false

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
    // Regra de acesso do banco recusou a gravação direta
    if (r.error.code === '42501') throw new Error('Sem permissão: só o organizador pode fazer isso.')
    throw new Error(r.error.message)
  }

  function setAccess(next: Access & { eventId?: string }) {
    if (next.role === access.role && next.email === access.email && next.eventId === access.eventId) return
    access = next
    writeJson(ACCESS_KEY, access)
    emit()
  }

  /** Confere no servidor o papel deste aparelho no evento em uso (sem sinal, mantém o que estava). */
  async function refreshAccess() {
    const { data } = await sb.auth.getSession()
    const session = data.session
    if (!session) return setAccess({ role: 'public' })
    if (!eventId) return
    const r = await sb.rpc('my_access', { p_event: eventId })
    if (r.error) return
    const role = r.data as Role
    if (role !== 'public') deniedWarned = false
    setAccess({ role, email: session.user.email ?? undefined, eventId })
  }

  /**
   * Escolhe o evento em uso: o que o aparelho já usava, se ainda existir; senão o aberto mais
   * recente (ou o mais recente de todos). Devolve null se a tabela de eventos não existir.
   */
  async function resolveEvent(): Promise<EventInfo | null> {
    const r = await sb.from('events').select(EVENT_COLUMNS).order('starts_on', { ascending: false }).order('created_at', { ascending: false })
    if (r.error) {
      if (classify({ error: r.error, status: r.status }) === 'network') setOnline(false)
      else warnSchema() // banco ainda sem eventos: rode o schema.sql novo
      return null
    }
    const list = ((r.data ?? []) as EventRow[]).map(toEvent)
    eventList = list
    const chosen = list.find((e) => e.id === eventId) ?? list.find((e) => e.status === 'aberto') ?? list[0] ?? null
    if (chosen && chosen.id !== eventId) {
      eventId = chosen.id
      writeJson(EVENT_KEY, eventId)
    }
    return chosen
  }

  /** Busca o estado do servidor (do evento em uso) e guarda em cache. */
  async function pull(): Promise<boolean> {
    if (pulling) return online
    pulling = true
    try {
      const event = await resolveEvent()
      if (!event) return false
      const ev = event.id
      const [riders, runs, categories, stages, grid] = await Promise.all([
        sb.from('riders').select('num,name,category,athlete_id,athletes(team)').eq('event_id', ev).order('num'),
        sb.from('runs').select('id,rider_num,stage_id,started_at,finished_at,status').eq('event_id', ev).order('started_at'),
        sb.from('categories').select('name').eq('event_id', ev).order('name'),
        sb.from('stages').select('id,name,position').eq('event_id', ev).order('position'),
        sb.from('start_grid').select('stage_id,rider_num,position,scheduled_at').eq('event_id', ev).order('position'),
      ])
      if (riders.error || runs.error) {
        const failed = runs.error ? runs : riders
        if (classify({ error: failed.error, status: failed.status }) === 'network') setOnline(false)
        else warnSchema() // ex.: coluna runs.stage_id ainda não existe
        return false
      }
      if (stages.error || grid.error) warnSchema()

      // Se a tabela categories não existir ainda no Supabase, usa o cache atual ou as categorias dos pilotos
      let cats: string[] = server.categories || [...DEFAULT_CATEGORIES]
      if (!categories.error && categories.data) {
        cats = categories.data.map((c: { name: string }) => c.name)
      } else if (riders.data && riders.data.length > 0) {
        const fromRiders = Array.from(new Set(riders.data.map((r: { category: string }) => r.category)))
        cats = Array.from(new Set([...cats, ...fromRiders]))
      }

      // Especiais: do banco; se a tabela ainda não existir, mantém o que estava em cache
      const stageRows = (stages.data ?? []) as StageRow[]
      const stageList: Stage[] =
        !stages.error && stageRows.length > 0
          ? stageRows.map((s) => ({ id: s.id, name: s.name, order: s.position }))
          : server.stages && server.stages.length > 0
            ? server.stages
            : [...DEFAULT_STAGES]
      const firstStageId = stageList[0]?.id ?? 'stage-1'

      const riderList: Rider[] = ((riders.data ?? []) as RiderRow[]).map((r) => ({
        num: r.num,
        name: r.name,
        cat: r.category,
        team: (Array.isArray(r.athletes) ? r.athletes[0] : r.athletes)?.team ?? undefined,
        athleteId: r.athlete_id ?? undefined,
      }))

      // Grade: nome e categoria vêm do cadastro do piloto; ordem = especial, depois posição
      const stageIndex = (id: string) => stageList.findIndex((s) => s.id === id)
      const gridList: StartGridItem[] = grid.error
        ? server.grid
        : ((grid.data ?? []) as GridRow[])
            .slice()
            .sort((a, b) => stageIndex(a.stage_id) - stageIndex(b.stage_id) || a.position - b.position)
            .flatMap((g) => {
              const rider = riderList.find((r) => r.num === g.rider_num)
              if (!rider) return []
              const at = new Date(g.scheduled_at).getTime()
              return [
                {
                  num: g.rider_num,
                  riderName: rider.name,
                  category: rider.cat,
                  scheduledEpoch: at,
                  scheduledTimeStr: clock(at),
                  stageId: g.stage_id,
                },
              ]
            })

      server = {
        event,
        events: eventList,
        riders: riderList,
        runs: ((runs.data ?? []) as RunRow[]).map((r) => toRun(r, firstStageId)),
        categories: cats.length > 0 ? cats : [...DEFAULT_CATEGORIES],
        stages: stageList,
        grid: gridList,
      }
      writeJson(CACHE_KEY, server)
      online = true
      lastOk = nowSrv()
      emit()
      void refreshAccess()
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
    const stage = op.stageId ?? null
    const ev = op.eventId ?? eventId
    if (op.kind === 'start') return sb.rpc('start_run', { p_event: ev, p_num: op.num, p_at: at, p_id: op.id, p_stage: stage })
    if (op.kind === 'finish') return sb.rpc('finish_run', { p_event: ev, p_num: op.num, p_at: at, p_stage: stage })
    if (op.kind === 'dnf') return sb.rpc('dnf_run', { p_id: op.runId, p_at: at })
    return sb.rpc('undo_run', { p_id: op.runId })
  }

  let schemaWarned = false
  function warnSchema() {
    if (schemaWarned) return
    schemaWarned = true
    notice(SCHEMA_MSG, true)
  }

  const removeOp = (id: string) => {
    queue = queue.filter((o) => o.id !== id)
  }

  /** Envia a fila em ordem. */
  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return
    // Ações gravadas antes da atualização não têm evento: só envia depois de saber qual é o evento em uso
    if (!eventId && queue.some((o) => !o.eventId) && !(await resolveEvent())) return
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
          lastOk = nowSrv()
        } else if (outcome === 'network') {
          online = false
          break
        } else if (outcome === 'denied') {
          // Sem permissão (sessão expirou ou o código foi trocado): nada é descartado
          const retryAt = Date.now() + 30000
          queue.forEach((o) => (o.nextTry = retryAt))
          if (!deniedWarned) notice(DENIED_MSG, true)
          deniedWarned = true
          void refreshAccess()
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

  function enqueue(op: Omit<Op, 'createdAt' | 'attempts' | 'eventId'>) {
    queue = [...queue, { ...op, eventId: eventId ?? undefined, createdAt: Date.now(), attempts: 0 }]
    saveQueue()
    emit()
    void flush()
  }

  /** Grava a equipe dos atletas (fica no atleta, vale para todos os eventos dele). Só os que trazem `team`. */
  async function setTeams(riders: Rider[]) {
    const items = riders.filter((r) => r.team !== undefined).map((r) => ({ num: r.num, team: r.team ?? '' }))
    if (items.length === 0) return
    ensure(await sb.rpc('set_teams', { p_event: ev(), p_items: items }))
  }

  /** Evento em uso para gravar cadastros; sem ele (nunca carregou) não dá para gravar. */
  const ev = (): string => {
    if (!eventId) throw new Error(online ? 'Carregando o evento. Tente de novo em instantes.' : OFFLINE_MSG)
    return eventId
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
  // Login, saída ou renovação da sessão em outra aba: confere o papel de novo
  sb.auth.onAuthStateChange(() => {
    setTimeout(() => void refreshAccess(), 0)
  })

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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stages' }, () => void pull())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'start_grid' }, () => void pull())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => void pull())
        .subscribe()
      return () => {
        listeners.delete(onChange)
        void sb.removeChannel(channel)
      }
    },

    getClockOffset: () => clockOffset,

    getSync(): SyncStatus {
      return { online, syncing, pending: queue.length, lastOk }
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

    getAccess(): Access {
      // O papel de fiscal só vale para o evento em que foi conferido; o de organizador vale para todos
      if (access.role === 'marshal' && access.eventId && eventId && access.eventId !== eventId) return { role: 'public' }
      return { role: access.role, email: access.email }
    },

    async joinWithCode(code) {
      const { data } = await sb.auth.getSession()
      if (!data.session) {
        const r = await sb.auth.signInAnonymously()
        if (r.error) {
          if (r.error.status === 0 || !navigator.onLine) throw new Error(OFFLINE_MSG)
          throw new Error(/anonymous/i.test(r.error.message) ? ANON_DISABLED_MSG : r.error.message)
        }
      }
      const r = await sb.rpc('join_event', { p_code: code })
      ensure(r)
      if (!r.data) throw new Error('Código inválido. Confira com o organizador.')
      // O código leva ao evento dele, mesmo que o aparelho estivesse em outro
      if (r.data !== eventId) {
        eventId = r.data as string
        writeJson(EVENT_KEY, eventId)
      }
      await pull()
      await refreshAccess()
      if (access.role === 'public') throw new Error('Não foi possível liberar o aparelho. Tente de novo.')
      void flush()
    },

    async signIn(email, password) {
      const r = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (r.error) {
        if (r.error.status === 0 || !navigator.onLine) throw new Error(OFFLINE_MSG)
        throw new Error(r.error.code === 'invalid_credentials' ? 'E-mail ou senha incorretos' : r.error.message)
      }
      // Confere direto no servidor: um erro aqui (ex.: evento ainda não carregado) não pode virar "não é organizador"
      const role = await sb.rpc('my_access', { p_event: ev() })
      if (role.error || role.data !== 'organizer') {
        await sb.auth.signOut()
        setAccess({ role: 'public' })
        ensure(role)
        throw new Error('Este usuário não está cadastrado como organizador. Rode o insert into organizers do passo 5 com este e-mail.')
      }
      await refreshAccess()
      void flush()
    },

    async signOut() {
      await sb.auth.signOut().catch(() => undefined)
      setAccess({ role: 'public' })
    },

    async generateMarshalCode(revoke) {
      const r = await sb.rpc('set_marshal_code', { p_event: ev(), p_revoke: revoke })
      ensure(r)
      return r.data as string
    },

    async getMarshalAccessInfo(): Promise<MarshalAccessInfo | null> {
      const r = await sb.rpc('event_access_info', { p_event: ev() })
      ensure(r)
      const row = (r.data as { has_code: boolean; code_updated_at: string | null; marshals: number }[] | null)?.[0]
      if (!row) return null
      return {
        hasCode: row.has_code,
        codeUpdatedAt: row.code_updated_at ? new Date(row.code_updated_at).getTime() : null,
        marshals: row.marshals,
      }
    },

    async selectEvent(id) {
      if (id === eventId) return
      eventId = id
      writeJson(EVENT_KEY, eventId)
      // Não mostra os dados do evento anterior enquanto os novos chegam
      server = { ...server, event: eventList.find((e) => e.id === id), riders: [], runs: [], categories: [], stages: [], grid: [] }
      emit()
      await pull()
    },

    async findEventByCode(code) {
      const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '')
      if (!clean) return null
      const r = await sb.from('events').select(EVENT_COLUMNS).eq('public_code', clean).maybeSingle()
      ensure(r)
      return r.data ? toEvent(r.data as EventRow) : null
    },

    async createEvent(input: NewEvent) {
      const r = await sb.rpc('create_event', {
        p_name: input.name,
        p_starts_on: input.startsOn,
        p_location: input.location ?? null,
        p_copy_from: input.copyFrom ?? null,
      })
      ensure(r)
      await pull()
      return r.data as string
    },

    async updateEvent(id, patch) {
      const row: Record<string, unknown> = {}
      if (patch.name !== undefined) row.name = patch.name.trim()
      if (patch.startsOn !== undefined) row.starts_on = patch.startsOn
      if (patch.location !== undefined) row.location = patch.location.trim() || null
      if (patch.status !== undefined) row.status = patch.status
      const r = await sb.from('events').update(row).eq('id', id).select('id')
      ensure(r)
      // Sem linha alterada = a regra de acesso recusou em silêncio
      if (!r.data?.length) throw new Error('Sem permissão: só o organizador pode editar eventos.')
      await pull()
    },

    async getEventStats(id) {
      const count = async (table: 'riders' | 'runs') => {
        const r = await sb.from(table).select('event_id', { count: 'exact', head: true }).eq('event_id', id)
        ensure(r)
        return r.count ?? 0
      }
      const [riders, runs] = await Promise.all([count('riders'), count('runs')])
      return { riders, runs }
    },

    async deleteEvent(id) {
      const r = await sb.from('events').delete().eq('id', id).select('id')
      ensure(r)
      if (!r.data?.length) throw new Error('Sem permissão: só o organizador pode excluir eventos.')
      // O banco apaga em cascata tudo do evento; se era o evento em uso, o app escolhe outro
      if (id === eventId) {
        eventId = null
        writeJson(EVENT_KEY, null)
      }
      await pull()
    },

    async addCategory(name: string) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio')
      if (server.categories.includes(trimmed)) throw new Error(`Categoria "${trimmed}" já existe`)

      // Tenta inserir na tabela categories
      const { error } = await sb.from('categories').insert({ event_id: ev(), name: trimmed })
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

    async updateCategory(oldName: string, newName: string) {
      const trimmed = newName.trim()
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio')
      if (oldName !== trimmed && server.categories.includes(trimmed)) {
        throw new Error(`Categoria "${trimmed}" já existe`)
      }

      // Atualiza os atletas vinculados a esta categoria no Supabase (a grade acompanha, pois lê do piloto)
      ensure(await sb.from('riders').update({ category: trimmed }).eq('event_id', ev()).eq('category', oldName))

      // Atualiza o nome na tabela categories
      const { error } = await sb.from('categories').update({ name: trimmed }).eq('event_id', ev()).eq('name', oldName)
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        ensure({ error, status: 400 })
      }

      const idx = server.categories.indexOf(oldName)
      if (idx !== -1) {
        server.categories[idx] = trimmed
      }
      server.riders = server.riders.map((r) => (r.cat === oldName ? { ...r, cat: trimmed } : r))
      writeJson(CACHE_KEY, server)
      emit()
      await pull()
    },

    async removeCategory(name: string) {
      ensure(await sb.from('riders').update({ category: 'Sem Categoria' }).eq('event_id', ev()).eq('category', name))
      const { error } = await sb.from('categories').delete().eq('event_id', ev()).eq('name', name)
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
      const position = Math.max(0, ...server.stages.map((s) => s.order)) + 1
      ensure(await sb.from('stages').insert({ event_id: ev(), id: `stage-${Date.now()}`, name: trimmed, position }))
      await pull()
    },

    async updateStage(id: string, name: string) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome da especial não pode ser vazio')
      ensure(await sb.from('stages').update({ name: trimmed }).eq('event_id', ev()).eq('id', id))
      await pull()
    },

    async removeStage(id: string) {
      if (server.stages.length <= 1) {
        throw new Error('A prova precisa de pelo menos uma especial cadastrada')
      }
      // O banco apaga em cascata as descidas e a grade da especial e renumera as demais
      ensure(await sb.rpc('remove_stage', { p_event: ev(), p_id: id }))
      await pull()
    },

    async setStageGrid(stageId, items) {
      const p_items = items.map((i, idx) => ({
        num: i.num,
        position: idx + 1,
        at: new Date(i.scheduledEpoch).toISOString(),
      }))
      ensure(await sb.rpc('set_start_grid', { p_event: ev(), p_stage: stageId, p_items }))
      await pull()
    },

    async clearAllGrids() {
      ensure(await sb.rpc('set_start_grid', { p_event: ev(), p_stage: null }))
      await pull()
    },

    async searchAthletes(query): Promise<AthleteSummary[]> {
      if (query.trim().length < 2) return []
      const r = await sb.rpc('search_athletes', { p_query: query, p_limit: 8 })
      ensure(r)
      return ((r.data ?? []) as { id: string; name: string; team: string | null; city: string | null; events: number }[]).map((a) => ({
        id: a.id,
        name: a.name,
        team: a.team ?? undefined,
        city: a.city ?? undefined,
        events: a.events,
      }))
    },

    async getAthleteHistory(athleteId): Promise<AthleteEntry[]> {
      const r = await sb.from('riders').select('num,category,event_id,events!riders_event_fkey(name,starts_on)').eq('athlete_id', athleteId)
      ensure(r)
      type Row = { num: string; category: string; event_id: string; events: { name: string; starts_on: string } | { name: string; starts_on: string }[] | null }
      return ((r.data ?? []) as Row[])
        .map((row) => {
          const e = Array.isArray(row.events) ? row.events[0] : row.events
          return { eventId: row.event_id, eventName: e?.name ?? 'Evento', startsOn: e?.starts_on ?? '', num: row.num, category: row.category }
        })
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
    },

    async addRider(rider) {
      const r = await sb.from('riders').insert({ event_id: ev(), num: rider.num, name: rider.name, category: rider.cat })
      if (r.error?.code === '23505') throw new Error(`Número #${rider.num} já existe`)
      ensure(r)
      await setTeams([rider])
      await pull()
    },

    async updateRider(oldNum, updated) {
      const r = await sb
        .from('riders')
        .update({ num: updated.num, name: updated.name, category: updated.cat })
        .eq('event_id', ev())
        .eq('num', oldNum)

      if (r.error?.code === '23505') throw new Error(`Número #${updated.num} já está em uso por outro piloto`)
      ensure(r)
      await setTeams([updated])
      await pull()
    },

    async removeRider(num) {
      ensure(await sb.from('riders').delete().eq('event_id', ev()).eq('num', num))
      await pull()
    },

    async importRiders(riders, categories) {
      const known = new Set(server.riders.map((r) => r.num))
      const newCats = categories.filter((c) => !server.categories.includes(c))
      if (newCats.length > 0) {
        ensure(await sb.from('categories').upsert(newCats.map((name) => ({ event_id: ev(), name })), { onConflict: 'event_id,name', ignoreDuplicates: true }))
      }
      if (riders.length > 0) {
        ensure(
          await sb
            .from('riders')
            .upsert(riders.map((r) => ({ event_id: ev(), num: r.num, name: r.name, category: r.cat })), { onConflict: 'event_id,num' }),
        )
        await setTeams(riders)
      }
      await pull()
      const updated = riders.filter((r) => known.has(r.num)).length
      return { added: riders.length - updated, updated, categoriesAdded: newCats.length }
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
      // Limpa descidas e grades anteriores para deixar sem tempos preenchidos
      ensure(await sb.from('runs').delete().eq('event_id', ev()))
      ensure(await sb.rpc('set_start_grid', { p_event: ev(), p_stage: null }))
      ensure(await sb.from('stages').upsert(DEMO_STAGES.map((s) => ({ event_id: ev(), id: s.id, name: s.name, position: s.order })), { onConflict: 'event_id,id' }))
      ensure(
        await sb
          .from('categories')
          .upsert(DEFAULT_CATEGORIES.map((name) => ({ event_id: ev(), name })), { onConflict: 'event_id,name', ignoreDuplicates: true }),
      )
      ensure(await sb.from('riders').upsert(DEMO_RIDERS.map((r) => ({ event_id: ev(), num: r.num, name: r.name, category: r.cat })), { onConflict: 'event_id,num' }))
      await pull()
    },

    async reset() {
      ensure(await sb.from('riders').delete().eq('event_id', ev()))
      queue = []
      saveQueue()
      await pull()
    },
  }
}
