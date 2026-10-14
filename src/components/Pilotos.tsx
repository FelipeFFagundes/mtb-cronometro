import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState } from '../types'

interface Props {
  state: AppState
  act: Act
}

export function Pilotos({ state, act }: Props) {
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)

  const categories = state.categories && state.categories.length > 0 ? state.categories : ['Geral']
  const [cat, setCat] = useState<string>(categories[0] || 'Geral')

  // Garante que a categoria selecionada exista
  const activeCat = categories.includes(cat) ? cat : categories[0]

  const submitRider = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await act(() => api.addRider({ num: num.trim(), name: name.trim(), cat: activeCat }), 'Piloto adicionado')
    if (ok) { setNum(''); setName('') }
  }

  const submitCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCat.trim()) return
    const ok = await act(() => api.addCategory(newCat.trim()), `Categoria "${newCat.trim()}" adicionada`)
    if (ok) {
      setCat(newCat.trim())
      setNewCat('')
    }
  }

  const removeCategory = async (catName: string) => {
    if (confirm(`Excluir a categoria "${catName}"?`)) {
      await act(() => api.removeCategory(catName), `Categoria "${catName}" removida`)
    }
  }

  const riders = state.riders.slice().sort((a, b) => Number(a.num) - Number(b.num))

  return (
    <section>
      <h2>Pilotos & Categorias</h2>

      {/* Gerenciador de Categorias (Expansível) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Categorias ({categories.length})</strong>
          <button 
            type="button"
            className="mini" 
            onClick={() => setShowCatManager(!showCatManager)}
          >
            {showCatManager ? 'Fechar' : '⚙️ Gerenciar Categorias'}
          </button>
        </div>

        {showCatManager && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--panel-2)' }}>
            <form onSubmit={(e) => void submitCategory(e)} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Nova categoria (ex: E-Bike, Junior)"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                style={{ fontSize: 15, padding: '8px 12px' }}
              />
              <button className="mini" style={{ padding: '0 16px', background: 'var(--blue)', color: '#082f49' }} type="submit">
                Adicionar
              </button>
            </form>

            <ul className="list">
              {categories.map((c) => {
                const count = state.riders.filter((r) => r.cat === c).length
                return (
                  <li key={c} style={{ padding: '8px 12px' }}>
                    <div className="info">
                      <div className="name" style={{ fontSize: 15 }}>{c}</div>
                      <div className="sub">{count} {count === 1 ? 'piloto' : 'pilotos'}</div>
                    </div>
                    <button
                      className="mini danger"
                      onClick={() => void removeCategory(c)}
                      title="Excluir categoria"
                    >
                      Remover
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Cadastro de Piloto */}
      <form className="card" onSubmit={(e) => void submitRider(e)}>
        <h3 style={{ margin: '0 0 12px' }}>Novo Piloto</h3>
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
        <select id="rCat" value={activeCat} onChange={(e) => setCat(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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
