import { useState, type FormEvent } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider } from '../types'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Chip,
  Collapse,
  Alert,
} from '@mui/material'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'

interface Props {
  state: AppState
  act: Act
}

export function Pilotos({ state, act }: Props) {
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)

  // Gerenciador de Especiais / Trilhas
  const [newStageName, setNewStageName] = useState('')
  const [showStageManager, setShowStageManager] = useState(false)
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null)

  const stages = state.stages && state.stages.length > 0 ? state.stages : []

  // Estado para piloto em edição (modal)
  const [editingRider, setEditingRider] = useState<{ originalNum: string; num: string; name: string; cat: string } | null>(null)
  // Estado para confirmação de remoção de piloto
  const [deletingRider, setDeletingRider] = useState<Rider | null>(null)

  const categories = state.categories && state.categories.length > 0 ? state.categories : ['Geral']
  const [cat, setCat] = useState<string>(categories[0] || 'Geral')

  // Garante que a categoria selecionada exista
  const activeCat = categories.includes(cat) ? cat : categories[0]

  const submitRider = async (e: FormEvent) => {
    e.preventDefault()
    if (!num.trim()) return act(async () => { throw new Error('Informe o número do atleta') })
    if (!name.trim()) return act(async () => { throw new Error('Informe o nome do atleta') })

    const ok = await act(() => api.addRider({ num: num.trim(), name: name.trim(), cat: activeCat }), 'Piloto adicionado')
    if (ok) { setNum(''); setName('') }
  }

  const startEdit = (r: Rider) => {
    setEditingRider({
      originalNum: r.num,
      num: r.num,
      name: r.name,
      cat: r.cat,
    })
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingRider) return

    const trimmedNum = editingRider.num.trim()
    const trimmedName = editingRider.name.trim()

    if (!trimmedNum) return act(async () => { throw new Error('O número do piloto é obrigatório') })
    if (!trimmedName) return act(async () => { throw new Error('O nome do piloto é obrigatório') })

    const ok = await act(
      () => api.updateRider(editingRider.originalNum, { num: trimmedNum, name: trimmedName, cat: editingRider.cat }),
      `Piloto #${trimmedNum} atualizado!`
    )
    if (ok) {
      setEditingRider(null)
    }
  }

  const confirmRemoveRider = async () => {
    if (!deletingRider) return
    const target = deletingRider
    setDeletingRider(null)
    await act(() => api.removeRider(target.num), `Piloto #${target.num} (${target.name}) removido`)
  }

  const submitCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCat.trim()) return
    const ok = await act(() => api.addCategory(newCat.trim()), `Categoria "${newCat.trim()}" adicionada`)
    if (ok) {
      setCat(newCat.trim())
      setNewCat('')
    }
  }

  const removeCategory = async (catName: string) => {
    if (confirm(`Excluir a categoria "${catName}"?`)) {
      await act(() => api.removeCategory(catName), `Categoria "${catName}" removida`)
    }
  }

  const submitStage = async (e: FormEvent) => {
    e.preventDefault()
    if (!newStageName.trim()) return
    const ok = await act(() => api.addStage(newStageName.trim()), `Especial "${newStageName.trim()}" adicionada!`)
    if (ok) {
      setNewStageName('')
    }
  }

  const removeStage = async (stageId: string, stageName: string) => {
    if (confirm(`Excluir a especial "${stageName}"?`)) {
      await act(() => api.removeStage(stageId), `Especial "${stageName}" removida`)
    }
  }

  const saveEditStage = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingStage) return
    const trimmed = editingStage.name.trim()
    if (!trimmed) return act(async () => { throw new Error('O nome da especial não pode ser vazio') })
    const ok = await act(() => api.updateStage(editingStage.id, trimmed), `Especial renomeada para "${trimmed}"!`)
    if (ok) {
      setEditingStage(null)
    }
  }

  const riders = state.riders.slice().sort((a, b) => Number(a.num) - Number(b.num))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          👥 Atletas & Categorias
        </Typography>
        <Chip
          label={`${riders.length} cadastrados`}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* MODAL DE EDIÇÃO DO PILOTO */}
      <Dialog
        open={Boolean(editingRider)}
        onClose={() => setEditingRider(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        {editingRider && (
          <form onSubmit={(e) => void saveEdit(e)}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              Editar Atleta #{editingRider.originalNum}
            </DialogTitle>

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
              <TextField
                label="Número"
                value={editingRider.num}
                onChange={(e) => {
                  const numeric = e.target.value.replace(/\D/g, '')
                  setEditingRider({ ...editingRider, num: numeric })
                }}
                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                fullWidth
                required
              />

              <TextField
                label="Nome do Atleta"
                value={editingRider.name}
                onChange={(e) => setEditingRider({ ...editingRider, name: e.target.value.slice(0, 35) })}
                helperText={`${editingRider.name.length}/35 caracteres`}
                slotProps={{
                  formHelperText: {
                    sx: {
                      color: editingRider.name.length >= 35 ? 'warning.main' : 'text.secondary',
                      textAlign: 'right',
                    },
                  },
                }}
                fullWidth
                required
              />

              <FormControl fullWidth>
                <InputLabel id="edit-cat-label">Categoria</InputLabel>
                <Select
                  labelId="edit-cat-label"
                  value={editingRider.cat}
                  label="Categoria"
                  onChange={(e) => setEditingRider({ ...editingRider, cat: e.target.value })}
                >
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setEditingRider(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ fontWeight: 700 }}
              >
                Salvar Alterações
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* MODAL DE EDIÇÃO DE ESPECIAL */}
      <Dialog
        open={Boolean(editingStage)}
        onClose={() => setEditingStage(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        {editingStage && (
          <form onSubmit={(e) => void saveEditStage(e)}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              Editar Nome da Especial
            </DialogTitle>

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
              <TextField
                label="Nome da Especial"
                value={editingStage.name}
                onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                placeholder="Ex: E1 · Trilha da Onça"
                fullWidth
                required
                autoFocus
              />
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setEditingStage(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                fullWidth
                sx={{ fontWeight: 700 }}
              >
                Salvar Nome
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog
        open={Boolean(deletingRider)}
        onClose={() => setDeletingRider(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              textAlign: 'center',
              borderColor: 'error.main',
            },
          },
        }}
      >
        {deletingRider && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'rgba(239, 68, 68, 0.15)',
                  color: 'error.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h5" color="error.main" sx={{ fontWeight: 800 }}>
                Excluir Atleta?
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
              <Typography variant="body1">
                Tem certeza que deseja excluir <strong>#{deletingRider.num} - {deletingRider.name}</strong> ({deletingRider.cat})?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                Todas as descidas e tempos deste piloto também serão apagados do sistema.
              </Alert>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setDeletingRider(null)}
                sx={{ py: 1.2 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => void confirmRemoveRider()}
                sx={{ py: 1.2, fontWeight: 800 }}
              >
                SIM, EXCLUIR
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* GERENCIADOR DE CATEGORIAS EXPANSÍVEL */}
      <Card>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryRoundedIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Categorias ({categories.length})
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setShowCatManager(!showCatManager)}
              endIcon={showCatManager ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              sx={{ borderRadius: 2, fontSize: '0.8rem' }}
            >
              {showCatManager ? 'Fechar' : 'Gerenciar'}
            </Button>
          </Box>

          <Collapse in={showCatManager}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <form onSubmit={(e) => void submitCategory(e)}>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Nova categoria (ex: E-Bike, Junior)"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="small"
                    sx={{ px: 2.5, whiteSpace: 'nowrap' }}
                  >
                    Adicionar
                  </Button>
                </Box>
              </form>

              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {categories.map((c) => {
                  const count = state.riders.filter((r) => r.cat === c).length
                  return (
                    <ListItem
                      key={c}
                      sx={{
                        py: 1.2,
                        pl: 2.5,
                        pr: 6,
                        bgcolor: 'background.default',
                        borderRadius: 2.5,
                        mb: 0.8,
                      }}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          color="error"
                          size="small"
                          onClick={() => void removeCategory(c)}
                          title="Excluir categoria"
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{c}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{`${count} ${count === 1 ? 'piloto' : 'pilotos'}`}</Typography>}
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* GERENCIADOR DE ESPECIAIS / TRILHAS DE ENDURO */}
      <Card>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouteRoundedIcon color="secondary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Especiais da Prova ({stages.length})
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setShowStageManager(!showStageManager)}
              endIcon={showStageManager ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              sx={{ borderRadius: 2, fontSize: '0.8rem' }}
            >
              {showStageManager ? 'Fechar' : 'Gerenciar'}
            </Button>
          </Box>

          <Collapse in={showStageManager}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <form onSubmit={(e) => void submitStage(e)}>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Nova Especial (ex: E4 · Linha do Trem)"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    size="small"
                    sx={{ px: 2.5, whiteSpace: 'nowrap' }}
                  >
                    Adicionar
                  </Button>
                </Box>
              </form>

              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {stages.map((st) => {
                  const runsCount = state.runs.filter((r) => r.stageId === st.id && r.status === 'done').length
                  return (
                    <ListItem
                      key={st.id}
                      sx={{
                        py: 1.2,
                        pl: 2.5,
                        pr: 11,
                        bgcolor: 'background.default',
                        borderRadius: 2.5,
                        mb: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            edge="end"
                            color="secondary"
                            size="small"
                            onClick={() => setEditingStage({ id: st.id, name: st.name })}
                            title="Editar nome da especial"
                            sx={{ bgcolor: 'rgba(34, 197, 94, 0.08)' }}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            edge="end"
                            color="error"
                            size="small"
                            onClick={() => void removeStage(st.id, st.name)}
                            title="Excluir especial"
                            sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)' }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            bgcolor: 'rgba(34, 197, 94, 0.15)',
                            color: 'secondary.main',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                          }}
                        >
                          {st.order}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{ my: 0, ml: 1 }}
                        primary={<Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{st.name}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {`${runsCount} ${runsCount === 1 ? 'descida concluída' : 'descidas concluídas'}`}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* FORMULÁRIO DE CADASTRO DE PILOTO */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddRoundedIcon color="primary" /> Novo Atleta
          </Typography>

          <form onSubmit={(e) => void submitRider(e)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="Nº"
                  value={num}
                  onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
                  placeholder="104"
                  slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                  sx={{ width: { xs: 90, sm: 110 } }}
                  required
                />
                <TextField
                  label="Nome Completo"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 35))}
                  placeholder="Ex: Lucas Silva"
                  helperText={`${name.length}/35`}
                  slotProps={{
                    formHelperText: {
                      sx: {
                        color: name.length >= 35 ? 'warning.main' : 'text.secondary',
                        textAlign: 'right',
                      },
                    },
                  }}
                  fullWidth
                  required
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel id="new-cat-label">Categoria</InputLabel>
                <Select
                  labelId="new-cat-label"
                  value={activeCat}
                  label="Categoria"
                  onChange={(e) => setCat(e.target.value)}
                >
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, fontWeight: 800, fontSize: '1rem', mt: 0.5 }}
              >
                Cadastrar Atleta
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* LISTA DE ATLETAS CADASTRADOS */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.08em' }}>
          Atletas Cadastrados ({riders.length})
        </Typography>

        <List disablePadding sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {riders.length === 0 && (
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhum atleta cadastrado ainda
              </Typography>
            </Card>
          )}

          {riders.map((r) => (
            <Card key={r.num} sx={{ bgcolor: 'background.paper' }}>
              <ListItem
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      edge="end"
                      color="primary"
                      size="small"
                      onClick={() => startEdit(r)}
                      title="Editar atleta"
                      sx={{ bgcolor: 'rgba(56, 189, 248, 0.08)' }}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      color="error"
                      size="small"
                      onClick={() => setDeletingRider(r)}
                      title="Remover atleta"
                      sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)' }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', color: 'primary.main', fontWeight: 800 }}>
                    #{r.num}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography variant="body1" sx={{ fontWeight: 700 }}>{r.name}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary">{r.cat}</Typography>}
                />
              </ListItem>
            </Card>
          ))}
        </List>
      </Box>

      {/* ZONA DE DADOS E DEMO */}
      <Box sx={{ display: 'flex', gap: 1.5, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button
          variant="outlined"
          color="inherit"
          fullWidth
          onClick={() => void act(() => api.loadDemo(), 'Dados de exemplo carregados')}
          sx={{ py: 1.2, fontSize: '0.88rem' }}
        >
          Carregar dados de exemplo
        </Button>
        <Button
          variant="outlined"
          color="error"
          fullWidth
          onClick={() => { if (confirm('Apagar todos os pilotos e tempos?')) void act(() => api.reset()) }}
          sx={{ py: 1.2, fontSize: '0.88rem' }}
        >
          Apagar tudo
        </Button>
      </Box>
    </Box>
  )
}
