import { useState, useEffect, useRef } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider } from '../types'
import { clock } from '../lib/time'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

export function Largada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const [countdownRider, setCountdownRider] = useState<Rider | null>(null)
  const [count, setCount] = useState<number | 'VAI!'>(3)
  const timerRef = useRef<number | undefined>(undefined)

  const value = num.trim()
  const rider = state.riders.find((r) => r.num === value)
  const onTrack = state.runs.some((r) => r.num === value && r.status === 'track')

  let preview = 'Digite o número ou clique em um piloto abaixo…'
  let cls = 'preview'
  if (value) {
    if (!rider) { preview = 'Piloto não encontrado'; cls = 'preview err' }
    else if (onTrack) { preview = `${rider.name} já está na pista`; cls = 'preview err' }
    else { preview = `${rider.name} · ${rider.cat}`; cls = 'preview ok' }
  }

  // Efeito da Contagem Regressiva em Tela Cheia (3, 2, 1, VAI!)
  useEffect(() => {
    if (!countdownRider) return

    setCount(3)
    let current = 3

    timerRef.current = window.setInterval(() => {
      current -= 1
      if (current === 0) {
        setCount('VAI!')
        // Dispara a largada exata no momento do "VAI!"
        void act(
          () => api.startRun(countdownRider.num).then(() => undefined),
          `🚦 #${countdownRider.num} ${countdownRider.name} largou!` + (online ? '' : ' (salvo offline)')
        )
      } else if (current < 0) {
        clearInterval(timerRef.current)
        setCountdownRider(null)
      } else {
        setCount(current)
      }
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [countdownRider, act, online])

  const cancelCountdown = () => {
    clearInterval(timerRef.current)
    setCountdownRider(null)
  }

  const startCountdown = (r: Rider) => {
    if (state.runs.some((run) => run.num === r.num && run.status === 'track')) {
      return act(async () => { throw new Error(`${r.name} já está na pista`) })
    }
    setNum('')
    setCountdownRider(r)
  }

  const submit = () => {
    if (!value) return act(async () => { throw new Error('Informe ou selecione um piloto') })
    if (!rider) return act(async () => { throw new Error(`Piloto #${value} não encontrado`) })
    if (onTrack) return act(async () => { throw new Error(`${rider.name} já está na pista`) })
    startCountdown(rider)
  }

  // Pilotos cadastrados que NÃO estão na pista neste momento
  const availableRiders = state.riders
    .filter((r) => !state.runs.some((run) => run.num === r.num && run.status === 'track'))
    .sort((a, b) => Number(a.num) - Number(b.num))

  const recent = state.runs.slice().sort((a, b) => b.start - a.start).slice(0, 8)

  return (
    <section>
      <h2>Largada</h2>

      {/* MODAL DE CONTAGEM REGRESSIVA EM TELA CHEIA */}
      {countdownRider && (
        <div className="countdown-overlay">
          <div className="countdown-rider">
            <span className="c-num">#{countdownRider.num}</span>
            <span className="c-name">{countdownRider.name}</span>
            <span className="c-cat">{countdownRider.cat}</span>
          </div>

          <div className={`countdown-number ${count === 'VAI!' ? 'go' : ''}`}>
            {count}
          </div>

          <button className="btn btn-ghost danger c-cancel" onClick={cancelCountdown}>
            Cancelar Largada
          </button>
        </div>
      )}

      {/* CARD PRINCIPAL DE LARGADA */}
      <div className="card">
        <label htmlFor="startNum">Número do piloto</label>
        <input
          id="startNum" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Ex: 104"
          value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className={cls}>{preview}</div>
        <button className="btn btn-start" onClick={submit}>LARGAR</button>
      </div>

      {/* GRID DE PILOTOS PRONTOS PARA LARGAR */}
      <h3>Disponíveis para largada <span className="badge">{availableRiders.length}</span></h3>
      {availableRiders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>
          {state.riders.length === 0 ? 'Nenhum piloto cadastrado ainda' : 'Todos os pilotos já estão na pista'}
        </div>
      ) : (
        <div className="riders-grid">
          {availableRiders.map((r) => (
            <button
              key={r.num}
              type="button"
              className={`rider-chip-card ${value === r.num ? 'selected' : ''}`}
              onClick={() => {
                setNum(r.num)
              }}
              onDoubleClick={() => startCountdown(r)}
            >
              <div className="rc-top">
                <span className="rc-num">#{r.num}</span>
                <span className="rc-cat">{r.cat}</span>
              </div>
              <div className="rc-name">{r.name}</div>
            </button>
          ))}
        </div>
      )}

      <h3>Últimas largadas</h3>
      <ul className="list">
        {recent.length === 0 && <li className="empty">Nenhuma largada ainda</li>}
        {recent.map((run) => {
          const r = state.riders.find((x) => x.num === run.num)
          return (
            <li key={run.id}>
              <div className="num">{run.num}</div>
              <div className="info">
                <div className="name">{r?.name ?? '?'}</div>
                <div className="sub">largou às {clock(run.start)}</div>
              </div>
              {run.status === 'track' && (
                <button className="mini danger" onClick={() => void act(() => api.undoRun(run.id))}>Desfazer</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
