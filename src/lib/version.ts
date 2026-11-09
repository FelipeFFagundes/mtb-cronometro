/* Versão gravada no build (vite.config.ts): o commit e a hora em que o app foi gerado. */
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? new Date(__BUILD_TIME__) : null

/** "versão 615b393 · 09/11 14:32" */
export function versionText(): string {
  const when = BUILD_TIME ? BUILD_TIME.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  return `versão ${APP_VERSION}${when ? ` · ${when}` : ''}`
}
