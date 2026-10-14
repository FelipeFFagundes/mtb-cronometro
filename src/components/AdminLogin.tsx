import { useState, type FormEvent } from 'react'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export function AdminLogin({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  // PIN configurável via variável de ambiente VITE_ADMIN_PIN (padrão: 1234)
  const expectedPin = (import.meta.env.VITE_ADMIN_PIN as string | undefined) || '1234'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (pin.trim() === expectedPin.trim()) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    }
  }

  const handleKeyClick = (val: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + val)
      setError(false)
    }
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
    setError(false)
  }

  return (
    <div className="login-overlay">
      <div className="login-modal card">
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Área Restrita</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14 }}>
          Digite o PIN de acesso de Fiscal / ADM
        </p>

        <form onSubmit={handleSubmit}>
          <div className="pin-display">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              readOnly
              value={pin}
              placeholder="••••"
              className={`pin-input ${error ? 'err' : ''}`}
            />
          </div>

          {error && <div className="pin-error-msg">PIN incorreto. Tente novamente.</div>}

          {/* Teclado Numérico Touch para Mobile */}
          <div className="pin-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                className="pin-key"
                onClick={() => handleKeyClick(digit)}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="pin-key action"
              onClick={handleDelete}
              title="Apagar"
            >
              ⌫
            </button>
            <button
              type="button"
              className="pin-key"
              onClick={() => handleKeyClick('0')}
            >
              0
            </button>
            <button
              type="submit"
              className="pin-key submit"
              disabled={pin.length === 0}
            >
              ➜
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, marginTop: 0 }}
              onClick={onCancel}
            >
              Voltar aos Resultados
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, marginTop: 0 }}
              disabled={pin.length === 0}
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
