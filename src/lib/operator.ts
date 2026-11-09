/*
 * Nome de quem opera este aparelho (fiscal identificado). Vai junto com cada largada e chegada
 * e aparece no histórico de alterações. Fica salvo só no aparelho.
 */
const KEY = 'mtb-operator-v1'

export function getOperator(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setOperator(name: string) {
  try {
    const clean = name.trim().slice(0, 40)
    if (clean) localStorage.setItem(KEY, clean)
    else localStorage.removeItem(KEY)
  } catch {
    // Sem acesso ao armazenamento: segue sem nome
  }
}
