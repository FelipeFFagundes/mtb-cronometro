import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './data'
import { useStore } from './hooks/useStore'
import { Largada } from './components/Largada'
import { Chegada } from './components/Chegada'
import { Ranking } from './components/Ranking'
import { Pilotos } from './components/Pilotos'
import { PublicView } from './components/PublicView'
import { SyncBanner } from './components/SyncBanner'

type AdminTab = 'largada' | 'chegada' | 'ranking' | 'pilotos'

const ADMIN_TABS: { id: AdminTab; icon: string; label: string }[] = [
  { id: 'largada', icon: '🚦', label: 'Largada' },
  { id: 'chegada', icon: '🏁', label: 'Chegada' },
  { id: 'ranking', icon: '🏆', label: 'Ranking' },
  { id: 'pilotos', icon: '👥', label: 'Pilotos' },
]

/** Executa uma ação, mostra toast de sucesso/erro e devolve se deu certo. */
export type Act = (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>

function getInitialMode(): 'public' | 'admin' {
  const hash = location.hash.replace('#', '')
  return hash === 'admin' ? 'admin' : 'public'
}

export default function App() {
  const { state, sync, pending, loading, error, refresh } = useStore()
  const [mode, setMode] = useState<'public' | 'admin'>(getInitialMode)
  const [adminTab, setAdminTab] = useState<AdminTab>('largada')
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

  const switchMode = (newMode: 'public' | 'admin') => {
    setMode(newMode)
    history.replaceState(null, '', newMode === 'admin' ? '#admin' : '#')
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

        <div className="topbar-actions">
          {/* Seletor de Modo: Público vs Admin */}
          <div className="mode-switch">
            <button
              type="button"
              className={`mode-btn ${mode === 'public' ? 'active' : ''}`}
              onClick={() => switchMode('public')}
            >
              👀 Resultados
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'admin' ? 'active' : ''}`}
              onClick={() => switchMode('admin')}
            >
              ⚙️ Fiscal / ADM
            </button>
          </div>

          <div className={chipClass}>{chip}</div>
        </div>
      </header>

      {mode === 'admin' && <SyncBanner sync={sync} pending={pending} />}

      <main>
        {error && <div className="banner">{error}</div>}
        {loading ? (
          <p className="hint">Carregando dados…</p>
        ) : mode === 'public' ? (
          /* TELA DE VISUALIZAÇÃO PÚBLICA (RESULTADOS + ATLETAS NA PISTA) */
          <PublicView state={state} />
        ) : (
          /* TELA DE ADMINISTRAÇÃO E FISCAIS */
          <>
            {adminTab === 'largada' && <Largada state={state} act={act} online={sync.online} />}
            {adminTab === 'chegada' && <Chegada state={state} act={act} online={sync.online} />}
            {adminTab === 'ranking' && <Ranking state={state} />}
            {adminTab === 'pilotos' && <Pilotos state={state} act={act} />}
          </>
        )}
      </main>

      {/* Barra de navegação inferior (apenas no modo ADMIN) */}
      {mode === 'admin' && (
        <nav className="tabs">
          {ADMIN_TABS.map((t) => (
            <button
              key={t.id}
              className={adminTab === t.id ? 'active' : ''}
              onClick={() => setAdminTab(t.id)}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
      )}

      <div className={'toast' + (toast ? ' show' : '') + (toast?.err ? ' err' : '')}>{toast?.msg}</div>
    </>
  )
}
