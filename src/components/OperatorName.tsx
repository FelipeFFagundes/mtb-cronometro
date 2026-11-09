import { useState } from 'react'
import { getOperator, setOperator } from '../lib/operator'
import { BottomSheet } from './ui'
import { Box, Button, TextField, Typography } from '@mui/material'

/**
 * Nome de quem opera o aparelho. Vai junto com cada largada e chegada e aparece no histórico,
 * para saber quem registrou o quê quando há mais de um fiscal.
 */
export function OperatorName({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(getOperator)
  const save = () => {
    setOperator(name)
    onSaved(getOperator())
    onClose()
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Quem está neste aparelho?">
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          O nome vai junto com cada largada e chegada registrada aqui e aparece no histórico da prova. Fica salvo só neste aparelho.
        </Typography>
        <TextField label="Seu nome" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} autoFocus fullWidth />
        <Button type="submit" variant="contained" size="large">
          Salvar
        </Button>
      </Box>
    </BottomSheet>
  )
}
