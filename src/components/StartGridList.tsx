import { Fragment } from 'react'
import { Box, Typography } from '@mui/material'
import type { Stage, StartGridItem } from '../types'
import { tabular, tokens } from '../theme'
import { ListCard, RiderPlate } from './ui'

/** Lista da ordem de largada agrupada por categoria (e por especial, quando misturadas). */
export function StartGridList({ items, stages }: { items: StartGridItem[]; stages: Stage[] }) {
  const firstId = stages[0]?.id
  const stageOf = (i: StartGridItem) => i.stageId || firstId
  const mixedStages = new Set(items.map(stageOf)).size > 1

  return (
    <ListCard>
      {items.map((item, idx) => {
        const prev = items[idx - 1]
        const newGroup = !prev || prev.category !== item.category || stageOf(prev) !== stageOf(item)
        const stageName = stages.find((s) => s.id === stageOf(item))?.name
        return (
          <Fragment key={`${stageOf(item)}-${item.num}-${idx}`}>
            {newGroup && (
              <Box sx={{ px: 2, py: 1, bgcolor: tokens.raised }}>
                <Typography variant="overline" sx={{ color: 'primary.main', lineHeight: 1.4 }}>
                  {mixedStages && stageName ? `${stageName} · ` : ''}
                  {item.category}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
              <Typography sx={{ ...tabular, width: 28, color: 'text.secondary', fontWeight: 700, fontSize: '0.85rem' }}>
                {idx + 1}º
              </Typography>
              <RiderPlate num={item.num} size="sm" tone="muted" />
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
                {item.riderName}
              </Typography>
              <Typography sx={{ ...tabular, fontWeight: 800, color: 'primary.main' }}>{item.scheduledTimeStr}</Typography>
            </Box>
          </Fragment>
        )
      })}
    </ListCard>
  )
}
