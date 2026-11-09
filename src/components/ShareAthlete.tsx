import { useState } from 'react'
import type { AppState } from '../types'
import { buildAthleteCard, CARD_LAYOUTS, renderAthleteCard, renderEventImage, type CardLayout, type EventImageKind } from '../lib/athleteCard'
import { ChipSelect } from './ui'
import { ImageSheet } from './ImageSheet'
import { Typography } from '@mui/material'

interface Props {
  state: AppState
  /** Placa do atleta; null fecha. */
  num: string | null
  onClose: () => void
}

/** Card do atleta para compartilhar: modelo, cores, formato e a opção sem fundo (para pôr sobre uma foto). */
export function ShareAthlete({ state, num, onClose }: Props) {
  const [layout, setLayout] = useState<CardLayout>('completo')
  const card = num ? buildAthleteCard(state, num) : null
  return (
    <ImageSheet
      open={Boolean(card)}
      onClose={onClose}
      title={card ? `Imagem · ${card.name}` : 'Imagem'}
      render={(opts) => renderAthleteCard(card!, { ...opts, layout })}
      // O card muda quando chega um tempo novo; a prévia acompanha
      renderKey={`${layout}|${card ? JSON.stringify(card) : ''}`}
      fileName={card?.fileName ?? 'atleta.png'}
      shareTitle={card ? `${card.name} · ${card.event}` : ''}
    >
      <ChipSelect
        ariaLabel="Modelo"
        value={layout}
        onChange={(v) => setLayout(v as CardLayout)}
        options={CARD_LAYOUTS.map((x) => ({ value: x.id, label: x.label }))}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        {CARD_LAYOUTS.find((x) => x.id === layout)?.text}
      </Typography>
    </ImageSheet>
  )
}

/** Imagem do evento: classificação de uma categoria ou divulgação dos inscritos. */
export function ShareEvent({ state, kind, open, onClose, initialCategory }: { state: AppState; kind: EventImageKind; open: boolean; onClose: () => void; initialCategory?: string }) {
  const cats = state.categories.filter((c) => state.riders.some((r) => r.cat === c))
  const [category, setCategory] = useState(initialCategory && initialCategory !== 'Todas' ? initialCategory : kind === 'roster' ? 'Todas' : (cats[0] ?? 'Todas'))
  const options = kind === 'roster' ? ['Todas', ...cats] : cats
  const slug = (state.event?.name ?? 'prova').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  // Classificação e inscritos mudam a cada tempo ou cadastro: a prévia acompanha
  const key = `${kind}|${category}|${state.runs.length}|${state.riders.length}|${state.runs.reduce((n, r) => n + (r.end ?? 0) + (r.penaltyMs ?? 0), 0)}`
  return (
    <ImageSheet
      open={open}
      onClose={onClose}
      title={kind === 'roster' ? 'Imagem dos inscritos' : 'Imagem da classificação'}
      render={(opts) => renderEventImage(state, kind, { ...opts, category })}
      renderKey={key}
      fileName={`${slug}-${kind === 'roster' ? 'inscritos' : 'classificacao'}.png`}
      shareTitle={state.event?.name ?? 'Race Timer'}
    >
      {options.length > 1 && (
        <ChipSelect ariaLabel="Categoria" value={category} onChange={setCategory} options={options.map((c) => ({ value: c, label: c }))} />
      )}
    </ImageSheet>
  )
}
