import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './data'
import { useStore } from './hooks/useStore'
import { Largada } from './components/Largada'
import { Chegada } from './components/Chegada'
import { Ranking } from './components/Ranking'
import { Pilotos } from './components/Pilotos'
import { SyncBanner } from './components/SyncBanner'

type View = 'largada' | 'chegada' | 'ranking' | 'pilotos'

const TABS: { id: View; icon: string; label: string }[] = [
  { id: 'largada', icon: '🚦', label: 'Largada' },
  { id: 'chegada', icon: '🏁', label: 'Chegada' },
  { id: 'ranking', icon: '🏆', label: 'Ranking' },
  { id: 'pilotos', icon: '👥', label: 'Pilotos' },
]

/** Executa uma ação, mostra toast de sucesso/erro e devolve se deu certo. */
export type Act = (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>

function initialView(): View {
  const h = location.hash.replace('#', '')
  return TABS.some((t) => t.id === h) ? (h as View) : 'largada'
}

export default function App() {
  const { state, sync, pending, loading, error, refresh } = useStore()
  const [view, setView] = useState<View>(initialView)
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((msg: string, err = false) => {
    setToast({ msg, err })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2600)
    navigator.vibrate?.(err ? [80, 60, 80] : 60)
  }, [])

  // Avisos vindos da fila (ex.: uma ação foi rejeitada pelo servidor ao sincronizar)
  useEffect(() => api.onNotice((msg, isErr) => show(msg, isErr)), [show])

  const act: Act = useCallback(
    async (fn, okMsg) => {
      try {
        await fn()
        if (okMsg) show(okMsg)
        void refresh()
        return true
      } catch (e) {
        show(e instanceof Error ? e.message : 'Erro inesperado', true)
        return false
      }
    },
    [refresh, show],
  )

  const go = (v: View) => {
    setView(v)
    history.replaceState(null, '', '#' + v)
  }

  let chip = '● modo local'
  let chipClass = 'sync'
  if (api.mode === 'supabase') {
    if (!sync.online) { chip = '● offline'; chipClass = 'sync off' }
    else if (sync.syncing) { chip = '↻ sincronizando'; chipClass = 'sync flash' }
    else chip = '● tempo real'
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="SPET Logo" className="brand-logo" />
          <span><strong>MTB</strong> Cronômetro</span>
        </div>
        <div className={chipClass}>{chip}</div>
      </header>

      <SyncBanner sync={sync} pending={pending} />

      <main>
        {error && <div className="banner">{error}</div>}
        {loading ? (
          <p className="hint">Carregando…</p>
        ) : (
          <>
            {view === 'largada' && <Largada state={state} act={act} online={sync.online} />}
            {view === 'chegada' && <Chegada state={state} act={act} online={sync.online} />}
            {view === 'ranking' && <Ranking state={state} />}
            {view === 'pilotos' && <Pilotos state={state} act={act} />}
          </>
        )}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={view === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <div className={'toast' + (toast ? ' show' : '') + (toast?.err ? ' err' : '')}>{toast?.msg}</div>
    </>
  )
}
