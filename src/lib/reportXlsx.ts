import writeXlsxFile, { type SheetData } from 'write-excel-file/browser'
import type { Report } from './report'

/*
 * Resultado em Excel: uma aba por categoria, com posição, placa, atleta, cada especial, total e
 * diferença. Carregado sob demanda (só quando alguém exporta).
 */

/** Nome de aba válido no Excel: até 31 caracteres, sem : \ / ? * [ ] e sem repetir. */
function sheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Categoria'
  let n = 2
  while (used.has(base.toLowerCase())) base = `${base.slice(0, 28)} ${n++}`
  used.add(base.toLowerCase())
  return base
}

export async function buildReportXlsx(report: Report): Promise<Blob> {
  const used = new Set<string>()
  const head = ['Pos', 'Nº', 'Atleta', ...report.columns, report.overall ? 'Total' : 'Tempo', 'Dif.']
  const sections = report.sections.length > 0 ? report.sections : [{ category: 'Resultado', rows: [] }]
  const sheets = sections.map((section) => {
    const data: SheetData = [
      [{ value: `${report.title} · ${report.scope} · ${section.category}`, fontWeight: 'bold' }],
      head.map((h) => ({ value: h, fontWeight: 'bold' as const })),
      ...section.rows.map((r) => [r.pos ?? '', r.num, r.name, ...r.cells, r.total, r.gap].map((v) => (v === '' ? null : { value: v }))),
    ]
    return {
      data,
      sheet: sheetName(section.category, used),
      columns: [{ width: 6 }, { width: 6 }, { width: 28 }, ...report.columns.map(() => ({ width: 11 })), { width: 12 }, { width: 12 }],
      stickyRowsCount: 2,
    }
  })
  return writeXlsxFile(sheets).toBlob()
}
