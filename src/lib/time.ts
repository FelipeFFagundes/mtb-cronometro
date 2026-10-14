export function fmt(ms: number): string {
  if (ms < 0) ms = 0
  const cs = Math.floor((ms % 1000) / 10)
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR')
}
