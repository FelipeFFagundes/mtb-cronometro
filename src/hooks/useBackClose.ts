import { useEffect, useRef } from 'react'

/*
 * Botão/gesto "voltar" do celular fecha o painel ou diálogo aberto em vez de sair do app.
 * Cada camada aberta corresponde a uma entrada no histórico; o voltar fecha a de cima.
 * Abrir e fechar pela interface só ajusta o histórico depois (sync), em lote: fechar um painel
 * e abrir outro no mesmo toque não gera history.back() + pushState concorrentes.
 */

interface Layer {
  id: number
  close: () => void
}

const stack: Layer[] = []
let seq = 0
/** Entradas que empilhamos no histórico e ainda estão lá. */
let pushed = 0
/** Voltas disparadas por nós mesmos (ao fechar pela interface) que devem ser ignoradas. */
let ownPops = 0
let scheduled = false
let idle: (() => void)[] = []

function flushIdle() {
  const fns = idle
  idle = []
  fns.forEach((fn) => fn())
}

/** Deixa o número de entradas no histórico igual ao de camadas abertas. */
function sync() {
  scheduled = false
  if (ownPops > 0) return // termina quando a volta pendente chegar (popstate)
  if (stack.length > pushed) {
    for (; pushed < stack.length; pushed++) history.pushState({ ...(history.state as object | null), layer: pushed + 1 }, '')
  } else if (stack.length < pushed) {
    const n = pushed - stack.length
    pushed = stack.length
    ownPops = 1 // history.go(-n) gera um único popstate
    history.go(-n)
    return
  }
  flushIdle()
}

function schedule() {
  if (scheduled) return
  scheduled = true
  setTimeout(sync, 0)
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ownPops > 0) {
      ownPops--
      sync()
      return
    }
    // Voltar do usuário: fecha a camada de cima
    if (pushed > 0) pushed--
    stack.pop()?.close()
  })
}

/**
 * Roda `fn` depois que o histórico terminar de se ajustar aos painéis fechados.
 * Use para trocar a URL (replaceState) logo após fechar um painel, senão a volta desfaz a troca.
 */
export function afterHistorySettles(fn: () => void) {
  idle.push(fn)
  schedule()
}

export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const id = ++seq
    stack.push({ id, close: () => closeRef.current() })
    schedule()
    return () => {
      const idx = stack.findIndex((l) => l.id === id)
      if (idx === -1) return // já saiu pelo voltar
      stack.splice(idx, 1)
      schedule()
    }
  }, [open])
}
