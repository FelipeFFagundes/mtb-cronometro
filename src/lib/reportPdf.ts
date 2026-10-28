import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatGeneratedAt, loadLogo, statItems, type Report } from './report'

/*
 * Relatório em PDF (A4), carregado sob demanda para não pesar na abertura do app.
 * Fundo branco para imprimir; faixa preta com o logo e detalhes em amarelo da identidade.
 */

const MARGIN = 12
const INK: [number, number, number] = [10, 10, 11]
const GRAY: [number, number, number] = [113, 113, 122]
const BRAND: [number, number, number] = [255, 214, 10]
const PODIUM: [number, number, number][] = [
  [255, 214, 10],
  [212, 212, 216],
  [217, 119, 6],
]

export async function buildReportPdf(report: Report): Promise<Blob> {
  const wide = report.overall && report.columns.length > 4
  const doc = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Cabeçalho
  const bandH = 30
  doc.setFillColor(...INK)
  doc.rect(0, 0, pageW, bandH, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, bandH, pageW, 1.6, 'F')

  let textX = MARGIN
  const logo = await loadLogo(160)
  if (logo) {
    const h = 16
    const w = (logo.w / logo.h) * h
    doc.addImage(logo.data, 'PNG', MARGIN, (bandH - h) / 2, w, h)
    textX = MARGIN + w + 6
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(doc.splitTextToSize(report.title.toUpperCase(), pageW - textX - MARGIN)[0], textX, 13)
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text(report.scope.toUpperCase(), textX, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  doc.text(`Gerado em ${formatGeneratedAt(report.generatedAt)}`, textX, 25.5)

  // Números do recorte: quatro células iguais logo abaixo do cabeçalho
  const statsY = bandH + 6
  const statsH = 14
  const cellGap = 3
  const items = statItems(report.stats)
  const cellW = (pageW - MARGIN * 2 - cellGap * (items.length - 1)) / items.length
  items.forEach((it, i) => {
    const x = MARGIN + i * (cellW + cellGap)
    doc.setFillColor(244, 244, 245)
    doc.rect(x, statsY, cellW, statsH, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(it.label.toUpperCase(), x + 3, statsY + 4.8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...INK)
    doc.text(String(it.value), x + 3, statsY + 11.5)
  })

  let y = statsY + statsH + 10
  const head = ['Pos', 'Nº', 'Atleta', ...report.columns, report.overall ? 'Total' : 'Tempo', 'Dif.']
  const timeCols = report.columns.length + 2 // especiais + total + dif.
  const firstTime = 3

  if (report.sections.length === 0) {
    doc.setTextColor(...GRAY)
    doc.setFontSize(11)
    doc.text('Nenhum atleta para mostrar.', MARGIN, y)
  }

  for (const section of report.sections) {
    if (y > pageH - 40) {
      doc.addPage()
      y = MARGIN + 4
    }
    // Título da categoria
    doc.setFillColor(...BRAND)
    doc.rect(MARGIN, y - 4.2, 1.6, 5.6, 'F')
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(section.category.toUpperCase(), MARGIN + 4, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    const n = section.rows.length
    doc.text(`${n} ${n === 1 ? 'atleta' : 'atletas'}`, pageW - MARGIN, y, { align: 'right' })

    autoTable(doc, {
      startY: y + 3,
      margin: { left: MARGIN, right: MARGIN, bottom: 16 },
      head: [head],
      body: section.rows.map((r) => [r.pos != null ? `${r.pos}º` : '', r.num, r.name, ...r.cells, r.total, r.gap]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: INK, overflow: 'ellipsize' },
      headStyles: { fillColor: [244, 244, 245], textColor: GRAY, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 12, fontStyle: 'bold', halign: 'center' },
        2: { cellWidth: 'auto', fontStyle: 'bold' },
        ...Object.fromEntries(
          Array.from({ length: timeCols }, (_, i) => [
            firstTime + i,
            { cellWidth: 21, halign: 'right' as const, fontStyle: i === timeCols - 2 ? ('bold' as const) : ('normal' as const) },
          ]),
        ),
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const row = section.rows[data.row.index]
        if (data.column.index === 0 && row.pos != null && row.pos <= 3) {
          data.cell.styles.fillColor = PODIUM[row.pos - 1]
        }
        const text = String(data.cell.raw ?? '')
        if (text === 'DNF' || text === 'DNS') data.cell.styles.textColor = [220, 38, 38]
        if (data.column.index === head.length - 1) data.cell.styles.textColor = GRAY
      },
      didDrawCell: (data) => {
        // Linha fina entre atletas
        if (data.section === 'body' && data.column.index === head.length - 1) {
          doc.setDrawColor(228, 228, 231)
          doc.setLineWidth(0.1)
          doc.line(MARGIN, data.cell.y + data.cell.height, pageW - MARGIN, data.cell.y + data.cell.height)
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  }

  // Rodapé com paginação
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(`${report.title} · ${report.scope}`, MARGIN, pageH - 7)
    doc.text(`Página ${p} de ${pages}`, pageW - MARGIN, pageH - 7, { align: 'right' })
  }

  return doc.output('blob')
}
