import { tokens } from '../theme'
import { formatGeneratedAt, loadLogo, type Report } from './report'

/*
 * Relatório em imagem (PNG), no visual do app, para mandar no WhatsApp ou postar.
 * Largura fixa de 1080 px; cada atleta ocupa uma linha com as parciais logo abaixo do nome.
 */

const W = 1080
const PAD = 48
const HEADER_H = 220
const ROW_H = 84
const SECTION_HEAD = 84
const SECTION_GAP = 28
const FOOTER_H = 90
/** Limite seguro de área de canvas no iOS. */
const MAX_PIXELS = 16_000_000

const DISPLAY = '"Barlow Condensed", system-ui, sans-serif'
const BODY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const podium = [tokens.gold, tokens.silver, tokens.bronze]

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export async function buildReportImage(report: Report): Promise<Blob> {
  await Promise.all(['800 56px', '700 36px', '600 26px'].map((f) => document.fonts.load(`${f} ${DISPLAY}`).catch(() => null)))
  const logo = await loadLogo(72)

  const rows = report.sections.reduce((n, s) => n + s.rows.length, 0)
  const H = HEADER_H + report.sections.length * (SECTION_HEAD + SECTION_GAP) + rows * ROW_H + FOOTER_H
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (W * H)))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  // Fundo e cabeçalho
  ctx.fillStyle = tokens.bg
  ctx.fillRect(0, 0, W, H)
  let textX = PAD
  if (logo) {
    ctx.drawImage(logo.img, PAD, 48, logo.w, logo.h)
    textX = PAD + logo.w + 28
  }
  ctx.fillStyle = tokens.text
  ctx.font = `800 58px ${DISPLAY}`
  ctx.fillText(ellipsize(ctx, report.title.toUpperCase(), W - textX - PAD), textX, 96)
  ctx.fillStyle = tokens.brand
  ctx.font = `700 34px ${DISPLAY}`
  ctx.fillText(ellipsize(ctx, report.scope.toUpperCase(), W - textX - PAD), textX, 140)
  ctx.fillStyle = tokens.muted
  ctx.font = `400 22px ${BODY}`
  ctx.fillText(formatGeneratedAt(report.generatedAt), textX, 176)
  ctx.fillStyle = tokens.brand
  ctx.fillRect(0, HEADER_H - 8, W, 8)

  let y = HEADER_H + SECTION_GAP
  const right = W - PAD
  const totalX = right - 20 // borda direita do total

  for (const section of report.sections) {
    // Título da categoria
    ctx.fillStyle = tokens.brand
    ctx.fillRect(PAD, y + 22, 8, 40)
    ctx.fillStyle = tokens.text
    ctx.font = `700 40px ${DISPLAY}`
    ctx.fillText(ellipsize(ctx, section.category.toUpperCase(), W - PAD * 2 - 180), PAD + 24, y + 56)
    ctx.fillStyle = tokens.muted
    ctx.font = `600 24px ${DISPLAY}`
    ctx.textAlign = 'right'
    const n = section.rows.length
    ctx.fillText(`${n} ${n === 1 ? 'ATLETA' : 'ATLETAS'}`, right, y + 56)
    ctx.textAlign = 'left'
    y += SECTION_HEAD

    section.rows.forEach((row, i) => {
      const top = y + i * ROW_H
      ctx.fillStyle = i % 2 === 0 ? tokens.surface : tokens.raised
      ctx.fillRect(PAD, top, W - PAD * 2, ROW_H - 4)

      // Posição
      const posColor = row.pos != null ? podium[row.pos - 1] : undefined
      if (posColor) {
        ctx.fillStyle = posColor
        ctx.fillRect(PAD, top, 64, ROW_H - 4)
      }
      ctx.fillStyle = posColor ? '#000' : tokens.muted
      ctx.font = `800 36px ${DISPLAY}`
      ctx.textAlign = 'center'
      ctx.fillText(row.pos != null ? String(row.pos) : '–', PAD + 32, top + 52)

      // Placa
      ctx.fillStyle = tokens.brand
      ctx.fillRect(PAD + 80, top + 18, 76, 44)
      ctx.fillStyle = tokens.brandInk
      ctx.font = `800 32px ${DISPLAY}`
      ctx.fillText(row.num, PAD + 118, top + 51)
      ctx.textAlign = 'left'

      // Nome e parciais
      const nameX = PAD + 176
      const nameMax = totalX - 200 - nameX
      ctx.fillStyle = tokens.text
      ctx.font = `700 30px ${BODY}`
      const hasSplits = row.cells.some((c) => c !== '—')
      ctx.fillText(ellipsize(ctx, row.name, nameMax), nameX, top + (hasSplits ? 38 : 50))
      if (hasSplits) {
        ctx.fillStyle = tokens.muted
        ctx.font = `500 22px ${DISPLAY}`
        const splits = row.cells.map((c, k) => `${report.columns[k]} ${c}`).join('   ')
        ctx.fillText(ellipsize(ctx, splits, nameMax), nameX, top + 66)
      }

      // Total e diferença
      ctx.textAlign = 'right'
      const bad = row.total === 'DNF' || row.total === 'DNS'
      ctx.fillStyle = bad ? tokens.finish : tokens.text
      ctx.font = `800 36px ${DISPLAY}`
      ctx.fillText(row.total, totalX, top + (row.gap ? 40 : 52))
      if (row.gap) {
        ctx.fillStyle = row.gap.startsWith('+') ? tokens.warn : tokens.muted
        ctx.font = `600 24px ${DISPLAY}`
        ctx.fillText(row.gap, totalX, top + 68)
      }
      ctx.textAlign = 'left'
    })
    y += section.rows.length * ROW_H + SECTION_GAP
  }

  if (report.sections.length === 0) {
    ctx.fillStyle = tokens.muted
    ctx.font = `400 28px ${BODY}`
    ctx.fillText('Nenhum atleta para mostrar.', PAD, y + 40)
  }

  // Rodapé
  ctx.fillStyle = tokens.muted
  ctx.font = `400 20px ${BODY}`
  ctx.fillText('Gerado pelo MTB Cronômetro', PAD, H - 40)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem'))), 'image/png'),
  )
}
