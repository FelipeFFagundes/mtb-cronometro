import { useEffect, useRef } from 'react'

/*
 * Atalhos de teclado para quem cronometra num computador (mesa de largada/chegada).
 * No celular não atrapalham: só disparam com teclado físico.
 */

/** Há painel, diálogo ou menu aberto? Atalhos da tela ficam pausados. */
export function overlayOpen(): boolean {
  return document.querySelector('.MuiModal-root:not(.MuiModal-hidden)') !== null
}

/** O foco está num campo de texto (o atalho não deve roubar a digitação)? */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Escuta teclas na janela inteira; o handler sempre vê o estado mais recente. */
export function useKeydown(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
