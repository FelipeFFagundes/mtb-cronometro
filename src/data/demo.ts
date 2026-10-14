import type { Rider, Stage } from '../types'

export const DEMO_STAGES: Stage[] = [
  { id: 'stage-1', name: 'E1 - SPET', order: 1 },
  { id: 'stage-2', name: 'E2 - Erechim', order: 2 },
  { id: 'stage-3', name: 'E3 - teste', order: 3 },
]

/**
 * Atletas de demonstração:
 * - Top 3 Masculino: Loïc Bruni, Troy Brosnan, Amaury Pierron
 * - Top 3 Feminino: Valentina Höll, Lisa Baumann, Harriet Harnden
 */
export const DEMO_RIDERS: Rider[] = [
  // Top 3 Masculino
  { num: '1', name: 'Loïc Bruni', cat: 'Masculino' },
  { num: '2', name: 'Troy Brosnan', cat: 'Masculino' },
  { num: '3', name: 'Amaury Pierron', cat: 'Masculino' },

  // Top 3 Feminino
  { num: '11', name: 'Valentina Höll', cat: 'Feminino' },
  { num: '12', name: 'Lisa Baumann', cat: 'Feminino' },
  { num: '13', name: 'Harriet Harnden', cat: 'Feminino' },
]

/** Tempos de descida (ms) por atleta para cada especial */
export const DEMO_STAGE_TIMES: Record<string, Record<string, number>> = {
  '1': {
    'stage-1': 163240,
    'stage-2': 185110,
    'stage-3': 142300,
  },
  '2': {
    'stage-1': 164110,
    'stage-2': 184500,
    'stage-3': 143100,
  },
  '3': {
    'stage-1': 164590,
    'stage-2': 186200,
    'stage-3': 141900,
  },
  '11': {
    'stage-1': 182450,
    'stage-2': 202100,
    'stage-3': 158300,
  },
  '12': {
    'stage-1': 184910,
    'stage-2': 203400,
    'stage-3': 159100,
  },
  '13': {
    'stage-1': 186300,
    'stage-2': 201900,
    'stage-3': 161200,
  },
}
