export const DEFAULT_CATEGORIES = ['Elite Masculino', 'Elite Feminino']

export interface Stage {
  id: string
  name: string
  order: number
}

export const DEFAULT_STAGES: Stage[] = [
  { id: 'stage-1', name: 'E1 - SPET', order: 1 },
  { id: 'stage-2', name: 'E2 - Erechim', order: 2 },
  { id: 'stage-3', name: 'E3 - teste', order: 3 },
]

export type RunStatus = 'track' | 'done' | 'dnf'

export interface Rider {
  num: string
  name: string
  cat: string
}

export interface StartGridItem {
  num: string
  riderName: string
  category: string
  scheduledTimeStr: string
  scheduledEpoch: number
  stageId?: string
}

/** Uma descida em uma especial/trilha. `start`/`end` são epoch em ms (horário do servidor no modo Supabase). */
export interface Run {
  id: string
  num: string
  stageId?: string
  start: number
  end: number | null
  status: RunStatus
}

/** Papel do aparelho no evento: público só lê; fiscal registra largada e chegada; organizador faz tudo. */
export type Role = 'public' | 'marshal' | 'organizer'

export interface Access {
  role: Role
  /** E-mail do organizador logado. */
  email?: string
}

/** Situação do código do fiscal do evento (tela do organizador). */
export interface MarshalAccessInfo {
  hasCode: boolean
  codeUpdatedAt: number | null
  /** Aparelhos liberados como fiscal. */
  marshals: number
}

/** Resumo de uma importação em massa. */
export interface ImportResult {
  added: number
  updated: number
  categoriesAdded: number
}

/** Dados de um evento (prova). */
export interface EventInfo {
  id: string
  name: string
  /** Data da prova (AAAA-MM-DD). */
  startsOn: string
  location?: string
  status: 'rascunho' | 'aberto' | 'encerrado'
}

export interface AppState {
  /** Evento em uso (as listas abaixo são dele). */
  event?: EventInfo
  riders: Rider[]
  runs: Run[]
  categories: string[]
  stages: Stage[]
  /** Ordem de largada de todas as especiais (por especial, na ordem de largada). */
  grid: StartGridItem[]
}

export interface SyncStatus {
  /** Último contato com o servidor deu certo. */
  online: boolean
  /** Enviando a fila neste momento. */
  syncing: boolean
  /** Quantidade de ações aguardando envio. */
  pending: number
}

/** Ação registrada no aparelho que ainda não foi confirmada pelo servidor. */
export interface PendingOp {
  id: string
  label: string
  /** Horário em que a ação aconteceu (epoch ms). */
  at: number
  /** Tentativas em que o servidor pediu para aguardar (ex.: largada ainda não chegou). */
  attempts: number
}

/**
 * Contrato da camada de dados. Há duas implementações:
 * - localApi: localStorage (protótipo, sincroniza só entre abas)
 * - supabaseApi: banco em tempo real, com fila offline e horário corrigido pelo servidor
 * Os métodos lançam `Error` com mensagem pronta para exibir ao usuário.
 */
export interface Api {
  mode: 'local' | 'supabase'
  /** Estado atual já com as ações pendentes aplicadas (resposta imediata, sem rede). */
  load(): Promise<AppState>
  /** Avisa quando algo mudou (aqui ou em outro dispositivo). Retorna função para cancelar. */
  subscribe(onChange: () => void): () => void
  /** Diferença (ms) entre o relógio do servidor e o do aparelho. */
  getClockOffset(): number
  getSync(): SyncStatus
  getPending(): PendingOp[]
  /** Tenta enviar a fila agora. */
  syncNow(): Promise<void>
  /** Remove uma ação da fila sem enviá-la. */
  discardPending(id: string): void
  /** Avisos assíncronos (ex.: ação rejeitada pelo servidor ao sincronizar). */
  onNotice(cb: (msg: string, isError: boolean) => void): () => void
  /** Papel deste aparelho no evento em uso (guardado no aparelho: vale sem sinal). */
  getAccess(): Access
  /** Fiscal entra com o código do evento (no modo local, com o PIN). */
  joinWithCode(code: string): Promise<void>
  /** Organizador entra com e-mail e senha (só com o Supabase). */
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** Gera ou troca o código do fiscal; `revoke` tira o acesso de quem entrou com o código anterior. */
  generateMarshalCode(revoke: boolean): Promise<string>
  getMarshalAccessInfo(): Promise<MarshalAccessInfo | null>
  addCategory(name: string): Promise<void>
  updateCategory(oldName: string, newName: string): Promise<void>
  removeCategory(name: string): Promise<void>
  addStage(name: string): Promise<void>
  updateStage(id: string, name: string): Promise<void>
  removeStage(id: string): Promise<void>
  /** Substitui a ordem de largada de uma especial (lista vazia limpa a especial). */
  setStageGrid(stageId: string, items: StartGridItem[]): Promise<void>
  /** Limpa a ordem de largada de todas as especiais. */
  clearAllGrids(): Promise<void>
  addRider(rider: Rider): Promise<void>
  updateRider(oldNum: string, updated: Rider): Promise<void>
  removeRider(num: string): Promise<void>
  /** Cadastra ou atualiza (pelo número) vários pilotos de uma vez e cria as categorias que faltarem. */
  importRiders(riders: Rider[], categories: string[]): Promise<ImportResult>
  startRun(num: string, stageId?: string): Promise<Run | null>
  finishRun(num: string, atEpochMs?: number, stageId?: string): Promise<Run | null>
  dnfRun(id: string): Promise<void>
  undoRun(id: string): Promise<void>
  loadDemo(): Promise<void>
  reset(): Promise<void>
}
