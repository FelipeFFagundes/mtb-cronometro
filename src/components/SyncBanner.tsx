import { api } from '../data'
import type { PendingOp, SyncStatus } from '../types'
import { clock } from '../lib/time'

interface Props {
  sync: SyncStatus
  pending: PendingOp[]
}

/** Faixa que aparece quando está sem conexão ou há ações aguardando envio. */
export function SyncBanner({ sync, pending }: Props) {
  if (sync.online && pending.length === 0) return null

  let text: string
  if (!sync.online) {
    text = pending.length
      ? `📡 Sem conexão · ${pending.length} ${pending.length === 1 ? 'ação guardada' : 'ações guardadas'}`
      : '📡 Sem conexão · os registros serão guardados e enviados depois'
  } else {
    text = `↻ Enviando ${pending.length} ${pending.length === 1 ? 'ação' : 'ações'}…`
  }

  return (
    <div className={'sync-banner' + (sync.online ? ' sending' : ' offline')}>
      <div className="sync-line">
        <span>{text}</span>
        {pending.length > 0 && (
          <button className="mini" disabled={sync.syncing} onClick={() => void api.syncNow()}>
            Sincronizar
          </button>
        )}
      </div>
      {pending.length > 0 && (
        <details>
          <summary>Ver pendências</summary>
          <ul>
            {pending.map((p) => (
              <li key={p.id}>
                <span>
                  {p.label} · {clock(p.at)}
                  {p.attempts > 0 && <em> · aguardando a largada chegar</em>}
                </span>
                <button className="mini danger" onClick={() => api.discardPending(p.id)}>Descartar</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
