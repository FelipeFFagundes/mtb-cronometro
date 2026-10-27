import { useEffect, useState } from 'react'
import { afterHistorySettles } from './useBackClose'

/*
 * Rotas no "#" da URL (não exigem configuração no servidor de hospedagem):
 *   #/                    início: escolher entre acompanhar uma prova, fiscal ou organizador
 *   #/eventos             eventos abertos e encerrados, "tenho um código"
 *   #/e/K7MQ2             evento K7MQ2, telas do público
 *   #/e/K7MQ2/fiscal      evento K7MQ2, telas do fiscal/organizador
 *   #/organizar           eventos do organizador
 *   #/ajuda               como usar o app
 * O antigo "#admin" abre as telas do fiscal no evento em uso.
 */

export type Route =
  | { name: 'home' }
  | { name: 'events' }
  | { name: 'organizer' }
  | { name: 'help' }
  /** code vazio = evento em uso (links antigos "#admin"). */
  | { name: 'event'; code: string; fiscal: boolean }

export function parseRoute(hash: string): Route {
  if (hash === '#admin') return { name: 'event', code: '', fiscal: true }
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'organizar') return { name: 'organizer' }
  if (parts[0] === 'eventos') return { name: 'events' }
  if (parts[0] === 'ajuda') return { name: 'help' }
  if (parts[0] === 'e' && parts[1]) {
    return { name: 'event', code: decodeURIComponent(parts[1]).toUpperCase(), fiscal: parts[2] === 'fiscal' }
  }
  return { name: 'home' }
}

export function routeHash(route: Route): string {
  if (route.name === 'organizer') return '#/organizar'
  if (route.name === 'events') return '#/eventos'
  if (route.name === 'help') return '#/ajuda'
  if (route.name === 'event') return `#/e/${encodeURIComponent(route.code)}${route.fiscal ? '/fiscal' : ''}`
  return '#/'
}

/** Link completo de um evento (para compartilhar e para o QR code). */
export function eventLink(code: string): string {
  return `${location.origin}${location.pathname}${routeHash({ name: 'event', code, fiscal: false })}`
}

/**
 * Rota atual e função para navegar. A navegação espera o histórico assentar: abrir uma tela a
 * partir de um menu ou painel (que fecham e removem a própria entrada do histórico) não pode
 * ser desfeita por essa remoção.
 */
export function useRoute(): [Route, (route: Route, opts?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (next: Route, opts?: { replace?: boolean }) =>
    afterHistorySettles(() => {
      const hash = routeHash(next)
      if (location.hash === hash) return
      // pushState em vez de location.hash: mudar o hash dispara popstate, que o controle do botão
      // Voltar (useBackClose) entenderia como "voltar" e fecharia o painel que estiver aberto
      if (opts?.replace) history.replaceState(null, '', hash)
      else history.pushState(null, '', hash)
      setRoute(parseRoute(hash))
    })

  return [route, navigate]
}
