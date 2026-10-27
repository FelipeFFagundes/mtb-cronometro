/*
 * Sons da largada, gerados com Web Audio (sem arquivos: funciona offline).
 * Bipes de onda quadrada, que cortam melhor o barulho ao ar livre, no padrão de portão de largada:
 * três bipes curtos (3, 2, 1) e um bipe longo e mais agudo no "VAI!".
 */

const SOUND_KEY = 'mtb-sound-v1'

let ctx: AudioContext | null = null

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* armazenamento bloqueado: vale só nesta sessão */
  }
}

/**
 * Prepara o áudio. Precisa ser chamado dentro de um toque do usuário:
 * celulares só liberam som depois de uma interação.
 */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

function beep(freq: number, ms: number, volume = 0.25) {
  if (!ctx || !isSoundEnabled()) return
  const t = ctx.currentTime
  const end = t + ms / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  // Ataque e soltura curtos para evitar estalos
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.setValueAtTime(volume, end - 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(end + 0.02)
}

/** Bipe curto de cada segundo da contagem (3, 2, 1). */
export const playCountdownTick = () => beep(880, 160)

/** Bipe longo e mais agudo no "VAI!". */
export const playStartGo = () => beep(1320, 750, 0.3)
