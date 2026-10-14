import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { clock, fmt } from '../lib/time'
import { LiveTimer } from './LiveTimer'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

export function Chegada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<{ num: string; name: string } | null>(null)

  const value = num.trim()
  const rider = state.riders.find((r) => r.num === value)
  const onTrack = state.runs.some((r) => r.num === value && r.status === 'track')

  let preview = 'Digite o número ou clique em CHEGOU na lista abaixo…'
  let cls = 'preview'
  if (value) {
    if (!rider) { preview = 'Piloto não encontrado'; cls = 'preview err' }
    else if (!onTrack && !online) { preview = `${rider.name} · largada não confirmada (offline), será validada depois`; cls = 'preview ok' }
    else if (!onTrack) { preview = `${rider.name} não está na pista`; cls = 'preview err' }
    else { preview = `${rider.name} · ${rider.cat}`; cls = 'preview ok' }
  }

  // Registra a chegada de fato após confirmação
  const executeFinish = async (n: string) => {
    const targetName = state.riders.find((r) => r.num === n)?.name ?? '#' + n
    setConfirmTarget(null)
    setNum('')
    return act(() => api.finishRun(n).then(() => undefined), `🏁 ${targetName} chegou!` + (online ? '' : ' (salvo offline)'))
  }

  // Pede confirmação antes de bater o tempo
  const requestFinish = (n: string) => {
    const rName = state.riders.find((r) => r.num === n)?.name ?? `Piloto #${n}`
    setConfirmTarget({ num: n, name: rName })
  }

  const submit = () => {
    if (!value) return act(async () => { throw new Error('Informe o número do piloto') })
    requestFinish(value)
  }

  const track = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)
  const done = state.runs.filter((r) => r.status !== 'track' && r.end != null).sort((a, b) => b.end! - a.end!).slice(0, 8)

  return (
    <section>
      <h2>Chegada</h2>

      {/* MODAL DE CONFIRMAÇÃO DE CHEGADA ANTI-ERRO */}
      {confirmTarget && (
        <div className="confirm-overlay">
          <div className="confirm-modal card">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏁</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 20 }}>Confirmar Chegada?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 16 }}>
              Registrar chegada do piloto <strong>#{confirmTarget.num} - {confirmTarget.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => setConfirmTarget(null)}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="btn btn-finish" 
                style={{ flex: 1.5, padding: 14, fontSize: 18 }}
                onClick={() => void executeFinish(confirmTarget.num)}
              >
                SIM, CHEGOU!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <label htmlFor="finishNum">Número do piloto</label>
        <input
          id="finishNum" type="text" inputMode="numeric" autoComplete="off" placeholder="Ex: 104"
          value={num} onChange={(e) => setNum(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className={cls}>{preview}</div>
        <button className="btn btn-finish" onClick={submit}>CHEGOU</button>
      </div>

      <h3>Na pista agora <span className="badge">{track.length}</span></h3>
      <ul className="list">
        {track.length === 0 && <li className="empty">Ninguém na pista</li>}
        {track.map((run) => {
          const r = state.riders.find((x) => x.num === run.num)
          return (
            <li key={run.id}>
              <div className="num">{run.num}</div>
              <div className="info">
                <div className="name">{r?.name ?? '?'}</div>
                <div className="sub">{r?.cat}</div>
              </div>
              <div className="time"><LiveTimer start={run.start} /></div>
              <button className="mini finish" onClick={() => requestFinish(run.num)}>CHEGOU</button>
              <button className="mini danger" onClick={() => void act(() => api.dnfRun(run.id))}>DNF</button>
            </li>
          )
        })}
      </ul>

      <h3>Últimas chegadas</h3>
      <ul className="list">
        {done.length === 0 && <li className="empty">Nenhuma chegada ainda</li>}
        {done.map((run) => {
          const r = state.riders.find((x) => x.num === run.num)
          return (
            <li key={run.id}>
              <div className="num">{run.num}</div>
              <div className="info">
                <div className="name">{r?.name ?? '?'}</div>
                <div className="sub">chegou às {clock(run.end!)}</div>
              </div>
              {run.status === 'dnf'
                ? <div className="time" style={{ color: 'var(--red)' }}>DNF</div>
                : <div className="time done">{fmt(run.end! - run.start)}</div>}
              <button className="mini danger" onClick={() => void act(() => api.undoRun(run.id))}>Desfazer</button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
