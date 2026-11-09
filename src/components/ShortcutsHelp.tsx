import { useState } from 'react'
import { useKeydown, isTyping, overlayOpen } from '../hooks/useKeyboard'
import { BottomSheet, Kbd } from './ui'
import { Box, Typography } from '@mui/material'

const SHORTCUTS: { screen: string; keys: { key: string; what: string }[] }[] = [
  {
    screen: 'Largada',
    keys: [
      { key: 'Enter', what: 'Larga o piloto selecionado (contagem 3, 2, 1)' },
      { key: '/', what: 'Busca na fila por placa ou nome' },
      { key: 'Enter na busca', what: 'Larga o primeiro piloto encontrado' },
    ],
  },
  {
    screen: 'Chegada',
    keys: [
      { key: '1 a 9', what: 'Registra a chegada do piloto naquela posição dos cartões' },
      { key: 'Enter', what: 'Confirma a chegada' },
    ],
  },
  { screen: 'Qualquer tela', keys: [{ key: '?', what: 'Mostra esta ajuda' }] },
]

/** Ajuda dos atalhos de teclado (tecla ?), para quem cronometra no computador. */
export function ShortcutsHelp({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  useKeydown((e) => {
    if (e.key !== '?' || isTyping(e.target) || overlayOpen()) return
    e.preventDefault()
    setOpen(true)
  }, enabled)
  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Atalhos de teclado">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SHORTCUTS.map((g) => (
          <Box key={g.screen}>
            <Typography variant="overline" color="text.secondary">
              {g.screen}
            </Typography>
            {g.keys.map((k) => (
              <Box key={k.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                <Kbd sx={{ display: 'inline-flex', minWidth: 48 }}>{k.key}</Kbd>
                <Typography variant="body2">{k.what}</Typography>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </BottomSheet>
  )
}
