import type { Rider } from '../types'

export const DEMO_RIDERS: Rider[] = [
  { num: '101', name: 'Lucas Silva', cat: 'Elite' },
  { num: '102', name: 'Marcos Pereira', cat: 'Elite' },
  { num: '103', name: 'Rafael Costa', cat: 'Master' },
  { num: '104', name: 'Bruno Alves', cat: 'Sport' },
  { num: '105', name: 'Ana Souza', cat: 'Feminino' },
  { num: '106', name: 'Julia Lima', cat: 'Feminino' },
  { num: '107', name: 'Pedro Rocha', cat: 'Iniciante' },
]

/** Tempo de descida (ms) de cada piloto de exemplo. */
export const DEMO_TIMES: Record<string, number> = {
  '101': 165555,
  '102': 168210,
  '103': 172900,
  '104': 181430,
  '105': 190120,
  '106': 195800,
  '107': 214300,
}
