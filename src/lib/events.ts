import type { EventInfo } from '../types'

/** Hoje no fuso do aparelho, no formato da data do evento (AAAA-MM-DD). */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "sáb., 20/11/2026" (a data vem sem hora: lida como dia local, não UTC). */
export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const statusLabel: Record<EventInfo['status'], string> = {
  rascunho: 'Rascunho',
  aberto: 'Aberto',
  encerrado: 'Encerrado',
}

/** Abertos primeiro (de hoje, depois os próximos, depois os passados), encerrados por último. */
export function sortEvents(list: EventInfo[]): { open: EventInfo[]; closed: EventInfo[] } {
  const today = todayIso()
  const rank = (e: EventInfo) => (e.startsOn === today ? 0 : e.startsOn > today ? 1 : 2)
  const open = list
    .filter((e) => e.status !== 'encerrado')
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? a.startsOn.localeCompare(b.startsOn) : b.startsOn.localeCompare(a.startsOn)))
  const closed = list.filter((e) => e.status === 'encerrado').sort((a, b) => b.startsOn.localeCompare(a.startsOn))
  return { open, closed }
}
