import type { Rider, Stage } from '../types'

export const DEMO_STAGES: Stage[] = [
  { id: 'stage-1', name: 'E1 - SPET', order: 1 },
  { id: 'stage-2', name: 'E2 - Erechim', order: 2 },
  { id: 'stage-3', name: 'E3 - teste', order: 3 },
]

/**
 * Atletas de demonstração de nível internacional:
 * - Elite Masculino: Loïc Bruni, Troy Brosnan, Amaury Pierron, Ronan Dunne, Finn Iles
 * - Elite Feminino: Valentina Höll, Lisa Baumann, Harriet Harnden
 */
export const DEMO_RIDERS: Rider[] = [
  // Elite Masculino
  { num: '1', name: 'Loïc Bruni', cat: 'Elite' },
  { num: '2', name: 'Troy Brosnan', cat: 'Elite' },
  { num: '3', name: 'Amaury Pierron', cat: 'Elite' },
  { num: '4', name: 'Ronan Dunne', cat: 'Elite' },
  { num: '5', name: 'Finn Iles', cat: 'Elite' },

  // Elite Feminino
  { num: '11', name: 'Valentina Höll', cat: 'Feminino' },
  { num: '12', name: 'Lisa Baumann', cat: 'Feminino' },
  { num: '13', name: 'Harriet Harnden', cat: 'Feminino' },
]

/** Tempos de descida (ms) por atleta para cada especial */
export const DEMO_STAGE_TIMES: Record<string, Record<string, number>> = {
  // Loïc Bruni
  '1': {
    'stage-1': 163240, // 02:43.24
    'stage-2': 185110, // 03:05.11
    'stage-3': 142300, // 02:22.30
  },
  // Troy Brosnan
  '2': {
    'stage-1': 164110, // 02:44.11 (+0.87)
    'stage-2': 184500, // 03:04.50 (melhor na E2)
    'stage-3': 143100, // 02:23.10 (+0.80)
  },
  // Amaury Pierron
  '3': {
    'stage-1': 164590, // 02:44.59
    'stage-2': 186200, // 03:06.20
    'stage-3': 141900, // 02:21.90 (melhor na E3)
  },
  // Ronan Dunne
  '4': {
    'stage-1': 165820,
    'stage-2': 187400,
    'stage-3': 144500,
  },
  // Finn Iles
  '5': {
    'stage-1': 166430,
    'stage-2': 188100,
    'stage-3': 145200,
  },
  // Valentina Höll
  '11': {
    'stage-1': 182450, // 03:02.45
    'stage-2': 202100, // 03:22.10
    'stage-3': 158300, // 02:38.30
  },
  // Lisa Baumann
  '12': {
    'stage-1': 184910,
    'stage-2': 203400,
    'stage-3': 159100,
  },
  // Harriet Harnden
  '13': {
    'stage-1': 186300,
    'stage-2': 201900, // melhor na E2 feminino
    'stage-3': 161200,
  },
}
