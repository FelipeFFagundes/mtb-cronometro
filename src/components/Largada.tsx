import { useState } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'
import { clock } from '../lib/time'

interface Props {
  state: AppState
  act: Act
  online: boolean
}

export function Largada({ state, act, online }: Props) {
  const [num, setNum] = useState('')
  const value = num.trim()
  const rider = state.riders.find((r) => r.num === value)
  const onTrack = state.runs.some((r) => r.num === value && r.status === 'track')

  let preview = 'Digite o número…'
  let cls = 'preview'
  if (value) {
    if (!rider) { preview = 'Piloto não encontrado'; cls = 'preview err' }
    else if (onTrack) { preview = `${rider.name} já está na pista`; cls = 'preview err' }
    else { preview = `${rider.name} · ${rider.cat}`; cls = 'preview ok' }
  }

  const submit = async () => {
    if (!value) return act(async () => { throw new Error('Informe o número') })
    const ok = await act(
      () => api.startRun(value).then(() => undefined),
      `🚦 ${rider?.name ?? '#' + value} largou!` + (online ? '' : ' (salvo offline)'),
    )
    if (ok) setNum('')
  }

  const recent = state.runs.slice().sort((a, b) => b.start - a.start).slice(0, 8)

  return (
    <section>
      <h2>Largada</h2>
      <div className="card">
        <label htmlFor="startNum">Número do piloto</label>
        <input
          id="startNum" type="text" inputMode="numeric" autoComplete="off" placeholder="Ex: 104"
          value={num} onChange={(e) => setNum(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <div className={cls}>{preview}</div>
        <button className="btn btn-start" onClick={() => void submit()}>LARGAR</button>
      </div>

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
