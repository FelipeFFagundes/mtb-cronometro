import { jsPDF } from 'jspdf'
import qrcode from 'qrcode-generator'
import { formatEventDate } from './events'
import { loadLogo } from './report'
import type { EventInfo } from '../types'

/*
 * Cartaz A4 para imprimir e colar na largada, na chegada e na área do público: nome da prova,
 * QR code grande que abre os tempos ao vivo, o código do evento e o link.
 * Fundo branco (economiza tinta); faixa preta com o logo e detalhe em amarelo da identidade.
 */
export async function buildPosterPdf(event: EventInfo, link: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Faixa do topo com o logo
  doc.setFillColor(10, 10, 11)
  doc.rect(0, 0, W, 46, 'F')
  doc.setFillColor(255, 214, 10)
  doc.rect(0, 46, W, 2.5, 'F')
  const logo = await loadLogo(200)
  if (logo) {
    const h = 26
    const w = (logo.w / logo.h) * h
    doc.addImage(logo.data, 'PNG', (W - w) / 2, 10, w, h)
  }

  // Nome, data e local
  doc.setTextColor(10, 10, 11)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  const title = doc.splitTextToSize(event.name.toUpperCase(), W - 30) as string[]
  doc.text(title.slice(0, 2), W / 2, 66, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(90, 90, 96)
  doc.text([formatEventDate(event.startsOn), event.location].filter(Boolean).join(' · '), W / 2, 66 + title.slice(0, 2).length * 12, { align: 'center' })

  // QR code em retângulos (nítido em qualquer impressora)
  const qr = qrcode(0, 'M')
  qr.addData(link)
  qr.make()
  const n = qr.getModuleCount()
  const size = 120
  const cell = size / n
  const x0 = (W - size) / 2
  const y0 = 100
  doc.setFillColor(10, 10, 11)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(x0 + c * cell, y0 + r * cell, cell + 0.05, cell + 0.05, 'F')
  }

  doc.setTextColor(10, 10, 11)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Aponte a câmera e acompanhe os tempos ao vivo', W / 2, y0 + size + 16, { align: 'center' })
  if (event.publicCode) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(90, 90, 96)
    doc.text('Código do evento', W / 2, y0 + size + 30, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(34)
    doc.setTextColor(10, 10, 11)
    doc.text(event.publicCode.split('').join(' '), W / 2, y0 + size + 44, { align: 'center' })
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(113, 113, 122)
  doc.text(link, W / 2, H - 14, { align: 'center' })
  return doc.output('blob')
}
