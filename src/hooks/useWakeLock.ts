import { useEffect } from 'react'

type Lock = { release: () => Promise<void> }

/**
 * Mantém a tela acesa enquanto `on` (onde o navegador permite). O sistema solta o bloqueio quando
 * o app vai para o segundo plano, então ele é pedido de novo sempre que a tela volta.
 */
export function useWakeLock(on = true) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
    if (!on || !wl) return
    let lock: Lock | null = null
    let alive = true
    const request = () => {
      if (document.visibilityState !== 'visible') return
      void wl
        .request('screen')
        .then((l) => {
          if (alive) lock = l
          else void l.release()
        })
        .catch(() => undefined)
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', request)
      void lock?.release().catch(() => undefined)
    }
  }, [on])
}
