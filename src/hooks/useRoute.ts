import { useEffect, useState } from 'react'
import { afterHistorySettles } from './useBackClose'

/*
 * Rotas no "#" da URL (não exigem configuração no servidor de hospedagem):
 *   #/                    início: escolher entre acompanhar uma prova, fiscal ou organizador
 *   #/eventos             eventos abertos e encerrados, "tenho um código"
 *   #/e/K7MQ2             evento K7MQ2, telas do público
 *   #/e/K7MQ2/fiscal      evento K7MQ2, telas do fiscal/organizador
 *   #/e/K7MQ2/tv          evento K7MQ2 em tela cheia para TV ou telão (sem login)
 *   #/e/K7MQ2/atleta/12   página pública do atleta de placa 12 no evento
 *   #/e/K7MQ2/simples     fiscal simplificado: só Largada e Chegada
 *   #/e/K7MQ2/simples/C   o mesmo, entrando com o código C do fiscal (QR code); o código sai do endereço logo depois
 *   #/organizar           eventos do organizador
 *   #/ajuda               como usar o app
 *   #/tv                  TV pareada: mostra um código; o organizador escolhe o evento e o que ela exibe
 * O antigo "#admin" abre as telas do fiscal no evento em uso.
 */

export type Route =
  | { name: 'home' }
  | { name: 'events' }
  | { name: 'organizer' }
  | { name: 'help' }
  | { name: 'tvpair' }
  /** code vazio = evento em uso (links antigos "#admin"). */
  | {
      name: 'event'
      code: string
      fiscal: boolean
      tv?: boolean
      /** Fiscal simplificado: só Largada e Chegada. */
      simple?: boolean
      /** Código do fiscal vindo do QR code (entra e some do endereço). */
      join?: string
      /** Placa do atleta: página pública dele. */
      athlete?: string
    }

export function parseRoute(hash: string): Route {
  if (hash === '#admin') return { name: 'event', code: '', fiscal: true }
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'organizar') return { name: 'organizer' }
  if (parts[0] === 'eventos') return { name: 'events' }
  if (parts[0] === 'ajuda') return { name: 'help' }
  if (parts[0] === 'tv') return { name: 'tvpair' }
  if (parts[0] === 'e' && parts[1]) {
    const code = decodeURIComponent(parts[1]).toUpperCase()
    if (parts[2] === 'atleta' && parts[3]) return { name: 'event', code, fiscal: false, athlete: decodeURIComponent(parts[3]) }
    if (parts[2] === 'simples') {
      return { name: 'event', code, fiscal: true, simple: true, join: parts[3] ? decodeURIComponent(parts[3]) : undefined }
    }
    return { name: 'event', code, fiscal: parts[2] === 'fiscal', tv: parts[2] === 'tv' }
  }
  return { name: 'home' }
}

export function routeHash(route: Route): string {
  if (route.name === 'organizer') return '#/organizar'
  if (route.name === 'events') return '#/eventos'
  if (route.name === 'help') return '#/ajuda'
  if (route.name === 'tvpair') return '#/tv'
  if (route.name === 'event') {
    const sub = route.athlete
      ? `/atleta/${encodeURIComponent(route.athlete)}`
      : route.simple
        ? `/simples${route.join ? `/${encodeURIComponent(route.join)}` : ''}`
        : route.fiscal
          ? '/fiscal'
          : route.tv
            ? '/tv'
            : ''
    return `#/e/${encodeURIComponent(route.code)}${sub}`
  }
  return '#/'
}

/** Link completo de um evento (para compartilhar e para o QR code). */
export function eventLink(code: string, tv = false): string {
  return `${location.origin}${location.pathname}${routeHash({ name: 'event', code, fiscal: false, tv })}`
}

/** Link do QR code do fiscal: abre o modo simplificado já entrando com o código. */
export function marshalLink(eventCode: string, marshalCode: string): string {
  return `${location.origin}${location.pathname}${routeHash({ name: 'event', code: eventCode, fiscal: true, simple: true, join: marshalCode })}`
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
