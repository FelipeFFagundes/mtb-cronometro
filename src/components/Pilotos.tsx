import { useState, useEffect, Fragment, type FormEvent } from 'react'
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
  Checkbox,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded'
import type { StartGridItem } from '../types'
export type { StartGridItem } from '../types'

interface Props {
  state: AppState
  act: Act
}

export const STORAGE_GRID_KEY = 'mtb_start_grid'

export function Pilotos({ state, act }: Props) {
  const stages = state.stages && state.stages.length > 0 ? state.stages : []

  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)

  // Gerenciador de Especiais / Trilhas
  const [newStageName, setNewStageName] = useState('')
  const [showStageManager, setShowStageManager] = useState(false)
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null)

  // Grade de Ordem de Largada
  const [showGridManager, setShowGridManager] = useState(false)
  const [gridStageId, setGridStageId] = useState<string>(() => stages[0]?.id || 'stage-1')
  const [tableStageFilter, setTableStageFilter] = useState<string>('all')
  const [gridStartTime, setGridStartTime] = useState('09:00')
  const [gridIntervalMinutes, setGridIntervalMinutes] = useState(1)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [gridItems, setGridItems] = useState<StartGridItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GRID_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sincroniza gridStageId caso a especial deixe de existir
  useEffect(() => {
    if (stages.length > 0 && !stages.some((s) => s.id === gridStageId)) {
      setGridStageId(stages[0].id)
    }
  }, [stages, gridStageId])

  // Manter categoryOrder e selectedCategories sincronizados com as categorias do estado
  useEffect(() => {
    const cats = state.categories && state.categories.length > 0 ? state.categories : ['Geral']
    setCategoryOrder((prev) => {
      const existing = prev.filter((c) => cats.includes(c))
      const added = cats.filter((c) => !existing.includes(c))
      return [...existing, ...added]
    })
    setSelectedCategories((prev) => {
      if (prev.length === 0) return [...cats]
      return prev.filter((c) => cats.includes(c))
    })
  }, [state.categories])

  const toggleCategorySelection = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    )
  }

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    setCategoryOrder((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  const saveGrid = (items: StartGridItem[]) => {
    setGridItems(items)
    try {
      if (items.length === 0) {
        localStorage.removeItem(STORAGE_GRID_KEY)
      } else {
        localStorage.setItem(STORAGE_GRID_KEY, JSON.stringify(items))
      }
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new CustomEvent('mtb_grid_updated', { detail: items }))
    } catch (e) {
      console.error('Falha ao salvar grade de largada:', e)
    }
  }

  // Horários das categorias por especial (ex: { 'stage-1': { 'Elite': '08:30' }, 'stage-2': { 'Elite': '10:00' } })
  const [categoryStartTimesByStage, setCategoryStartTimesByStage] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('mtb_category_start_times_by_stage')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const [categoryStartTimes, setCategoryStartTimes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('mtb_category_start_times')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Obtém o horário de largada de uma categoria para uma especial específica
  const getCategoryStartTime = (catName: string, stId: string = gridStageId): string => {
    if (categoryStartTimesByStage[stId]?.[catName]) {
      return categoryStartTimesByStage[stId][catName]
    }
    if (categoryStartTimes[catName]) {
      return categoryStartTimes[catName]
    }
    return gridStartTime || '09:00'
  }

  // Atualiza horário da categoria para a especial selecionada
  const updateCategoryStartTime = (catName: string, timeStr: string, stId: string = gridStageId) => {
    setCategoryStartTimesByStage((prev) => {
      const stageMap = prev[stId] || {}
      const next = { ...prev, [stId]: { ...stageMap, [catName]: timeStr } }
      try {
        localStorage.setItem('mtb_category_start_times_by_stage', JSON.stringify(next))
      } catch {
        /* noop */
      }
      return next
    })
    setCategoryStartTimes((prev) => {
      const next = { ...prev, [catName]: timeStr }
      try {
        localStorage.setItem('mtb_category_start_times', JSON.stringify(next))
      } catch {
        /* noop */
      }
      return next
    })
  }

  // Gera os horários com base no horário de início de cada categoria para a especial informada
  const buildItemsForCategory = (catName: string, riders: Rider[], stId: string = gridStageId): StartGridItem[] => {
    const timeStr = getCategoryStartTime(catName, stId)
    const [hh, mm] = timeStr.split(':').map(Number)
    const baseDate = new Date()
    baseDate.setHours(isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm, 0, 0)
    const baseEpoch = baseDate.getTime()
    const intervalMs = Math.round(gridIntervalMinutes * 60 * 1000)

    return riders.map((r, index) => {
      const timeMs = baseEpoch + index * intervalMs
      const date = new Date(timeMs)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return {
        num: r.num,
        riderName: r.name,
        category: r.cat,
        scheduledTimeStr: `${hours}:${minutes}:${seconds}`,
        scheduledEpoch: timeMs,
        stageId: stId,
      }
    })
  }

  // Gerar ou atualizar grade com as categorias selecionadas para a especial ativa
  const handleGenerateGrid = () => {
    if (state.riders.length === 0) {
      return act(async () => { throw new Error('Cadastre pilotos antes de gerar a grade de largada') })
    }

    if (selectedCategories.length === 0) {
      return act(async () => { throw new Error('Selecione pelo menos uma categoria para incluir na grade') })
    }

    const currentStageObj = stages.find((s) => s.id === gridStageId) || stages[0]

    // Pilotos das categorias selecionadas
    const eligibleRiders = state.riders.filter((r) =>
      selectedCategories.includes(r.cat || 'Sem Categoria')
    )

    if (eligibleRiders.length === 0) {
      return act(async () => { throw new Error('Nenhum piloto encontrado nas categorias selecionadas') })
    }

    // 1. Manter intactos todos os itens de OUTRAS especiais
    const otherStageItems = gridItems.filter(
      (item) => item.stageId && item.stageId !== gridStageId
    )

    // 2. Na especial atual, manter os itens já gerados das categorias NÃO selecionadas
    const currentStageUnselected = gridItems.filter(
      (item) =>
        (!item.stageId || item.stageId === gridStageId) &&
        !selectedCategories.includes(item.category || 'Sem Categoria')
    )

    // 3. Para cada categoria selecionada, embaralhar os pilotos e calcular horários para a especial ativa
    const newlyGeneratedItems: StartGridItem[] = []

    categoryOrder.forEach((c) => {
      if (selectedCategories.includes(c)) {
        const catRiders = eligibleRiders.filter((r) => (r.cat || 'Sem Categoria') === c)
        if (catRiders.length > 0) {
          const shuffled = [...catRiders].sort(() => Math.random() - 0.5)
          const itemsForCat = buildItemsForCategory(c, shuffled, gridStageId)
          newlyGeneratedItems.push(...itemsForCat)
        }
      }
    })

    // 4. Mesclar mantendo a ordem das categorias definida em categoryOrder
    const mergedCurrentStageItems: StartGridItem[] = []
    const allCurrentStageItems = [...currentStageUnselected, ...newlyGeneratedItems]

    categoryOrder.forEach((c) => {
      const catItems = allCurrentStageItems.filter((i) => i.category === c)
      mergedCurrentStageItems.push(...catItems)
    })

    allCurrentStageItems.forEach((item) => {
      if (!categoryOrder.includes(item.category) && !mergedCurrentStageItems.some((m) => m.num === item.num)) {
        mergedCurrentStageItems.push(item)
      }
    })

    const finalGrid = [...otherStageItems, ...mergedCurrentStageItems]
    saveGrid(finalGrid)
    void act(async () => {}, `Grade gerada para a especial ${currentStageObj?.name ?? ''}!`)
  }

  // Sortear apenas UMA categoria para a especial selecionada (mantém intactas todas as outras categorias e especiais)
  const handleShuffleSingleCategory = (targetCat: string) => {
    const categoryRiders = state.riders.filter((r) => (r.cat || 'Sem Categoria') === targetCat)
    if (categoryRiders.length === 0) {
      return act(async () => { throw new Error(`Nenhum piloto cadastrado na categoria "${targetCat}"`) })
    }

    const currentStageObj = stages.find((s) => s.id === gridStageId) || stages[0]

    // Embaralha aleatoriamente os pilotos dessa categoria
    const shuffledCategoryRiders = [...categoryRiders].sort(() => Math.random() - 0.5)

    // Calcula os horários dos pilotos dessa categoria para a especial atual
    const newCatItems = buildItemsForCategory(targetCat, shuffledCategoryRiders, gridStageId)

    // Preserva intactos todos os itens de OUTRAS especiais
    const otherStageItems = gridItems.filter(
      (item) => item.stageId && item.stageId !== gridStageId
    )

    // Na especial atual, preserva as outras categorias
    const currentStageOtherItems = gridItems.filter(
      (item) =>
        (!item.stageId || item.stageId === gridStageId) &&
        (item.category || 'Sem Categoria') !== targetCat
    )

    // Remonta a grade da especial atual na ordem de categorias definida
    const mergedCurrentStageItems: StartGridItem[] = []
    const allCurrentStageItems = [...currentStageOtherItems, ...newCatItems]

    categoryOrder.forEach((c) => {
      const catItems = allCurrentStageItems.filter((i) => i.category === c)
      mergedCurrentStageItems.push(...catItems)
    })

    allCurrentStageItems.forEach((item) => {
      if (!categoryOrder.includes(item.category) && !mergedCurrentStageItems.some((m) => m.num === item.num)) {
        mergedCurrentStageItems.push(item)
      }
    })

    saveGrid([...otherStageItems, ...mergedCurrentStageItems])

    // Garante que a categoria fique marcada como selecionada
    if (!selectedCategories.includes(targetCat)) {
      setSelectedCategories((prev) => [...prev, targetCat])
    }

    void act(async () => {}, `Categoria "${targetCat}" sorteada para a especial ${currentStageObj?.name ?? ''}!`)
  }

  const handleClearCurrentStageGrid = () => {
    const defaultStageId = stages[0]?.id
    const otherStageItems = gridItems.filter(
      (item) => (item.stageId || defaultStageId) !== gridStageId
    )
    saveGrid(otherStageItems)
    const currentStageObj = stages.find((s) => s.id === gridStageId) || stages[0]
    void act(async () => {}, `Grade da especial ${currentStageObj?.name ?? ''} foi limpa!`)
  }

  const handleClearGrid = () => {
    saveGrid([])
    void act(async () => {}, 'Todas as grades de largada foram limpas!')
  }

  // Estado para piloto em edição (modal)
  const [editingRider, setEditingRider] = useState<{ originalNum: string; num: string; name: string; cat: string } | null>(null)
  // Estado para edição de categoria
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; name: string } | null>(null)
  // Estado para confirmação de remoção de piloto, categoria e especial
  const [deletingRider, setDeletingRider] = useState<Rider | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; ridersCount: number } | null>(null)
  const [deletingStage, setDeletingStage] = useState<{ id: string; name: string; runsCount: number } | null>(null)

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

  const executeRemoveCategory = async () => {
    if (!deletingCategory) return
    const name = deletingCategory.name
    setDeletingCategory(null)
    await act(
      () => api.removeCategory(name),
      `Categoria "${name}" removida. Atletas vinculados agora estão "Sem Categoria".`
    )
  }

  const saveEditCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return
    const oldName = editingCategory.oldName
    const newName = editingCategory.name.trim()
    if (!newName) {
      return act(async () => { throw new Error('O nome da categoria não pode ser vazio') })
    }
    if (oldName === newName) {
      setEditingCategory(null)
      return
    }

    const ok = await act(
      () => api.updateCategory(oldName, newName),
      `Categoria renomeada para "${newName}"!`
    )
    if (ok) {
      setCategoryOrder((prev) => prev.map((c) => (c === oldName ? newName : c)))
      setSelectedCategories((prev) => prev.map((c) => (c === oldName ? newName : c)))
      if (cat === oldName) setCat(newName)
      setCategoryStartTimes((prev) => {
        if (prev[oldName]) {
          const next = { ...prev, [newName]: prev[oldName] }
          delete next[oldName]
          try {
            localStorage.setItem('mtb_category_start_times', JSON.stringify(next))
          } catch {}
          return next
        }
        return prev
      })
      setEditingCategory(null)
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

  const executeRemoveStage = async () => {
    if (!deletingStage) return
    const stage = deletingStage
    setDeletingStage(null)
    await act(
      () => api.removeStage(stage.id),
      `Especial "${stage.name}" e todas as suas descidas foram excluídas com sucesso.`
    )
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
          <PeopleAltRoundedIcon color="primary" /> Atletas & Categorias
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

      {/* MODAL DE EDIÇÃO DE CATEGORIA */}
      <Dialog
        open={Boolean(editingCategory)}
        onClose={() => setEditingCategory(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        {editingCategory && (
          <form onSubmit={(e) => void saveEditCategory(e)}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              Editar Nome da Categoria
            </DialogTitle>

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
              <TextField
                label="Nome da Categoria"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                placeholder="Ex: Elite Masculino"
                fullWidth
                required
                autoFocus
              />
              {state.riders.filter((r) => r.cat === editingCategory.oldName).length > 0 && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {state.riders.filter((r) => r.cat === editingCategory.oldName).length} atleta(s) vinculados a esta categoria serão atualizados automaticamente.
                </Alert>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setEditingCategory(null)}
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
                Salvar Nome
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
            <DialogTitle component="div" sx={{ pb: 1 }}>
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

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CATEGORIA */}
      <Dialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              textAlign: 'center',
              borderColor: 'warning.main',
            },
          },
        }}
      >
        {deletingCategory && (
          <>
            <DialogTitle component="div" sx={{ pb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'rgba(245, 158, 11, 0.15)',
                  color: 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h5" color="warning.main" sx={{ fontWeight: 800 }}>
                Excluir Categoria?
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
              <Typography variant="body1">
                Tem certeza que deseja excluir a categoria <strong>"{deletingCategory.name}"</strong>?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>
                {deletingCategory.ridersCount > 0 ? (
                  <>
                    Existem <strong>{deletingCategory.ridersCount} atleta(s)</strong> vinculados a esta categoria. Eles passarão para o status <strong>"Sem Categoria"</strong> e não poderão largar até serem reclassificados.
                  </>
                ) : (
                  'Nenhum atleta vinculado a esta categoria atualmente.'
                )}
              </Alert>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setDeletingCategory(null)}
                sx={{ py: 1.2 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => void executeRemoveCategory()}
                sx={{ py: 1.2, fontWeight: 800 }}
              >
                SIM, EXCLUIR
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ESPECIAL */}
      <Dialog
        open={Boolean(deletingStage)}
        onClose={() => setDeletingStage(null)}
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
        {deletingStage && (
          <>
            <DialogTitle component="div" sx={{ pb: 1 }}>
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
                Excluir Especial?
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ py: 1 }}>
              <Typography variant="body1">
                Tem certeza que deseja excluir <strong>"{deletingStage.name}"</strong>?
              </Typography>
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>
                <strong>Atenção:</strong> A especial será excluída permanentemente junto com{' '}
                <strong>{deletingStage.runsCount} descida(s) gravada(s)</strong>. Todos os tempos correspondentes dos atletas serão perdidos.
              </Alert>
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setDeletingStage(null)}
                sx={{ py: 1.2 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => void executeRemoveStage()}
                sx={{ py: 1.2, fontWeight: 800 }}
              >
                SIM, EXCLUIR TUDO
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
                            color="primary"
                            size="small"
                            onClick={() => setEditingCategory({ oldName: c, name: c })}
                            title="Editar nome da categoria"
                            sx={{ bgcolor: 'rgba(56, 189, 248, 0.08)' }}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            edge="end"
                            color="error"
                            size="small"
                            onClick={() => setDeletingCategory({ name: c, ridersCount: count })}
                            title="Excluir categoria"
                            sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)' }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>
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
                            onClick={() => setDeletingStage({ id: st.id, name: st.name, runsCount })}
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

      {/* GRADE DE ORDEM DE LARGADA */}
      <Card>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormatListNumberedRoundedIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Grade de Largada {gridItems.length > 0 ? `(${gridItems.length})` : ''}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setShowGridManager(!showGridManager)}
              endIcon={showGridManager ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              sx={{ borderRadius: 2, fontSize: '0.8rem' }}
            >
              {showGridManager ? 'Fechar' : 'Gerenciar'}
            </Button>
          </Box>

          <Collapse in={showGridManager}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {/* SELETOR DE ESPECIAL PARA A GRADE */}
              {stages.length > 0 && (
                <Box sx={{ mb: 2, p: 1.2, bgcolor: 'rgba(56, 189, 248, 0.05)', borderRadius: 2, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'primary.main', display: 'block', mb: 0.8 }}>
                    Especial da Grade:
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {stages.map((st) => {
                      const stageCount = gridItems.filter((i) => (i.stageId || stages[0]?.id) === st.id).length
                      const isSelected = gridStageId === st.id
                      return (
                        <Chip
                          key={st.id}
                          label={`${st.name}${stageCount > 0 ? ` (${stageCount})` : ''}`}
                          onClick={() => {
                            setGridStageId(st.id)
                            setTableStageFilter(st.id)
                          }}
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      )
                    })}
                  </Box>
                </Box>
              )}

              {/* CONFIGURAÇÃO DA GRADE */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                {/* HORÁRIO BASE PADRÃO */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    Horário Base
                  </Typography>
                  <TextField
                    type="time"
                    fullWidth
                    size="small"
                    value={gridStartTime}
                    onChange={(e) => setGridStartTime(e.target.value)}
                    slotProps={{
                      htmlInput: { step: 300 },
                    }}
                  />
                </Box>

                {/* INTERVALO */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    Intervalo (minutos)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 0.8, flexWrap: 'wrap' }}>
                    {[0.5, 1, 2, 3].map((val) => (
                      <Chip
                        key={val}
                        label={val === 0.5 ? '30s' : `${val}m`}
                        size="small"
                        onClick={() => setGridIntervalMinutes(val)}
                        color={gridIntervalMinutes === val ? 'primary' : 'default'}
                        variant={gridIntervalMinutes === val ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                      />
                    ))}
                  </Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    value={gridIntervalMinutes}
                    onChange={(e) => setGridIntervalMinutes(Math.max(0.1, Number(e.target.value)))}
                    slotProps={{
                      htmlInput: { min: 0.1, step: 0.5 },
                    }}
                  />
                </Box>

                {/* SELEÇÃO E ORDEM DAS CATEGORIAS */}
                <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Categorias & Horários:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setSelectedCategories([...categoryOrder])}
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 0.8 }}
                      >
                        Todas
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="inherit"
                        onClick={() => setSelectedCategories([])}
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 0.8 }}
                      >
                        Nenhuma
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {categoryOrder.map((c, idx) => {
                      const isSelected = selectedCategories.includes(c)
                      const count = state.riders.filter((r) => (r.cat || 'Sem Categoria') === c).length
                      const inStageGridCount = gridItems.filter(
                        (i) => i.category === c && (i.stageId || stages[0]?.id) === gridStageId
                      ).length

                      return (
                        <Box
                          key={c}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 0.8,
                            px: 1.5,
                            borderRadius: 2,
                            bgcolor: isSelected ? 'rgba(56, 189, 248, 0.04)' : 'background.default',
                            border: isSelected ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                            opacity: isSelected ? 1 : 0.6,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => toggleCategorySelection(c)}
                              sx={{ p: 0.5 }}
                            />
                            <Chip
                              label={`${idx + 1}º`}
                              size="small"
                              color={isSelected ? 'primary' : 'default'}
                              sx={{ fontWeight: 800, height: 20, fontSize: '0.7rem' }}
                            />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {c}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {count} {count === 1 ? 'piloto' : 'pilotos'}
                                {inStageGridCount > 0 && ` (${inStageGridCount} na grade)`}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, mt: { xs: 0.5, sm: 0 }, width: { xs: '100%', sm: 'auto' } }}>
                            {/* HORÁRIO DE LARGADA */}
                            <Tooltip title={`Horário da categoria ${c}`}>
                              <TextField
                                type="time"
                                size="small"
                                label="Início"
                                value={getCategoryStartTime(c, gridStageId)}
                                onChange={(e) => updateCategoryStartTime(c, e.target.value, gridStageId)}
                                slotProps={{
                                  inputLabel: { shrink: true, sx: { fontSize: '0.72rem' } },
                                  htmlInput: {
                                    step: 300,
                                    style: { padding: '4px 6px', fontSize: '0.8rem', width: '75px' },
                                  },
                                }}
                                sx={{
                                  bgcolor: 'background.paper',
                                  borderRadius: 1.5,
                                  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                                }}
                              />
                            </Tooltip>

                            {/* BOTÃO PARA SORTEAR */}
                            <Tooltip title={`Sortear categoria ${c}`}>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  disabled={count === 0}
                                  onClick={() => handleShuffleSingleCategory(c)}
                                  startIcon={<ShuffleRoundedIcon sx={{ fontSize: 14 }} />}
                                  sx={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    py: 0.4,
                                    px: 0.8,
                                    borderRadius: 1.5,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Sortear
                                </Button>
                              </span>
                            </Tooltip>

                            <Box sx={{ display: 'flex', gap: 0.3 }}>
                              <IconButton
                                size="small"
                                disabled={idx === 0}
                                onClick={() => moveCategory(idx, 'up')}
                                title="Mover para cima"
                                sx={{ p: 0.5, bgcolor: 'rgba(255, 255, 255, 0.04)' }}
                              >
                                <ArrowUpwardRoundedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={idx === categoryOrder.length - 1}
                                onClick={() => moveCategory(idx, 'down')}
                                title="Mover para baixo"
                                sx={{ p: 0.5, bgcolor: 'rgba(255, 255, 255, 0.04)' }}
                              >
                                <ArrowDownwardRoundedIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              </Box>

              {/* BOTÕES DE AÇÃO */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleGenerateGrid}
                  startIcon={<TuneRoundedIcon />}
                  sx={{ fontWeight: 800 }}
                >
                  {gridItems.some((i) => (i.stageId || stages[0]?.id) === gridStageId)
                    ? 'Regerar Grade'
                    : 'Gerar Grade'}
                </Button>

                {gridItems.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {gridItems.some((i) => (i.stageId || stages[0]?.id) === gridStageId) && (
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={handleClearCurrentStageGrid}
                        startIcon={<DeleteOutlineRoundedIcon />}
                        sx={{ fontWeight: 700 }}
                      >
                        Limpar Especial
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleClearGrid}
                      startIcon={<DeleteOutlineRoundedIcon />}
                      sx={{ fontWeight: 700 }}
                    >
                      Limpar Tudo
                    </Button>
                  </Box>
                )}
              </Box>

              {/* TABELA COM A GRADE GERADA (RESPONSIVA, SEM SCROLL LATERAL) */}
              {gridItems.length > 0 && (() => {
                const filteredItems = tableStageFilter === 'all'
                  ? gridItems
                  : gridItems.filter((i) => (i.stageId || stages[0]?.id) === tableStageFilter)

                return (
                  <Box sx={{ mt: 1 }}>
                    {/* FILTRO DE VISUALIZAÇÃO POR ESPECIAL */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
                        Filtrar Especial:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={`Todas (${gridItems.length})`}
                          onClick={() => setTableStageFilter('all')}
                          color={tableStageFilter === 'all' ? 'primary' : 'default'}
                          variant={tableStageFilter === 'all' ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                        />
                        {stages.map((st) => {
                          const count = gridItems.filter((i) => (i.stageId || stages[0]?.id) === st.id).length
                          return (
                            <Chip
                              key={st.id}
                              size="small"
                              label={`${st.name} (${count})`}
                              onClick={() => setTableStageFilter(st.id)}
                              color={tableStageFilter === st.id ? 'primary' : 'default'}
                              variant={tableStageFilter === st.id ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                            />
                          )
                        })}
                      </Box>
                    </Box>

                    {filteredItems.length === 0 ? (
                      <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'background.default', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum piloto na grade para esta especial.
                        </Typography>
                      </Box>
                    ) : (
                      <TableContainer component={Paper} sx={{ bgcolor: 'background.default', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.06)', overflowX: 'hidden' }}>
                        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.04)' }}>
                              <TableCell sx={{ fontWeight: 800, width: { xs: 52, sm: 64 }, pl: 1.5, pr: 0.5, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>POS</TableCell>
                              <TableCell sx={{ fontWeight: 800, pl: 1.5, pr: 1, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>PILOTO</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, width: { xs: 80, sm: 95 }, pr: 1.5, pl: 1, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>HORÁRIO</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {filteredItems.map((item, idx) => {
                              const prev = filteredItems[idx - 1]
                              const itemStage = stages.find((s) => s.id === (item.stageId || stages[0]?.id))
                              const isFirstOfGroup =
                                idx === 0 ||
                                prev.category !== item.category ||
                                (tableStageFilter === 'all' && (prev.stageId || stages[0]?.id) !== (item.stageId || stages[0]?.id))

                              return (
                                <Fragment key={`${item.stageId || 'default'}-${item.num}-${idx}`}>
                                  {isFirstOfGroup && (
                                    <TableRow sx={{ bgcolor: 'rgba(56, 189, 248, 0.08)' }}>
                                      <TableCell
                                        colSpan={3}
                                        sx={{
                                          py: 0.8,
                                          px: 1.5,
                                          fontWeight: 900,
                                          fontSize: '0.78rem',
                                          letterSpacing: '0.04em',
                                          color: 'primary.main',
                                          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                                        }}
                                      >
                                        {tableStageFilter === 'all' && stages.length > 1
                                          ? `${itemStage?.name || 'Especial'} · ${item.category.toUpperCase()}`
                                          : item.category.toUpperCase()}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 1.5, pr: 0.5, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                                      {idx + 1}º
                                    </TableCell>
                                    <TableCell sx={{ pl: 1.5, pr: 1 }}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                            {item.riderName}
                                          </Typography>
                                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                            #{item.num}
                                          </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ color: 'primary.light', fontSize: '0.68rem', display: { xs: 'block', sm: 'none' } }}>
                                          {item.category}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.light', pr: 1.5, pl: 1, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                                      {item.scheduledTimeStr}
                                    </TableCell>
                                  </TableRow>
                                </Fragment>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )
              })()}
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
                  secondary={
                    !r.cat || r.cat === 'Sem Categoria' ? (
                      <Chip
                        label="Sem Categoria"
                        size="small"
                        color="error"
                        variant="filled"
                        sx={{ fontSize: '0.68rem', height: 18, mt: 0.5, fontWeight: 700 }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">{r.cat}</Typography>
                    )
                  }
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
