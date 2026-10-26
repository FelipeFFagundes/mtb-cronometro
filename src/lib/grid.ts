import type { Stage, StartGridItem } from '../types'

/** Itens da grade de uma especial (itens sem especial valem para a primeira). */
export function gridForStage(items: StartGridItem[], stageId: string, stages: Stage[]): StartGridItem[] {
  const firstId = stages[0]?.id
  return items.filter((i) => (i.stageId || firstId) === stageId)
}
