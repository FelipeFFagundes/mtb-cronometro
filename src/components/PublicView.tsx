import { useState } from 'react'
import type { AppState } from '../types'
import { buildRanking } from '../lib/ranking'
import { fmt } from '../lib/time'
import { LiveTimer } from './LiveTimer'

export function PublicView({ state }: { state: AppState }) {
  const [cat, setCat] = useState('Todas')
  const rows = buildRanking(state, cat)
  const categories = state.categories || []

  // Atletas que estão descendo a trilha neste exato momento
  const onTrack = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start)

  return (
    <section className="public-view">
      {/* SEÇÃO AO VIVO: ATLETAS NA PISTA */}
      <div className="live-track-section card">
        <div className="live-track-header">
          <div className="live-pulse-badge">
            <span className="live-dot"></span> AO VIVO NA PISTA ({onTrack.length})
          </div>
          <span className="live-sub">Cronometragem em tempo real</span>
        </div>

        {onTrack.length === 0 ? (
          <div className="live-empty">
            Nenhum atleta na pista no momento. Aguardando largada...
          </div>
        ) : (
          <div className="live-riders-grid">
            {onTrack.map((run) => {
              const rider = state.riders.find((r) => r.num === run.num)
              return (
                <div key={run.id} className="live-rider-card">
                  <div className="lrc-header">
                    <span className="lrc-num">#{run.num}</span>
                    <span className="lrc-cat">{rider?.cat}</span>
                  </div>
                  <div className="lrc-name">{rider?.name ?? 'Piloto'}</div>
                  <div className="lrc-timer">
                    <LiveTimer start={run.start} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO DE RESULTADOS & RANKING */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Classificação Oficial</h2>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Melhor tempo por piloto</span>
      </div>

      {/* Filtro por Categorias */}
      <div className="chips" style={{ marginTop: 12 }}>
        {['Todas', ...categories].map((c) => (
          <button key={c} className={'chip' + (c === cat ? ' active' : '')} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="rank">
          <thead>
            <tr>
              <th>#</th>
              <th>Piloto</th>
              <th>Categoria</th>
              <th className="r">Tempo</th>
              <th className="r">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="empty" colSpan={5}>
                  Nenhum tempo registrado nesta categoria ainda
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.rider.num} className={`p${i + 1}`}>
                <td className="pos">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="pname">
                  {row.rider.name}
                  <small>#{row.rider.num}</small>
                </td>
                <td>
                  <span className="cat-tag">{row.rider.cat}</span>
                </td>
                <td className="r">
                  <strong>{fmt(row.time)}</strong>
                </td>
                <td className="r gap">{i === 0 ? '—' : '+' + fmt(row.time - rows[0].time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
