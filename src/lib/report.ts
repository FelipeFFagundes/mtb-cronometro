import type { AppState, Stage } from '../types'
import { buildEnduroRanking, type EnduroRankRow } from './ranking'
import { fmt } from './time'

/*
 * Dados do relatório de resultados (usados pelo PDF e pela imagem).
 * Uma seção por categoria, cada uma com a própria classificação e diferenças para o líder dela.
 */

export interface ReportRow {
  /** Posição na categoria (null = sem resultado válido). */
  pos: number | null
  num: string
  name: string
  /** Geral: tempo de cada especial. Especial: só o tempo dela. */
  cells: string[]
  total: string
  gap: string
}

export interface ReportSection {
  category: string
  rows: ReportRow[]
}

export interface Report {
  title: string
  /** Ex.: "Classificação geral" ou "E2 - Erechim". */
  scope: string
  generatedAt: Date
  /** Cabeçalhos das colunas de tempo (antes do total). */
  columns: string[]
  /** Geral: há colunas por especial + total. */
  overall: boolean
  sections: ReportSection[]
}

/** Rótulo curto da especial para cabeçalho de tabela ("E2 - Erechim" → "E2"). */
export function stageLabel(st: Stage): string {
  const head = st.name.split(/\s+[-–·]\s+/)[0]?.trim()
  return head && head.length <= 6 ? head : `E${st.order}`
}

function overallRow(row: EnduroRankRow, pos: number | null, stages: Stage[]): ReportRow {
  const cells = stages.map((st) => {
    const p = row.stagePerformances[st.id]
    if (p?.status === 'done' && p.time != null) return fmt(p.time)
    if (p?.status === 'dnf') return 'DNF'
    if (p?.status === 'track') return 'pista'
    return '—'
  })
  const started = Object.values(row.stagePerformances).some((p) => p.status !== 'none')
  let total = '—'
  let gap = ''
  if (row.hasDnf) total = 'DNF'
  else if (!started) total = 'DNS'
  else if (row.completedCount > 0) {
    total = fmt(row.totalTime)
    if (!row.isCompletedAll) gap = `${row.completedCount}/${stages.length} esp.`
    else if (pos !== 1) gap = `+${fmt(row.totalGap)}`
  }
  return { pos, num: row.rider.num, name: row.rider.name, cells, total, gap }
}

function stageRow(row: EnduroRankRow, pos: number | null, stageId: string): ReportRow {
  const p = row.stagePerformances[stageId]
  let total = 'DNS'
  let gap = ''
  if (p?.status === 'done' && p.time != null) {
    total = fmt(p.time)
    if (pos !== 1 && p.stageGap != null) gap = `+${fmt(p.stageGap)}`
  } else if (p?.status === 'dnf') total = 'DNF'
  else if (p?.status === 'track') total = 'Na pista'
  return { pos, num: row.rider.num, name: row.rider.name, cells: [], total, gap }
}

export function buildReport(state: AppState, opts: { title: string; stageId: string; category: string }): Report {
  const overall = opts.stageId === 'all'
  const stages = state.stages
  const stage = stages.find((s) => s.id === opts.stageId)

  // Categorias cadastradas, mais as que só aparecem nos atletas (ex.: "Sem Categoria")
  const allCats = [...state.categories]
  state.riders.forEach((r) => {
    if (r.cat && !allCats.includes(r.cat)) allCats.push(r.cat)
  })
  const cats = opts.category === 'Todas' ? allCats : [opts.category]

  const sections: ReportSection[] = []
  for (const category of cats) {
    const { rows } = buildEnduroRanking(state, category, opts.stageId)
    if (rows.length === 0) continue
    let pos = 0
    sections.push({
      category,
      rows: rows.map((row) => {
        const ranked = overall ? row.completedCount > 0 && !row.hasDnf : row.stagePerformances[opts.stageId]?.status === 'done'
        const p = ranked ? ++pos : null
        return overall ? overallRow(row, p, stages) : stageRow(row, p, opts.stageId)
      }),
    })
  }

  return {
    title: opts.title.trim() || 'Resultado',
    scope: overall ? 'Classificação geral' : (stage?.name ?? 'Especial'),
    generatedAt: new Date(),
    columns: overall ? stages.map(stageLabel) : [],
    overall,
    sections,
  }
}

export function reportFileName(report: Report, ext: string): string {
  const slug = `${report.title} ${report.scope}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'resultado'}.${ext}`
}

export function formatGeneratedAt(d: Date): string {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Logo reduzido em PNG (data URL) com a proporção original; null se não carregar. */
export async function loadLogo(maxH: number): Promise<{ data: string; w: number; h: number; img: HTMLImageElement } | null> {
  try {
    const img = new Image()
    img.src = '/logo.png'
    await img.decode()
    const h = maxH
    const w = Math.round((img.naturalWidth / img.naturalHeight) * h)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return { data: canvas.toDataURL('image/png'), w, h, img }
  } catch {
    return null
  }
}

/** No celular abre o compartilhamento (WhatsApp, Drive…); no computador baixa o arquivo. */
export async function saveOrShare(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: blob.type })
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // Outros erros: cai para o download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
