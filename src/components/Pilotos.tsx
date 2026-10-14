import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider } from '../types'

interface Props {
  state: AppState
  act: Act
}

export function Pilotos({ state, act }: Props) {
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)

  // Estado para piloto em edição (modal ou formulário de edição)
  const [editingRider, setEditingRider] = useState<{ originalNum: string; num: string; name: string; cat: string } | null>(null)
  // Estado para confirmação de remoção de piloto
  const [deletingRider, setDeletingRider] = useState<Rider | null>(null)

  const categories = state.categories && state.categories.length > 0 ? state.categories : ['Geral']
  const [cat, setCat] = useState<string>(categories[0] || 'Geral')

  // Garante que a categoria selecionada exista
  const activeCat = categories.includes(cat) ? cat : categories[0]

  const submitRider = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await act(() => api.addRider({ num: num.trim(), name: name.trim(), cat: activeCat }), 'Piloto adicionado')
    if (ok) { setNum(''); setName('') }
  }

  const startEdit = (r: Rider) => {
    setEditingRider({
      originalNum: r.num,
      num: r.num,
      name: r.name,
      cat: r.cat,
    })
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingRider) return

    const trimmedNum = editingRider.num.trim()
    const trimmedName = editingRider.name.trim()

    if (!trimmedNum) return act(async () => { throw new Error('O número do piloto é obrigatório') })
    if (!trimmedName) return act(async () => { throw new Error('O nome do piloto é obrigatório') })

    const ok = await act(
      () => api.updateRider(editingRider.originalNum, { num: trimmedNum, name: trimmedName, cat: editingRider.cat }),
      `Piloto #${trimmedNum} atualizado!`
    )
    if (ok) {
      setEditingRider(null)
    }
  }

  const confirmRemoveRider = async () => {
    if (!deletingRider) return
    const target = deletingRider
    setDeletingRider(null)
    await act(() => api.removeRider(target.num), `Piloto #${target.num} (${target.name}) removido`)
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

      {/* MODAL DE EDIÇÃO DO PILOTO */}
      {editingRider && (
        <div className="confirm-overlay">
          <div className="confirm-modal card" style={{ maxWidth: 440, textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 20 }}>Editar Piloto #{editingRider.originalNum}</h3>

            <form onSubmit={(e) => void saveEdit(e)}>
              <div className="row" style={{ marginBottom: 12 }}>
                <div>
                  <label htmlFor="editNum">Nº</label>
                  <input
                    id="editNum"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    placeholder="104"
                    value={editingRider.num}
                    onChange={(e) => {
                      const numeric = e.target.value.replace(/\D/g, '')
                      setEditingRider({ ...editingRider, num: numeric })
                    }}
                  />
                </div>
                <div className="grow">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label htmlFor="editName">Nome</label>
                    <span style={{ fontSize: 11, color: editingRider.name.length >= 35 ? 'var(--amber)' : 'var(--muted)' }}>
                      {editingRider.name.length}/35
                    </span>
                  </div>
                  <input
                    id="editName"
                    type="text"
                    required
                    maxLength={35}
                    value={editingRider.name}
                    onChange={(e) => setEditingRider({ ...editingRider, name: e.target.value.slice(0, 35) })}
                  />
                </div>
              </div>

              <label htmlFor="editCat">Categoria</label>
              <select
                id="editCat"
                value={editingRider.cat}
                onChange={(e) => setEditingRider({ ...editingRider, cat: e.target.value })}
                style={{ marginBottom: 20 }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, marginTop: 0 }}
                  onClick={() => setEditingRider(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.2, marginTop: 0 }}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PILOTO */}
      {deletingRider && (
        <div className="confirm-overlay">
          <div className="confirm-modal card" style={{ borderColor: 'var(--red)', maxWidth: 400 }}>
            <div style={{ fontSize: 36, marginBottom: 4 }}>🗑️</div>
            <h3 style={{ margin: '0 0 6px', color: 'var(--red)', fontSize: 20 }}>Excluir Atleta?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 15 }}>
              Tem certeza que deseja excluir <strong>#{deletingRider.num} - {deletingRider.name}</strong> ({deletingRider.cat})?
              <br />
              <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                Todas as descidas e tempos deste piloto também serão apagados.
              </small>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => setDeletingRider(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-finish"
                style={{ flex: 1.2, padding: 14, fontSize: 16, background: 'var(--red)' }}
                onClick={() => void confirmRemoveRider()}
              >
                SIM, EXCLUIR
              </button>
            </div>
          </div>
        </div>
      )}

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
            <input
              id="rNum"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              placeholder="104"
              value={num}
              onChange={(e) => {
                const numeric = e.target.value.replace(/\D/g, '')
                setNum(numeric)
              }}
            />
          </div>
          <div className="grow">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="rName">Nome</label>
              <span style={{ fontSize: 11, color: name.length >= 35 ? 'var(--amber)' : 'var(--muted)' }}>
                {name.length}/35
              </span>
            </div>
            <input
              id="rName"
              type="text"
              required
              maxLength={35}
              placeholder="Lucas Silva"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 35))}
            />
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button 
                type="button" 
                className="mini" 
                onClick={() => startEdit(r)}
                style={{ background: 'var(--panel-2)' }}
              >
                ✏️ Editar
              </button>
              <button 
                type="button" 
                className="mini danger" 
                onClick={() => setDeletingRider(r)}
              >
                Remover
              </button>
            </div>
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
