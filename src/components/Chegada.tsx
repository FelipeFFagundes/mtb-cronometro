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

interface ConfirmTarget {
  num: string
  name: string
  /** Carimbo do instante em que o fiscal apertou o botão */
  capturedAt: number
  startAt: number | null
}

interface DnfTarget {
  id: string
  num: string
  name: string
}

export function Chegada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [dnfTarget, setDnfTarget] = useState<DnfTarget | null>(null)

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

  // Registra a chegada de fato usando o tempo capturado no 1º clique
  const executeFinish = async (target: ConfirmTarget) => {
    const targetName = target.name
    setConfirmTarget(null)
    setNum('')
    return act(
      () => api.finishRun(target.num, target.capturedAt).then(() => undefined),
      `🏁 ${targetName} chegou! ` + (target.startAt ? `(${fmt(target.capturedAt - target.startAt)})` : '') + (online ? '' : ' (salvo offline)')
    )
  }

  // Captura o instante do clique e pede confirmação de chegada
  const requestFinish = (n: string) => {
    const rName = state.riders.find((r) => r.num === n)?.name ?? `Piloto #${n}`
    const run = state.runs.find((r) => r.num === n && r.status === 'track')
    // Captura o momento exato do clique com relógio sincronizado
    const capturedAt = Date.now() + api.getClockOffset()
    setConfirmTarget({
      num: n,
      name: rName,
      capturedAt,
      startAt: run ? run.start : null,
    })
  }

  // Executa o DNF após confirmação
  const executeDnf = async (target: DnfTarget) => {
    setDnfTarget(null)
    return act(
      () => api.dnfRun(target.id),
      `⚠️ Piloto #${target.num} (${target.name}) marcado como DNF`
    )
  }

  // Pede confirmação de DNF
  const requestDnf = (runId: string, riderNum: string) => {
    const rName = state.riders.find((r) => r.num === riderNum)?.name ?? `Piloto #${riderNum}`
    setDnfTarget({ id: runId, num: riderNum, name: rName })
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

      {/* MODAL DE CONFIRMAÇÃO DE CHEGADA (COM TEMPO CONGELADO) */}
      {confirmTarget && (
        <div className="confirm-overlay">
          <div className="confirm-modal card">
            <div style={{ fontSize: 32, marginBottom: 4 }}>⏱️</div>
            <h3 style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: 20 }}>Confirmar Chegada?</h3>
            <p style={{ margin: '0 0 14px', fontSize: 16 }}>
              Piloto <strong>#{confirmTarget.num} - {confirmTarget.name}</strong>
            </p>

            {/* Caixa com o tempo congelado */}
            <div className="captured-time-box">
              <span className="captured-label">Tempo capturado no clique:</span>
              <span className="captured-value">
                {confirmTarget.startAt ? fmt(confirmTarget.capturedAt - confirmTarget.startAt) : clock(confirmTarget.capturedAt)}
              </span>
              {confirmTarget.startAt && (
                <div className="still-running-indicator">
                  Se cancelar, o cronômetro continua: <LiveTimer start={confirmTarget.startAt} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => setConfirmTarget(null)}
              >
                Cancelar (Segue na Pista)
              </button>
              <button 
                type="button" 
                className="btn btn-finish" 
                style={{ flex: 1.3, padding: 14, fontSize: 17 }}
                onClick={() => void executeFinish(confirmTarget)}
              >
                CONFIRMAR TEMPO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DNF */}
      {dnfTarget && (
        <div className="confirm-overlay">
          <div className="confirm-modal card" style={{ borderColor: 'var(--red)' }}>
            <div style={{ fontSize: 36, marginBottom: 4 }}>⚠️</div>
            <h3 style={{ margin: '0 0 6px', color: 'var(--red)', fontSize: 20 }}>Confirmar DNF (Não Terminou)?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text)' }}>
              Tem certeza que deseja marcar <strong>#{dnfTarget.num} - {dnfTarget.name}</strong> como DNF?
              <br />
              <small style={{ color: 'var(--muted)' }}>O tempo na pista será encerrado sem classificação.</small>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => setDnfTarget(null)}
              >
                Cancelar (Segue na Pista)
              </button>
              <button 
                type="button" 
                className="btn btn-finish" 
                style={{ flex: 1.2, padding: 14, fontSize: 16, background: 'var(--red)' }}
                onClick={() => void executeDnf(dnfTarget)}
              >
                CONFIRMAR DNF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <label htmlFor="finishNum">Número do piloto</label>
        <input
          id="finishNum" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Ex: 104"
          value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
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
              <button className="mini danger" onClick={() => requestDnf(run.id, run.num)}>DNF</button>
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
