import { useEffect, useState } from 'react'
import { api } from '../data'
import { fmt } from '../lib/time'

/** Cronômetro ao vivo; usa o horário do servidor (corrigido pelo offset). */
export function LiveTimer({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now() + api.getClockOffset())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + api.getClockOffset()), 50)
    return () => clearInterval(id)
  }, [])
  return <>{fmt(now - start)}</>
}
