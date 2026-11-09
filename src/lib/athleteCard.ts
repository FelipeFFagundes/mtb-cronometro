import type { AppState } from '../types'
import { buildEnduroRanking } from './ranking'
import { formatEventDate } from './events'
import { fmt } from './time'
import { loadLogo, stageLabel } from './report'
import { tint, type Palette } from '../theme'
import { isOut, outLabel } from './runs'
import type { OutStatus } from '../types'

/*
 * Card do atleta para compartilhar (story, quadrado, paisagem), desenhado em canvas.
 * Quatro modelos (completo, destaque, especiais, pódio) e qualquer um dos temas do app, escolhido
 * na hora de postar. "Sem fundo" gera um PNG transparente para pôr por cima de uma foto do atleta:
 * os quadros ganham um fundo translúcido para continuarem legíveis sobre qualquer imagem.
 */

export type CardFormat = 'story' | 'square' | 'landscape'
export type CardLayout = 'completo' | 'destaque' | 'especiais' | 'podio'

export const CARD_FORMATS: { id: CardFormat; label: string; w: number; h: number }[] = [
  { id: 'story', label: 'Story', w: 1080, h: 1920 },
  { id: 'square', label: 'Quadrado', w: 1080, h: 1080 },
  { id: 'landscape', label: 'Paisagem', w: 1200, h: 630 },
]

export const CARD_LAYOUTS: { id: CardLayout; label: string; text: string }[] = [
  { id: 'completo', label: 'Completo', text: 'Posição, tempo total e cada especial' },
  { id: 'destaque', label: 'Destaque', text: 'A posição em tamanho de pôster' },
  { id: 'especiais', label: 'Especiais', text: 'Posição em cada especial, em barras' },
  { id: 'podio', label: 'Pódio', text: 'Os 3 primeiros da categoria, com o atleta marcado' },
]

export interface AthleteCard {
  event: string
  date: string
  /** "Resultado final" com o evento encerrado; "Resultado parcial" antes. */
  status: string
  num: string
  name: string
  cat: string
  sub: string
  /** Posição na categoria (0 = sem resultado válido) e quantos atletas há nela. */
  pos: number
  catSize: number
  /** DNF, DNS ou DSQ que tirou o atleta da geral (vazio se está na classificação). */
  out: string
  total: string
  gap: string
  done: string
  stages: { tag: string; name: string; time: string; pos: number; of: number; gap: string; best: boolean }[]
  podium: { pos: number; num: string; name: string; time: string; gap: string; me: boolean }[]
  fileName: string
}

export function buildAthleteCard(state: AppState, num: string): AthleteCard | null {
  const rider = state.riders.find((r) => r.num === num)
  if (!rider) return null
  const { rows, stages } = buildEnduroRanking(state, rider.cat, 'all')
  const ranked = rows.filter((r) => r.completedCount > 0 && !r.hasDnf)
  const row = rows.find((r) => r.rider.num === num)
  const pos = ranked.findIndex((r) => r.rider.num === num) + 1
  const leader = ranked[0]
  const gapOf = (r: (typeof rows)[number]) =>
    r === leader ? 'líder da categoria' : r.completedCount === leader.completedCount ? `+${fmt(r.totalGap)} do líder` : `${r.completedCount}/${stages.length} especiais`

  // Pódio: os 3 primeiros e, se o atleta não estiver entre eles, ele logo abaixo
  const top = ranked.slice(0, 3)
  if (pos > 3) top.push(ranked[pos - 1])
  const slug = `${rider.num}-${rider.name}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return {
    event: state.event?.name ?? 'Race Timer',
    date: state.event?.startsOn ? formatEventDate(state.event.startsOn) : '',
    status: state.event?.status === 'encerrado' ? 'Resultado final' : 'Resultado parcial',
    num: rider.num,
    name: rider.name,
    cat: rider.cat,
    sub: [rider.cat, rider.team].filter(Boolean).join(' · '),
    pos,
    catSize: rows.length,
    out: row?.outStatus ? outLabel(row.outStatus) : '',
    total: pos > 0 && row ? fmt(row.totalTime) : '—',
    gap: pos > 0 && row ? gapOf(row) : '',
    done: `${row?.completedCount ?? 0}/${stages.length}`,
    stages: stages.map((st) => {
      const p = row?.stagePerformances[st.id]
      const ok = p?.status === 'done' && p.time != null
      const tag = stageLabel(st)
      return {
        tag,
        // "E2 - Erechim" vira "Erechim": a sigla já aparece ao lado
        name: st.name.startsWith(tag) ? st.name.slice(tag.length).replace(/^\s*[-–·]\s*/, '') : st.name,
        time: ok ? fmt(p.time!) : isOut(p?.status) ? outLabel(p.status as OutStatus) : p?.status === 'track' ? 'na pista' : '—',
        pos: ok && p.stageRank ? p.stageRank : 0,
        of: rows.filter((r) => r.stagePerformances[st.id]?.status === 'done').length,
        gap: ok ? (p.stageRank === 1 ? 'melhor' : p.stageGap != null ? `+${fmt(p.stageGap)}` : '') : '',
        best: ok && p.stageRank === 1,
      }
    }),
    podium: top.map((r) => ({
      pos: ranked.indexOf(r) + 1,
      num: r.rider.num,
      name: r.rider.name,
      time: fmt(r.totalTime),
      gap: r === leader ? 'líder' : gapOf(r).replace(' do líder', ''),
      me: r.rider.num === num,
    })),
    fileName: `${slug || 'atleta'}.png`,
  }
}

const DISPLAY = '"Barlow Condensed", system-ui, sans-serif'
const OUT = ['DNF', 'DNS', 'DSQ']
const BODY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Texto que cabe em `maxW`, com reticências se não couber. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** Até duas linhas, quebrando nas palavras. */
function twoLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text]
  const words = text.split(/\s+/)
  let first = ''
  for (const w of words) {
    const next = first ? `${first} ${w}` : w
    if (ctx.measureText(next).width > maxW && first) break
    first = next
  }
  const rest = text.slice(first.length).trim()
  return rest ? [fit(ctx, first, maxW), fit(ctx, rest, maxW)] : [fit(ctx, first, maxW)]
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Logo SPET (branco sobre preto) na cor do texto do tema: o preto vira transparente. */
function logoCanvas(img: HTMLImageElement, h: number, color: string): HTMLCanvasElement {
  const w = Math.round((img.naturalWidth / img.naturalHeight) * h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const [r, g, b] = hexRgb(color)
  for (let i = 0; i < data.data.length; i += 4) {
    const lum = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3
    data.data[i] = r
    data.data[i + 1] = g
    data.data[i + 2] = b
    data.data[i + 3] = Math.round((lum / 255) * data.data[i + 3])
  }
  ctx.putImageData(data, 0, 0)
  return c
}

/** Tudo que os modelos precisam para desenhar. */
interface Draw {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  /** Escala dos textos (o quadrado de 1080 é a referência). */
  s: number
  /** Margem. */
  m: number
  p: Palette
  land: boolean
  story: boolean
  panel: string
  panel2: string
}

const R = Math.round

function text(d: Draw, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', maxW?: number) {
  d.ctx.font = font
  d.ctx.fillStyle = color
  d.ctx.textAlign = align
  d.ctx.fillText(maxW ? fit(d.ctx, value, maxW) : value, x, y)
  d.ctx.textAlign = 'left'
}

/** Logo, evento e data/situação. Devolve onde o conteúdo começa. */
/** Evento, data e situação do resultado (o que o cabeçalho mostra). */
type HeaderInfo = Pick<AthleteCard, 'event' | 'date' | 'status'>

function header(d: Draw, card: HeaderInfo, logo: HTMLImageElement | null): number {
  const { s, m, w, p } = d
  const y = m + R(10 * s)
  const logoH = R(70 * s)
  let x = m
  if (logo) {
    const lc = logoCanvas(logo, logoH, p.text)
    d.ctx.drawImage(lc, m, y)
    x = m + lc.width + R(24 * s)
  }
  text(d, card.event.toUpperCase(), x, y + R(34 * s), `800 ${R(40 * s)}px ${DISPLAY}`, p.text, 'left', w - x - m)
  text(d, [card.date, card.status].filter(Boolean).join(' · ').toUpperCase(), x, y + R(66 * s), `600 ${R(26 * s)}px ${DISPLAY}`, p.muted, 'left', w - x - m)
  return y + logoH + R(40 * s)
}

function footer(d: Draw) {
  text(d, 'RACE TIMER · CRONOMETRAGEM DE ENDURO MTB', d.m, d.h - d.m * 0.7, `600 ${R(22 * d.s)}px ${DISPLAY}`, d.p.muted)
}

/** Placa + nome + categoria/equipe. Devolve a altura usada. */
function identity(d: Draw, card: AthleteCard, x: number, y: number, maxW: number, size = 1): number {
  const { ctx, s, p } = d
  const plateH = R(120 * s * size)
  ctx.font = `800 ${R(92 * s * size)}px ${DISPLAY}`
  const plateW = Math.max(plateH * 1.15, ctx.measureText(card.num).width + R(40 * s * size))
  ctx.fillStyle = p.brand
  ctx.fillRect(x, y, plateW, plateH)
  text(d, card.num, x + plateW / 2, y + plateH * 0.78, `800 ${R(92 * s * size)}px ${DISPLAY}`, p.brandInk, 'center')

  const nameX = x + plateW + R(28 * s)
  const nameW = x + maxW - nameX
  ctx.font = `800 ${R(62 * s * size)}px ${DISPLAY}`
  const lines = twoLines(ctx, card.name.toUpperCase(), nameW)
  const lineH = R(60 * s * size)
  const top = y + (lines.length === 1 ? R(56 * s * size) : R(48 * s * size))
  lines.forEach((l, i) => text(d, l, nameX, top + i * lineH, `800 ${R(62 * s * size)}px ${DISPLAY}`, p.text))
  text(d, card.sub, nameX, top + lines.length * lineH + R(4 * s), `500 ${R(28 * s * size)}px ${BODY}`, p.muted, 'left', nameW)
  return Math.max(plateH, lines.length * lineH + R(60 * s * size))
}

const podiumColor = (p: Palette, pos: number) => [p.gold, p.silver, p.bronze][pos - 1]
const onColor = (p: Palette) => (p.mode === 'light' ? '#ffffff' : '#000000')

/* ----- Modelo "Completo": posição, tempo total e cada especial ----- */
function layoutCompleto(d: Draw, card: AthleteCard, top: number) {
  const { ctx, s, m, w, h, p, land } = d
  const colW = land ? R((w - m * 3) * 0.52) : w - m * 2
  let y = top + identity(d, card, m, top, colW) + R(36 * s)

  const kpis = [
    { label: 'Posição', value: card.out || (card.pos ? `${card.pos}º` : '—'), hint: card.pos ? `de ${card.catSize}` : '' },
    { label: 'Tempo total', value: card.total, hint: card.gap },
    { label: 'Especiais', value: card.done, hint: 'concluídas' },
  ]
  const gap = R(16 * s)
  const kpiW = (colW - gap * 2) / 3
  const kpiH = R(170 * s)
  kpis.forEach((k, i) => {
    const x = m + i * (kpiW + gap)
    ctx.fillStyle = d.panel
    ctx.fillRect(x, y, kpiW, kpiH)
    ctx.fillStyle = i === 0 ? p.brand : p.lineStrong
    ctx.fillRect(x, y, R(6 * s), kpiH)
    const px = x + R(24 * s)
    const inner = kpiW - R(36 * s)
    text(d, k.label.toUpperCase(), px, y + R(40 * s), `600 ${R(24 * s)}px ${DISPLAY}`, p.muted)
    text(d, k.value, px, y + R(108 * s), `800 ${R((i === 1 ? 54 : 64) * s)}px ${DISPLAY}`, p.text, 'left', inner)
    text(d, k.hint, px, y + R(146 * s), `500 ${R(22 * s)}px ${BODY}`, i === 1 && k.hint === 'líder da categoria' ? p.brand : p.muted, 'left', inner)
  })
  y += kpiH + R(40 * s)

  // Especiais (na paisagem, na coluna da direita)
  const stX = land ? m + colW + m : m
  const stW = land ? w - stX - m : colW
  let stY = land ? top : y
  const avail = h - stY - m - R(70 * s)
  const headH = R(44 * s)
  const rowH = Math.min(R((land ? 80 : d.story ? 150 : 96) * s), (avail - headH) / Math.max(1, card.stages.length))
  const k = Math.min(1.35, rowH / (96 * s))
  text(d, 'ESPECIAIS', stX, stY + R(28 * s), `700 ${R(26 * s)}px ${DISPLAY}`, p.muted)
  stY += headH
  card.stages.forEach((st, i) => {
    const t = stY + i * rowH
    ctx.fillStyle = i % 2 === 0 ? d.panel : d.panel2
    ctx.fillRect(stX, t, stW, rowH - R(4 * s))
    if (st.best) {
      ctx.fillStyle = p.brand
      ctx.fillRect(stX, t, R(6 * s), rowH - R(4 * s))
    }
    const mid = t + rowH / 2
    const pad = R(24 * s)
    const right = stX + stW - pad
    text(d, st.tag, stX + pad, mid + R(12 * s * k), `800 ${R(34 * s * k)}px ${DISPLAY}`, p.text)
    text(d, st.time, right, mid + R(6 * s * k), `800 ${R(40 * s * k)}px ${DISPLAY}`, OUT.includes(st.time) ? p.finish : p.text, 'right')
    text(d, [st.pos ? `${st.pos}º` : '', st.gap].filter(Boolean).join(' · '), right, mid + R(34 * s * k), `600 ${R(22 * s * k)}px ${DISPLAY}`, st.best ? p.brand : p.muted, 'right')
    text(d, st.name, stX + pad + R(90 * s), mid + R(10 * s * k), `500 ${R(26 * s * k)}px ${BODY}`, p.muted, 'left', stW - R(90 * s) - pad * 2 - R(220 * s))
  })
}

/* ----- Modelo "Destaque": a posição em tamanho de pôster ----- */
function layoutDestaque(d: Draw, card: AthleteCard, top: number) {
  const { ctx, s, m, w, h, p, land } = d
  const bottom = h - m - R(70 * s)
  const big = card.out || (card.pos ? `${card.pos}º` : '—')
  const color = card.pos ? (podiumColor(p, card.pos) ?? p.text) : p.muted

  if (land) {
    // Posição gigante à esquerda; atleta e tempo à direita
    const leftW = R(w * 0.36)
    text(d, big, m + leftW / 2, top + (bottom - top) * 0.78, `800 ${R(330 * s)}px ${DISPLAY}`, color, 'center', leftW)
    const x = m + leftW + m
    const colW = w - x - m
    let y = top + identity(d, card, x, top, colW, 0.9) + R(40 * s)
    text(d, 'TEMPO TOTAL', x, y + R(28 * s), `600 ${R(26 * s)}px ${DISPLAY}`, p.muted)
    text(d, card.total, x, y + R(120 * s), `800 ${R(110 * s)}px ${DISPLAY}`, p.text, 'left', colW)
    y += R(160 * s)
    text(d, [card.gap, `${card.done} especiais`].filter(Boolean).join(' · '), x, y, `600 ${R(30 * s)}px ${DISPLAY}`, card.gap === 'líder da categoria' ? p.brand : p.muted, 'left', colW)
    return
  }

  const cx = w / 2
  const idH = identity(d, card, m, top, w - m * 2)
  // Bloco central: posição, "de N · categoria", tempo e diferença, distribuídos na altura que sobra
  const room = bottom - (top + idH)
  // Abaixo da posição: categoria (70), faixa do tempo (60 + 220) e especiais (56 + 40)
  const below = R(446 * s)
  const bigSize = Math.max(R(110 * s), Math.min(room - below - R(20 * s), R(w * 0.48)))
  // Centraliza o bloco na altura que sobra
  let y = top + idH + Math.max(0, (room - below - bigSize) / 2) + bigSize * 0.86
  text(d, big, cx, y, `800 ${bigSize}px ${DISPLAY}`, color, 'center', w - m * 2)
  y += R(70 * s)
  text(d, (card.pos ? `de ${card.catSize} · ${card.cat}` : card.cat).toUpperCase(), cx, y, `700 ${R(40 * s)}px ${DISPLAY}`, p.muted, 'center', w - m * 2)
  y += R(60 * s)
  // Faixa do tempo total
  const bandH = R(220 * s)
  ctx.fillStyle = d.panel
  ctx.fillRect(m, y, w - m * 2, bandH)
  ctx.fillStyle = p.brand
  ctx.fillRect(m, y, w - m * 2, R(8 * s))
  text(d, 'TEMPO TOTAL', cx, y + R(56 * s), `600 ${R(28 * s)}px ${DISPLAY}`, p.muted, 'center')
  text(d, card.total, cx, y + R(156 * s), `800 ${R(104 * s)}px ${DISPLAY}`, p.text, 'center', w - m * 4)
  text(d, card.gap, cx, y + R(200 * s), `600 ${R(28 * s)}px ${DISPLAY}`, card.gap === 'líder da categoria' ? p.brand : p.muted, 'center', w - m * 4)
  y += bandH + R(56 * s)
  text(d, `${card.done} ESPECIAIS CONCLUÍDAS`, cx, Math.min(y, bottom), `700 ${R(32 * s)}px ${DISPLAY}`, p.muted, 'center')
}

/* ----- Modelo "Especiais": posição em cada especial, em barras ----- */
function layoutEspeciais(d: Draw, card: AthleteCard, top: number) {
  const { ctx, s, m, w, h, p, land } = d
  const bottom = h - m - R(70 * s)
  // Na paisagem, o atleta fica à esquerda e as barras ocupam a altura toda à direita
  const idW = land ? R((w - m * 3) * 0.42) : w - m * 2
  const idH = identity(d, card, m, top, idW, land ? 0.85 : 1)
  const x0 = land ? m + idW + m : m
  const barW = w - m - x0
  let y = land ? top : top + idH + R(32 * s)
  if (land) text(d, `TOTAL ${card.total}`, m, top + idH + R(60 * s), `800 ${R(48 * s)}px ${DISPLAY}`, p.text, 'left', idW)
  text(d, 'POSIÇÃO EM CADA ESPECIAL', x0, y + R(28 * s), `700 ${R(28 * s)}px ${DISPLAY}`, p.muted)
  if (!land) text(d, `TOTAL ${card.total}`, w - m, y + R(28 * s), `800 ${R(32 * s)}px ${DISPLAY}`, p.text, 'right')
  y += R(56 * s)
  const n = Math.max(1, card.stages.length)
  const rowH = Math.min(R((d.story ? 230 : land ? 150 : 140) * s), (bottom - y) / n)
  const k = Math.min(1.4, rowH / (140 * s))
  card.stages.forEach((st, i) => {
    const t = y + i * rowH
    const labelY = t + R(44 * s * k)
    text(d, st.tag, x0, labelY, `800 ${R(40 * s * k)}px ${DISPLAY}`, p.text)
    text(d, st.name, x0 + R(80 * s * k), labelY, `500 ${R(28 * s * k)}px ${BODY}`, p.muted, 'left', barW - R(80 * s * k) - R(200 * s * k))
    text(d, st.time, x0 + barW, labelY, `800 ${R(40 * s * k)}px ${DISPLAY}`, OUT.includes(st.time) ? p.finish : p.text, 'right')
    // Barra: quanto mais perto do 1º, mais cheia
    const by = labelY + R(18 * s * k)
    const bh = R(30 * s * k)
    ctx.fillStyle = d.panel
    ctx.fillRect(x0, by, barW, bh)
    if (st.pos && st.of) {
      ctx.fillStyle = st.best ? p.brand : tint(p.text, 0.5)
      ctx.fillRect(x0, by, barW * ((st.of - st.pos + 1) / st.of), bh)
    }
    const posTxt = st.pos ? `${st.pos}º de ${st.of}${st.gap ? ` · ${st.gap}` : ''}` : OUT.includes(st.time) ? st.time : 'sem tempo'
    text(d, posTxt, x0, by + bh + R(30 * s * k), `600 ${R(24 * s * k)}px ${DISPLAY}`, st.best ? p.brand : p.muted)
  })
}

/* ----- Modelo "Pódio": os 3 primeiros da categoria, com o atleta marcado ----- */
function layoutPodio(d: Draw, card: AthleteCard, top: number) {
  const { ctx, s, m, w, h, p } = d
  text(d, `PÓDIO · ${card.cat}`.toUpperCase(), m, top + R(44 * s), `800 ${R(52 * s)}px ${DISPLAY}`, p.text, 'left', w - m * 2)
  text(d, `${card.catSize} ATLETAS · CLASSIFICAÇÃO GERAL`, m, top + R(84 * s), `600 ${R(26 * s)}px ${DISPLAY}`, p.muted, 'left', w - m * 2)
  let y = top + R(120 * s)
  const bottom = h - m - R(70 * s)
  if (card.podium.length === 0) {
    text(d, 'Ainda sem tempos nesta categoria.', m, y + R(60 * s), `500 ${R(32 * s)}px ${BODY}`, p.muted)
    return
  }
  const n = card.podium.length + (card.podium.some((r) => r.pos > 3) ? 0.4 : 0)
  const rowH = Math.min(R((d.story ? 250 : d.land ? 100 : 170) * s), (bottom - y) / n)
  const k = Math.min(1.3, rowH / (170 * s))
  card.podium.forEach((r) => {
    if (r.pos > 3) y += rowH * 0.4 // separa o atleta, fora do pódio, dos 3 primeiros
    const t = y
    const hgt = rowH - R(14 * s)
    ctx.fillStyle = d.panel
    ctx.fillRect(m, t, w - m * 2, hgt)
    if (r.me) {
      ctx.strokeStyle = p.brand
      ctx.lineWidth = R(5 * s)
      ctx.strokeRect(m + ctx.lineWidth / 2, t + ctx.lineWidth / 2, w - m * 2 - ctx.lineWidth, hgt - ctx.lineWidth)
    }
    // Bloco da posição
    const pw = R(hgt * 0.95)
    const c = podiumColor(p, r.pos)
    ctx.fillStyle = c ?? d.panel2
    ctx.fillRect(m, t, pw, hgt)
    text(d, `${r.pos}`, m + pw / 2, t + hgt * 0.7, `800 ${R(hgt * 0.62)}px ${DISPLAY}`, c ? onColor(p) : p.text, 'center')
    // Linha 1: nome, com a largura toda; linha 2: placa à esquerda, tempo e diferença à direita
    const x = m + pw + R(28 * s)
    const right = w - m - R(28 * s)
    const l1 = t + hgt * 0.46
    const l2 = t + hgt * 0.8
    text(d, r.name.toUpperCase(), x, l1, `800 ${R(50 * s * k)}px ${DISPLAY}`, p.text, 'left', right - x)
    // O contorno amarelo já marca o atleta do card
    text(d, `#${r.num}`, x, l2, `600 ${R(28 * s * k)}px ${DISPLAY}`, r.me ? p.brand : p.muted, 'left', (right - x) * 0.35)
    // Diferença menor, à direita; o tempo logo antes dela
    ctx.font = `600 ${R(26 * s * k)}px ${DISPLAY}`
    const gapW = ctx.measureText(r.gap).width
    text(d, r.gap, right, l2, `600 ${R(26 * s * k)}px ${DISPLAY}`, r.pos === 1 ? p.brand : p.muted, 'right')
    text(d, r.time, right - gapW - R(16 * s), l2, `800 ${R(40 * s * k)}px ${DISPLAY}`, p.text, 'right')
    y += rowH
  })
}

/** Canvas no tamanho do formato, com fundo, faixa de placa e o contexto de desenho. */
async function setup(opts: { format: CardFormat; palette: Palette; transparent: boolean }) {
  const f = CARD_FORMATS.find((x) => x.id === opts.format)!
  const { w, h } = f
  await Promise.all(['800 80px', '700 40px', '600 30px'].map((x) => document.fonts.load(`${x} ${DISPLAY}`).catch(() => null)))
  const logo = await loadLogo(160)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  const p = opts.palette
  const land = opts.format === 'landscape'
  const story = opts.format === 'story'
  const s = land ? 0.62 : story ? 1.25 : 1
  const d: Draw = {
    ctx,
    w,
    h,
    s,
    m: R((land ? 48 : 72) * (w / 1080)),
    p,
    land,
    story,
    panel: opts.transparent ? tint(p.bg, 0.6) : p.surface,
    panel2: opts.transparent ? tint(p.bg, 0.45) : p.raised,
  }

  if (!opts.transparent) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)
  }
  // Faixa de placa no topo
  ctx.fillStyle = p.brand
  ctx.fillRect(0, 0, w, R(10 * s))
  return { canvas, d, logo: logo?.img ?? null }
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem'))), 'image/png'),
  )

export async function renderAthleteCard(
  card: AthleteCard,
  opts: { format: CardFormat; layout: CardLayout; palette: Palette; transparent: boolean },
): Promise<Blob> {
  const { canvas, d, logo } = await setup(opts)
  const top = header(d, card, logo)
  if (opts.layout === 'destaque') layoutDestaque(d, card, top)
  else if (opts.layout === 'especiais') layoutEspeciais(d, card, top)
  else if (opts.layout === 'podio') layoutPodio(d, card, top)
  else layoutCompleto(d, card, top)
  footer(d)
  return toPng(canvas)
}

/* ===== Imagens do evento: classificação de uma categoria e divulgação dos inscritos ===== */

export type EventImageKind = 'standings' | 'roster'

function eventHeader(state: AppState): HeaderInfo {
  return {
    event: state.event?.name ?? 'Race Timer',
    date: state.event?.startsOn ? formatEventDate(state.event.startsOn) : '',
    status: state.event?.status === 'encerrado' ? 'Resultado final' : 'Resultado parcial',
  }
}

export async function renderEventImage(
  state: AppState,
  kind: EventImageKind,
  opts: { category: string; format: CardFormat; palette: Palette; transparent: boolean },
): Promise<Blob> {
  const { canvas, d, logo } = await setup(opts)
  const info = eventHeader(state)
  const top = header(d, kind === 'roster' ? { ...info, status: 'Inscritos' } : info, logo)
  if (kind === 'standings') drawStandings(d, state, opts.category, top)
  else drawRoster(d, state, opts.category, top)
  footer(d)
  return toPng(canvas)
}

/** Classificação geral de uma categoria (top 10 no story, menos nos formatos menores). */
function drawStandings(d: Draw, state: AppState, category: string, top: number) {
  const { ctx, s, m, w, h, p } = d
  const { rows, stages } = buildEnduroRanking(state, category, 'all')
  const ranked = rows.filter((r) => r.completedCount > 0 && !r.hasDnf)
  const leader = ranked[0]
  text(d, `CLASSIFICAÇÃO · ${category}`.toUpperCase(), m, top + R(44 * s), `800 ${R(50 * s)}px ${DISPLAY}`, p.text, 'left', w - m * 2)
  text(d, `${rows.length} ATLETAS · ${stages.length} ${stages.length === 1 ? 'ESPECIAL' : 'ESPECIAIS'}`, m, top + R(82 * s), `600 ${R(26 * s)}px ${DISPLAY}`, p.muted)
  let y = top + R(110 * s)
  const bottom = h - m - R(70 * s)
  const max = d.story ? 10 : d.land ? 5 : 7
  const list = ranked.slice(0, max)
  if (list.length === 0) {
    text(d, 'Ainda sem tempos nesta categoria.', m, y + R(60 * s), `500 ${R(32 * s)}px ${BODY}`, p.muted)
    return
  }
  const rowH = Math.min(R((d.story ? 120 : 96) * s), (bottom - y) / list.length)
  const k = Math.min(1.2, rowH / (96 * s))
  list.forEach((r, i) => {
    const t = y + i * rowH
    const hgt = rowH - R(8 * s)
    ctx.fillStyle = i % 2 === 0 ? d.panel : d.panel2
    ctx.fillRect(m, t, w - m * 2, hgt)
    const pw = R(hgt * 0.9)
    const c = podiumColor(p, i + 1)
    if (c) {
      ctx.fillStyle = c
      ctx.fillRect(m, t, pw, hgt)
    }
    text(d, `${i + 1}`, m + pw / 2, t + hgt * 0.7, `800 ${R(hgt * 0.6)}px ${DISPLAY}`, c ? onColor(p) : p.text, 'center')
    const x = m + pw + R(22 * s)
    const right = w - m - R(22 * s)
    ctx.font = `800 ${R(40 * s * k)}px ${DISPLAY}`
    const timeW = ctx.measureText(fmt(r.totalTime)).width
    text(d, r.rider.name.toUpperCase(), x, t + hgt * 0.5, `800 ${R(36 * s * k)}px ${DISPLAY}`, p.text, 'left', right - timeW - x - R(24 * s))
    text(d, [`#${r.rider.num}`, r.rider.team].filter(Boolean).join(' · '), x, t + hgt * 0.82, `500 ${R(22 * s * k)}px ${BODY}`, p.muted, 'left', right - timeW - x - R(24 * s))
    text(d, fmt(r.totalTime), right, t + hgt * 0.52, `800 ${R(40 * s * k)}px ${DISPLAY}`, p.text, 'right')
    const gap = r === leader ? 'líder' : r.completedCount === leader.completedCount ? `+${fmt(r.totalGap)}` : `${r.completedCount}/${stages.length} esp.`
    text(d, gap, right, t + hgt * 0.84, `600 ${R(22 * s * k)}px ${DISPLAY}`, r === leader ? p.brand : p.muted, 'right')
  })
  if (ranked.length > max) {
    y += list.length * rowH
    text(d, `+ ${ranked.length - max} atletas`, m, Math.min(y + R(30 * s), bottom), `600 ${R(24 * s)}px ${DISPLAY}`, p.muted)
  }
}

/** Divulgação dos inscritos: placa e nome, por categoria, em colunas. */
function drawRoster(d: Draw, state: AppState, category: string, top: number) {
  const { ctx, s, m, w, h, p } = d
  const riders = state.riders
    .filter((r) => category === 'Todas' || r.cat === category)
    .slice()
    .sort((a, b) => a.cat.localeCompare(b.cat, 'pt-BR') || Number(a.num) - Number(b.num))
  text(d, (category === 'Todas' ? 'INSCRITOS' : `INSCRITOS · ${category}`).toUpperCase(), m, top + R(44 * s), `800 ${R(50 * s)}px ${DISPLAY}`, p.text, 'left', w - m * 2)
  text(d, `${riders.length} ${riders.length === 1 ? 'ATLETA' : 'ATLETAS'}`, m, top + R(82 * s), `600 ${R(26 * s)}px ${DISPLAY}`, p.muted)
  const y0 = top + R(110 * s)
  const bottom = h - m - R(70 * s)
  const cols = d.land ? 3 : riders.length > 24 ? 2 : 1
  const colW = (w - m * 2 - R(20 * s) * (cols - 1)) / cols
  // Itens: um título por categoria e uma linha por atleta, em colunas
  type Item = { kind: 'cat'; label: string } | { kind: 'rider'; num: string; name: string }
  const items: Item[] = []
  let last = ''
  for (const r of riders) {
    if (category === 'Todas' && r.cat !== last) {
      items.push({ kind: 'cat', label: r.cat })
      last = r.cat
    }
    items.push({ kind: 'rider', num: r.num, name: r.name })
  }
  const perCol = Math.max(1, Math.floor((bottom - y0) / R(46 * s)))
  const lineH = Math.min(R(56 * s), (bottom - y0) / Math.min(perCol, Math.ceil(items.length / cols)))
  const fitN = perCol * cols
  const shown = items.slice(0, fitN)
  shown.forEach((it, i) => {
    const col = Math.floor(i / perCol)
    const x = m + col * (colW + R(20 * s))
    const t = y0 + (i % perCol) * lineH
    if (it.kind === 'cat') {
      text(d, it.label.toUpperCase(), x, t + lineH * 0.72, `800 ${R(26 * s)}px ${DISPLAY}`, p.brand, 'left', colW)
      return
    }
    const plateW = R(70 * s)
    ctx.fillStyle = p.brand
    ctx.fillRect(x, t + lineH * 0.14, plateW, lineH * 0.72)
    text(d, it.num, x + plateW / 2, t + lineH * 0.7, `800 ${R(lineH * 0.5)}px ${DISPLAY}`, p.brandInk, 'center')
    text(d, it.name, x + plateW + R(14 * s), t + lineH * 0.68, `600 ${R(Math.min(30 * s, lineH * 0.48))}px ${BODY}`, p.text, 'left', colW - plateW - R(14 * s))
  })
  if (items.length > fitN) {
    text(d, `+ ${items.length - fitN} na lista completa`, w - m, bottom + R(30 * s), `600 ${R(22 * s)}px ${DISPLAY}`, p.muted, 'right')
  }
}
