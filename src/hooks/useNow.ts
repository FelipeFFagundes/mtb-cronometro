import { useEffect, useState } from 'react'
import { api } from '../data'

/** Horário do servidor (relógio local + offset), atualizado a cada `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + api.getClockOffset())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + api.getClockOffset()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
