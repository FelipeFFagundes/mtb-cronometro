import type { Rider } from '../types'

/*
 * Importação de pilotos por planilha CSV.
 * Colunas: numero, nome, categoria (cabeçalho obrigatório, em qualquer ordem).
 * Aceita ";" (padrão do Excel em português) ou "," e campos entre aspas.
 */

export const NAME_MAX = 35

const HEADERS = {
  num: ['numero', 'num', 'n', 'no', 'placa'],
  name: ['nome', 'piloto', 'atleta'],
  cat: ['categoria', 'cat'],
}

export interface CsvIssue {
  line: number
  message: string
  /** Só aviso: a linha foi importada mesmo assim. */
  warning?: boolean
}

export interface CsvImport {
  riders: Rider[]
  /** Categorias citadas na planilha, na ordem em que aparecem. */
  categories: string[]
  issues: CsvIssue[]
}

/** Normaliza cabeçalho: minúsculas, sem acento, sem pontuação ("Número" → "numero", "Nº" → "n"). */
function key(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function detectDelimiter(firstLine: string): string {
  const count = (d: string) => firstLine.split(d).length
  return count(';') >= count(',') ? ';' : ','
}

/** Divide o texto em linhas e campos, respeitando aspas (inclusive quebras de linha dentro delas). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const delim = detectDelimiter(src.split(/\r?\n/, 1)[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function readRidersCsv(text: string): CsvImport {
  const rows = parseCsv(text)
  const issues: CsvIssue[] = []
  const riders: Rider[] = []
  const categories: string[] = []

  const headerIdx = rows.findIndex((r) => r.some((c) => c.trim() !== ''))
  if (headerIdx === -1) return { riders, categories, issues: [{ line: 1, message: 'Planilha vazia' }] }

  const header = rows[headerIdx].map(key)
  const col = (names: string[]) => header.findIndex((h) => names.includes(h))
  const iNum = col(HEADERS.num)
  const iName = col(HEADERS.name)
  const iCat = col(HEADERS.cat)
  if (iNum === -1 || iName === -1 || iCat === -1) {
    const missing = [iNum === -1 && 'numero', iName === -1 && 'nome', iCat === -1 && 'categoria'].filter(Boolean).join(', ')
    return { riders, categories, issues: [{ line: headerIdx + 1, message: `Cabeçalho sem a coluna: ${missing}` }] }
  }

  const seen = new Map<string, number>()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const line = i + 1
    const cells = rows[i]
    const num = (cells[iNum] ?? '').trim().replace(/^#/, '')
    const name = (cells[iName] ?? '').trim().replace(/\s+/g, ' ')
    const cat = (cells[iCat] ?? '').trim().replace(/\s+/g, ' ')

    if (!num && !name && !cat) continue // linha em branco
    if (cat && !categories.includes(cat)) categories.push(cat)
    // Linha só com categoria: cria a categoria vazia
    if (!num && !name) continue

    if (!/^\d+$/.test(num)) {
      issues.push({ line, message: num ? `Número "${num}" inválido (use só dígitos)` : 'Número em branco' })
      continue
    }
    if (!name) {
      issues.push({ line, message: `#${num}: nome em branco` })
      continue
    }
    if (!cat) {
      issues.push({ line, message: `#${num}: categoria em branco` })
      continue
    }
    if (seen.has(num)) {
      issues.push({ line, message: `#${num} repetido (já está na linha ${seen.get(num)})` })
      continue
    }
    if (name.length > NAME_MAX) issues.push({ line, message: `#${num}: nome cortado em ${NAME_MAX} caracteres`, warning: true })
    seen.set(num, line)
    riders.push({ num, name: name.slice(0, NAME_MAX), cat })
  }

  return { riders, categories, issues }
}
