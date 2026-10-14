import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import { CATEGORIES, type AppState } from '../types'

interface Props {
  state: AppState
  act: Act
}

export function Pilotos({ state, act }: Props) {
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [cat, setCat] = useState<string>(CATEGORIES[0])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await act(() => api.addRider({ num: num.trim(), name: name.trim(), cat }), 'Piloto adicionado')
    if (ok) { setNum(''); setName('') }
  }

  const riders = state.riders.slice().sort((a, b) => Number(a.num) - Number(b.num))

  return (
    <section>
      <h2>Pilotos</h2>
      <form className="card" onSubmit={(e) => void submit(e)}>
        <div className="row">
          <div>
            <label htmlFor="rNum">Nº</label>
            <input id="rNum" type="text" inputMode="numeric" required placeholder="104" value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
          <div className="grow">
            <label htmlFor="rName">Nome</label>
            <input id="rName" type="text" required placeholder="Lucas Silva" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <label htmlFor="rCat">Categoria</label>
        <select id="rCat" value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Adicionar piloto</button>
      </form>

      <h3>Cadastrados <span className="badge">{riders.length}</span></h3>
      <ul className="list">
        {riders.length === 0 && <li className="empty">Nenhum piloto cadastrado</li>}
        {riders.map((r) => (
          <li key={r.num}>
            <div className="num">{r.num}</div>
            <div className="info">
              <div className="name">{r.name}</div>
              <div className="sub">{r.cat}</div>
            </div>
            <button className="mini danger" onClick={() => void act(() => api.removeRider(r.num))}>Remover</button>
          </li>
        ))}
      </ul>

      <div className="danger-zone">
        <button className="btn btn-ghost" onClick={() => void act(() => api.loadDemo(), 'Dados de exemplo carregados')}>
          Carregar dados de exemplo
        </button>
        <button
          className="btn btn-ghost danger"
          onClick={() => { if (confirm('Apagar todos os pilotos e tempos?')) void act(() => api.reset()) }}
        >
          Apagar tudo
        </button>
      </div>
    </section>
  )
}
