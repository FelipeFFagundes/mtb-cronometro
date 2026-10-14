import { useState } from 'react'
import type { AppState } from '../types'
import { buildRanking } from '../lib/ranking'
import { fmt } from '../lib/time'

export function Ranking({ state }: { state: AppState }) {
  const [cat, setCat] = useState('Todas')
  const rows = buildRanking(state, cat)
  const categories = state.categories || []

  return (
    <section>
      <h2>Ranking</h2>
      <div className="chips">
        {['Todas', ...categories].map((c) => (
          <button key={c} className={'chip' + (c === cat ? ' active' : '')} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="rank">
          <thead>
            <tr><th>#</th><th>Piloto</th><th>Categoria</th><th className="r">Tempo</th><th className="r">Diferença</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={5}>Sem tempos nesta categoria</td></tr>}
            {rows.map((row, i) => (
              <tr key={row.rider.num} className={`p${i + 1}`}>
                <td className="pos">{i + 1}</td>
                <td className="pname">{row.rider.name}<small>#{row.rider.num}</small></td>
                <td><span className="cat-tag">{row.rider.cat}</span></td>
                <td className="r"><strong>{fmt(row.time)}</strong></td>
                <td className="r gap">{i === 0 ? '—' : '+' + fmt(row.time - rows[0].time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Considera a <strong>melhor descida</strong> de cada piloto.</p>
    </section>
  )
}
