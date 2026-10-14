import { useCallback, useEffect, useState } from 'react'
import { api } from '../data'
import type { AppState, PendingOp, SyncStatus } from '../types'

export function useStore() {
  const [state, setState] = useState<AppState>({ riders: [], runs: [], categories: [] })
  const [sync, setSync] = useState<SyncStatus>(() => api.getSync())
  const [pending, setPending] = useState<PendingOp[]>(() => api.getPending())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setState(await api.load())
      setSync(api.getSync())
      setPending(api.getPending())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return api.subscribe(() => void refresh())
  }, [refresh])

  return { state, sync, pending, loading, error, refresh }
}
