import type { Rider } from '../types'

/**
 * Pilotos reais de demonstração baseados no Top mundial da Copa do Mundo UCI DHI (Downhill):
 * - Top 5 Masculino Elite: Loïc Bruni, Troy Brosnan, Amaury Pierron, Ronan Dunne, Finn Iles
 * - Top 3 Feminino Elite: Valentina Höll, Lisa Baumann, Harriet Harnden
 */
export const DEMO_RIDERS: Rider[] = [
  // Top 5 Elite Masculino
  { num: '1', name: 'Loïc Bruni', cat: 'Elite' },
  { num: '2', name: 'Troy Brosnan', cat: 'Elite' },
  { num: '3', name: 'Amaury Pierron', cat: 'Elite' },
  { num: '4', name: 'Ronan Dunne', cat: 'Elite' },
  { num: '5', name: 'Finn Iles', cat: 'Elite' },

  // Top Elite Feminino
  { num: '11', name: 'Valentina Höll', cat: 'Feminino' },
  { num: '12', name: 'Lisa Baumann', cat: 'Feminino' },
  { num: '13', name: 'Harriet Harnden', cat: 'Feminino' },
]

/** Tempos de descida (ms) de exemplo para cada atleta */
export const DEMO_TIMES: Record<string, number> = {
  '1': 163240, // 02:43.24 - Loïc Bruni (1º)
  '2': 164110, // 02:44.11 - Troy Brosnan (+0.87s)
  '3': 164590, // 02:44.59 - Amaury Pierron (+1.35s)
  '4': 165820, // 02:45.82 - Ronan Dunne (+2.58s)
  '5': 166430, // 02:46.43 - Finn Iles (+3.19s)
  '11': 182450, // 03:02.45 - Valentina Höll
  '12': 184910, // 03:04.91 - Lisa Baumann
  '13': 186300, // 03:06.30 - Harriet Harnden
}
