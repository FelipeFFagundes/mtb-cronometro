import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { api } from '../data'
import type { Act } from '../App'
import type { AppState, Rider, StartGridItem } from '../types'
export type { StartGridItem } from '../types'
import { BOTTOMNAV_H, tokens } from '../theme'
import { BottomSheet, ChipSelect, ConfirmDialog, CountCards, EmptyState, FilterBar, ListCard, PageHeader, RiderPlate, Section } from './ui'
import { StartGridList } from './StartGridList'
import { ImportCsv } from './ImportCsv'
import { MarshalAccess } from './MarshalAccess'
import { AthleteHistory, AthleteNameField } from './AthleteFields'
import { athleteKey } from '../lib/athletes'
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Checkbox,
  Chip,
  Fab,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'

interface Props {
  state: AppState
  act: Act
}

type SubTab = 'atletas' | 'categorias' | 'especiais' | 'grade' | 'acesso'

/** Cartões de contagem da aba Atletas. */
type RiderFilter = 'todos' | 'largaram' | 'faltam' | 'semcat'

const noCategory = (cat: string) => !cat || cat === 'Sem Categoria'

/** Linha "nome + ações" usada em categorias e especiais. */
function ManageRow({
  lead,
  title,
  subtitle,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  lead?: ReactNode
  title: string
  subtitle: string
  onEdit: () => void
  onDelete: () => void
  editLabel: string
  deleteLabel: string
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, pr: 1, py: 1, minHeight: 60 }}>
      {lead}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <IconButton aria-label={editLabel} onClick={onEdit} sx={{ color: 'text.secondary' }}>
        <EditRoundedIcon />
      </IconButton>
      <IconButton aria-label={deleteLabel} onClick={onDelete} sx={{ color: 'error.main' }}>
        <DeleteOutlineRoundedIcon />
      </IconButton>
    </Box>
  )
}

export function Pilotos({ state, act }: Props) {
  const stages = state.stages && state.stages.length > 0 ? state.stages : []
  const [tab, setTab] = useState<SubTab>('atletas')

  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [newCat, setNewCat] = useState('')
  const [search, setSearch] = useState('')
  const [riderFilter, setRiderFilter] = useState<RiderFilter>('todos')
  const [addOpen, setAddOpen] = useState(false)
  const numInputRef = useRef<HTMLInputElement>(null)

  // Gerenciador de Especiais
  const [newStageName, setNewStageName] = useState('')
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null)

  // Grade de Ordem de Largada
  const [gridStageId, setGridStageId] = useState<string>(() => stages[0]?.id || 'stage-1')
  const [gridStartTime, setGridStartTime] = useState('09:00')
  const [gridIntervalMinutes, setGridIntervalMinutes] = useState(1)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const gridItems = state.grid
  const [confirmClear, setConfirmClear] = useState<'stage' | 'all' | null>(null)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Se a especial da grade deixar de existir, usa a primeira
  const activeGridStageId = stages.some((s) => s.id === gridStageId) ? gridStageId : stages[0]?.id || 'stage-1'

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
    setSelectedCategories((prev) => (prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]))
  }

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    setCategoryOrder((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  // Horários das categorias por especial (ex: { 'stage-1': { 'Elite': '08:30' } })
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

  const getCategoryStartTime = (catName: string, stId: string = activeGridStageId): string => {
    if (categoryStartTimesByStage[stId]?.[catName]) return categoryStartTimesByStage[stId][catName]
    if (categoryStartTimes[catName]) return categoryStartTimes[catName]
    return gridStartTime || '09:00'
  }

  const updateCategoryStartTime = (catName: string, timeStr: string, stId: string = activeGridStageId) => {
    setCategoryStartTimesByStage((prev) => {
      const next = { ...prev, [stId]: { ...(prev[stId] || {}), [catName]: timeStr } }
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

  // Gera os horários com base no horário de início da categoria na especial informada
  const buildItemsForCategory = (catName: string, riders: Rider[], stId: string = activeGridStageId): StartGridItem[] => {
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

  /** Remonta a grade da especial ativa na ordem de categorias definida. */
  const mergeCurrentStage = (items: StartGridItem[]) => {
    const merged: StartGridItem[] = []
    categoryOrder.forEach((c) => merged.push(...items.filter((i) => i.category === c)))
    items.forEach((item) => {
      if (!categoryOrder.includes(item.category) && !merged.some((m) => m.num === item.num)) merged.push(item)
    })
    return merged
  }

  const currentStageObj = stages.find((s) => s.id === activeGridStageId) || stages[0]

  // Gerar ou atualizar grade com as categorias selecionadas para a especial ativa
  const handleGenerateGrid = () => {
    if (state.riders.length === 0) {
      return act(async () => {
        throw new Error('Cadastre pilotos antes de gerar a grade de largada')
      })
    }
    if (selectedCategories.length === 0) {
      return act(async () => {
        throw new Error('Selecione pelo menos uma categoria para incluir na grade')
      })
    }

    const eligibleRiders = state.riders.filter((r) => selectedCategories.includes(r.cat || 'Sem Categoria'))
    if (eligibleRiders.length === 0) {
      return act(async () => {
        throw new Error('Nenhum piloto encontrado nas categorias selecionadas')
      })
    }

    // Mantém intactas as categorias não selecionadas desta especial (as outras especiais não são tocadas)
    const currentStageUnselected = gridItems.filter(
      (item) =>
        (!item.stageId || item.stageId === activeGridStageId) && !selectedCategories.includes(item.category || 'Sem Categoria'),
    )

    // Sorteia os pilotos de cada categoria selecionada e calcula os horários
    const newlyGeneratedItems: StartGridItem[] = []
    categoryOrder.forEach((c) => {
      if (selectedCategories.includes(c)) {
        const catRiders = eligibleRiders.filter((r) => (r.cat || 'Sem Categoria') === c)
        if (catRiders.length > 0) {
          const shuffled = [...catRiders].sort(() => Math.random() - 0.5)
          newlyGeneratedItems.push(...buildItemsForCategory(c, shuffled, activeGridStageId))
        }
      }
    })

    void act(
      () => api.setStageGrid(activeGridStageId, mergeCurrentStage([...currentStageUnselected, ...newlyGeneratedItems])),
      `Grade gerada para a ${currentStageObj?.name ?? 'especial'}`,
    )
  }

  // Sorteia apenas UMA categoria na especial ativa
  const handleShuffleSingleCategory = (targetCat: string) => {
    const categoryRiders = state.riders.filter((r) => (r.cat || 'Sem Categoria') === targetCat)
    if (categoryRiders.length === 0) {
      return act(async () => {
        throw new Error(`Nenhum piloto cadastrado na categoria "${targetCat}"`)
      })
    }

    const shuffled = [...categoryRiders].sort(() => Math.random() - 0.5)
    const newCatItems = buildItemsForCategory(targetCat, shuffled, activeGridStageId)
    const currentStageOtherItems = gridItems.filter(
      (item) => (!item.stageId || item.stageId === activeGridStageId) && (item.category || 'Sem Categoria') !== targetCat,
    )

    if (!selectedCategories.includes(targetCat)) setSelectedCategories((prev) => [...prev, targetCat])
    void act(
      () => api.setStageGrid(activeGridStageId, mergeCurrentStage([...currentStageOtherItems, ...newCatItems])),
      `Categoria "${targetCat}" sorteada na ${currentStageObj?.name ?? 'especial'}`,
    )
  }

  const runClearGrid = () => {
    const kind = confirmClear
    setConfirmClear(null)
    if (kind === 'stage') {
      void act(() => api.setStageGrid(activeGridStageId, []), `Grade da ${currentStageObj?.name ?? 'especial'} foi limpa`)
    } else if (kind === 'all') {
      void act(() => api.clearAllGrids(), 'Todas as grades de largada foram limpas')
    }
  }

  const [editingRider, setEditingRider] = useState<{
    originalNum: string
    num: string
    name: string
    cat: string
    team: string
    athleteId?: string
  } | null>(null)
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; name: string } | null>(null)
  const [deletingRider, setDeletingRider] = useState<Rider | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; ridersCount: number } | null>(null)
  const [deletingStage, setDeletingStage] = useState<{ id: string; name: string; runsCount: number } | null>(null)

  const categories = state.categories && state.categories.length > 0 ? state.categories : ['Geral']
  const [cat, setCat] = useState<string>(categories[0] || 'Geral')
  const activeCat = categories.includes(cat) ? cat : categories[0]

  const submitRider = async (e: FormEvent) => {
    e.preventDefault()
    if (!num.trim()) return act(async () => { throw new Error('Informe o número do atleta') })
    if (!name.trim()) return act(async () => { throw new Error('Informe o nome do atleta') })

    const ok = await act(
      () => api.addRider({ num: num.trim(), name: name.trim(), cat: activeCat, team: team.trim() }),
      `Piloto #${num.trim()} cadastrado`,
    )
    if (ok) {
      // O painel continua aberto para cadastrar o próximo em sequência
      setNum('')
      setName('')
      setTeam('')
      numInputRef.current?.focus()
    }
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingRider) return
    const trimmedNum = editingRider.num.trim()
    const trimmedName = editingRider.name.trim()
    if (!trimmedNum) return act(async () => { throw new Error('O número do piloto é obrigatório') })
    if (!trimmedName) return act(async () => { throw new Error('O nome do piloto é obrigatório') })

    const ok = await act(
      () =>
        api.updateRider(editingRider.originalNum, {
          num: trimmedNum,
          name: trimmedName,
          cat: editingRider.cat,
          team: editingRider.team.trim(),
        }),
      `Piloto #${trimmedNum} atualizado`,
    )
    if (ok) setEditingRider(null)
  }

  const confirmRemoveRider = async () => {
    if (!deletingRider) return
    const target = deletingRider
    setDeletingRider(null)
    setEditingRider(null)
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
    const catName = deletingCategory.name
    setDeletingCategory(null)
    await act(() => api.removeCategory(catName), `Categoria "${catName}" removida. Os atletas dela ficaram sem categoria.`)
  }

  const saveEditCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return
    const oldName = editingCategory.oldName
    const newName = editingCategory.name.trim()
    if (!newName) return act(async () => { throw new Error('O nome da categoria não pode ser vazio') })
    if (oldName === newName) {
      setEditingCategory(null)
      return
    }

    const ok = await act(() => api.updateCategory(oldName, newName), `Categoria renomeada para "${newName}"`)
    if (ok) {
      setCategoryOrder((prev) => prev.map((c) => (c === oldName ? newName : c)))
      setSelectedCategories((prev) => prev.map((c) => (c === oldName ? newName : c)))
      if (cat === oldName) setCat(newName)
      setCategoryStartTimes((prev) => {
        if (!prev[oldName]) return prev
        const next = { ...prev, [newName]: prev[oldName] }
        delete next[oldName]
        try {
          localStorage.setItem('mtb_category_start_times', JSON.stringify(next))
        } catch {
          /* noop */
        }
        return next
      })
      setEditingCategory(null)
    }
  }

  const submitStage = async (e: FormEvent) => {
    e.preventDefault()
    if (!newStageName.trim()) return
    const ok = await act(() => api.addStage(newStageName.trim()), `Especial "${newStageName.trim()}" adicionada`)
    if (ok) setNewStageName('')
  }

  const executeRemoveStage = async () => {
    if (!deletingStage) return
    const stage = deletingStage
    setDeletingStage(null)
    await act(() => api.removeStage(stage.id), `Especial "${stage.name}" e suas descidas foram excluídas`)
  }

  const saveEditStage = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingStage) return
    const trimmed = editingStage.name.trim()
    if (!trimmed) return act(async () => { throw new Error('O nome da especial não pode ser vazio') })
    const ok = await act(() => api.updateStage(editingStage.id, trimmed), `Especial renomeada para "${trimmed}"`)
    if (ok) setEditingStage(null)
  }

  const riders = state.riders.slice().sort((a, b) => Number(a.num) - Number(b.num))
  // Cartões de contagem: quem já largou em alguma especial e quem está sem categoria
  const startedNums = new Set(state.runs.map((r) => r.num))
  const riderGroups: Record<RiderFilter, Rider[]> = {
    todos: riders,
    largaram: riders.filter((r) => startedNums.has(r.num)),
    faltam: riders.filter((r) => !startedNums.has(r.num)),
    semcat: riders.filter((r) => noCategory(r.cat)),
  }
  // Busca sem diferenciar acentos ("pescoco" acha "Sem pescoço"), também por equipe
  const q = athleteKey(search)
  const filteredRiders = riderGroups[riderFilter]
  const visibleRiders = q
    ? filteredRiders.filter(
        (r) =>
          r.num.startsWith(q) ||
          athleteKey(r.name).includes(q) ||
          athleteKey(r.cat).includes(q) ||
          athleteKey(r.team ?? '').includes(q),
      )
    : filteredRiders
  const withoutCategory = riderGroups.semcat.length

  const stageGrid = gridItems.filter((i) => (i.stageId || stages[0]?.id) === activeGridStageId)

  const categorySelect = (value: string, onChange: (v: string) => void) => (
    <TextField
      select
      label="Categoria"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      slotProps={{ select: { native: true } }}
    >
      {noCategory(value) && <option value={value}>Sem categoria</option>}
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </TextField>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader title="Prova" subtitle={`${state.event ? `${state.event.name} · ` : ''}${riders.length} atletas · ${categories.length} categorias · ${stages.length} especiais`} />

      <Tabs
        value={tab}
        onChange={(_, v: SubTab) => setTab(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          mx: -2,
          px: 2,
          borderBottom: `1px solid ${tokens.line}`,
          '& .MuiTab-root': { px: 1.5, minWidth: 0 },
        }}
      >
        <Tab value="atletas" label="Atletas" />
        <Tab value="categorias" label="Categorias" />
        <Tab value="especiais" label="Especiais" />
        <Tab value="grade" label="Grade" />
        {api.mode === 'supabase' && <Tab value="acesso" label="Acesso" />}
      </Tabs>

      {/* ============ ATLETAS ============ */}
      {tab === 'atletas' && (
        <>
          {riders.length > 0 && (
            <CountCards
              ariaLabel="Filtrar atletas"
              value={riderFilter}
              onChange={(v) => setRiderFilter(v as RiderFilter)}
              options={[
                { value: 'todos', label: 'Inscritos', count: riders.length },
                { value: 'largaram', label: 'Largaram', count: riderGroups.largaram.length },
                { value: 'faltam', label: 'Não largaram', count: riderGroups.faltam.length },
                { value: 'semcat', label: 'Sem categoria', count: withoutCategory, alert: true },
              ]}
            />
          )}
          {withoutCategory > 0 && riderFilter === 'semcat' && (
            <Typography variant="body2" color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberRoundedIcon fontSize="small" />
              Sem categoria não pode largar. Toque no atleta para definir.
            </Typography>
          )}
          <FilterBar
            placeholder="Buscar placa, nome ou equipe"
            value={search}
            onChange={setSearch}
            count={`${visibleRiders.length} ${visibleRiders.length === 1 ? 'atleta' : 'atletas'}`}
          />
          {riders.length === 0 ? (
            <EmptyState icon={<PeopleAltRoundedIcon />} title="Nenhum atleta" text="Toque em “Novo atleta” ou importe uma planilha." />
          ) : (
            <ListCard>
              {visibleRiders.length === 0 && (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  Nenhum atleta encontrado
                </Typography>
              )}
              {visibleRiders.map((r) => (
                <ButtonBase
                  key={r.num}
                  onClick={() =>
                    setEditingRider({ originalNum: r.num, num: r.num, name: r.name, cat: r.cat, team: r.team ?? '', athleteId: r.athleteId })
                  }
                  sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, pr: 1, py: 1, minHeight: 60, textAlign: 'left' }}
                >
                  <RiderPlate num={r.num} size="md" tone="muted" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>
                      {r.name}
                    </Typography>
                    <Typography variant="caption" noWrap color={noCategory(r.cat) ? 'error.main' : 'text.secondary'} sx={{ display: 'block', fontWeight: noCategory(r.cat) ? 800 : 400 }}>
                      {noCategory(r.cat) ? 'Sem categoria' : r.cat}
                      {r.team && ` · ${r.team}`}
                    </Typography>
                  </Box>
                  <ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />
                </ButtonBase>
              ))}
            </ListCard>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<UploadFileRoundedIcon />} onClick={() => setImportOpen(true)}>
              Importar planilha
            </Button>
            {/* Dados de teste: atletas de exemplo para preencher a prova e testar */}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ScienceRoundedIcon />}
              onClick={() => setConfirmDemo(true)}
              sx={{ borderStyle: 'dashed' }}
            >
              Atletas de exemplo
            </Button>
          </Box>
          <Box sx={{ height: 56 }} />
          <Fab
            variant="extended"
            color="primary"
            onClick={() => setAddOpen(true)}
            sx={{
              position: 'fixed',
              right: 16,
              bottom: `calc(${BOTTOMNAV_H + 16}px + env(safe-area-inset-bottom))`,
              fontWeight: 800,
              textTransform: 'none',
              gap: 1,
            }}
          >
            <PersonAddRoundedIcon /> Novo atleta
          </Fab>
        </>
      )}

      {/* ============ CATEGORIAS ============ */}
      {tab === 'categorias' && (
        <>
          <Box component="form" onSubmit={(e) => void submitCategory(e)} sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" placeholder="Nova categoria (ex.: Junior)" value={newCat} onChange={(e) => setNewCat(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" startIcon={<AddRoundedIcon />} sx={{ flexShrink: 0 }}>
              Adicionar
            </Button>
          </Box>
          <ListCard>
            {categories.map((c) => {
              const count = state.riders.filter((r) => r.cat === c).length
              return (
                <ManageRow
                  key={c}
                  title={c}
                  subtitle={`${count} ${count === 1 ? 'atleta' : 'atletas'}`}
                  onEdit={() => setEditingCategory({ oldName: c, name: c })}
                  onDelete={() => setDeletingCategory({ name: c, ridersCount: count })}
                  editLabel={`Renomear ${c}`}
                  deleteLabel={`Excluir ${c}`}
                />
              )
            })}
          </ListCard>
        </>
      )}

      {/* ============ ESPECIAIS ============ */}
      {tab === 'especiais' && (
        <>
          <Box component="form" onSubmit={(e) => void submitStage(e)} sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" placeholder="Nova especial (ex.: E4 · Linha do Trem)" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" startIcon={<AddRoundedIcon />} sx={{ flexShrink: 0 }}>
              Adicionar
            </Button>
          </Box>
          <ListCard>
            {stages.map((st) => {
              const runsCount = state.runs.filter((r) => r.stageId === st.id && r.status === 'done').length
              return (
                <ManageRow
                  key={st.id}
                  lead={<RiderPlate num={String(st.order)} size="sm" tone="start" />}
                  title={st.name}
                  subtitle={`${runsCount} ${runsCount === 1 ? 'descida concluída' : 'descidas concluídas'}`}
                  onEdit={() => setEditingStage({ id: st.id, name: st.name })}
                  onDelete={() => setDeletingStage({ id: st.id, name: st.name, runsCount })}
                  editLabel={`Renomear ${st.name}`}
                  deleteLabel={`Excluir ${st.name}`}
                />
              )
            })}
          </ListCard>
        </>
      )}

      {/* ============ GRADE DE LARGADA ============ */}
      {tab === 'grade' && (
        <>
          {stages.length > 1 && (
            <ChipSelect
              ariaLabel="Especial da grade"
              value={activeGridStageId}
              onChange={setGridStageId}
              options={stages.map((st) => ({
                value: st.id,
                label: st.name,
                count: gridItems.filter((i) => (i.stageId || stages[0]?.id) === st.id).length || undefined,
              }))}
            />
          )}

          <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                type="time"
                label="Horário base"
                value={gridStartTime}
                onChange={(e) => setGridStartTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
              />
              <TextField
                type="number"
                label="Intervalo (min)"
                value={gridIntervalMinutes}
                onChange={(e) => setGridIntervalMinutes(Math.max(0.1, Number(e.target.value)))}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0.1, step: 0.5, inputMode: 'decimal' } }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[0.5, 1, 2, 3].map((val) => (
                <Chip
                  key={val}
                  label={val === 0.5 ? '30 s' : `${val} min`}
                  onClick={() => setGridIntervalMinutes(val)}
                  color={gridIntervalMinutes === val ? 'primary' : 'default'}
                  variant={gridIntervalMinutes === val ? 'filled' : 'outlined'}
                  sx={{ flex: 1, height: 36 }}
                />
              ))}
            </Box>
          </Card>

          <Section
            title="Categorias e horários"
            action={
              <Box sx={{ display: 'flex' }}>
                <Button size="small" onClick={() => setSelectedCategories([...categoryOrder])} sx={{ minHeight: 32 }}>
                  Todas
                </Button>
                <Button size="small" color="inherit" onClick={() => setSelectedCategories([])} sx={{ minHeight: 32 }}>
                  Nenhuma
                </Button>
              </Box>
            }
          >
            <ListCard>
              {categoryOrder.map((c, idx) => {
                const isSelected = selectedCategories.includes(c)
                const count = state.riders.filter((r) => (r.cat || 'Sem Categoria') === c).length
                const inGrid = gridItems.filter((i) => i.category === c && (i.stageId || stages[0]?.id) === activeGridStageId).length
                return (
                  <Box key={c} sx={{ p: 1.5, opacity: isSelected ? 1 : 0.55, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Checkbox checked={isSelected} onChange={() => toggleCategorySelection(c)} slotProps={{ input: { 'aria-label': `Incluir ${c}` } }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 800 }}>
                          {idx + 1}º · {c}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {count} {count === 1 ? 'atleta' : 'atletas'}
                          {inGrid > 0 && ` · ${inGrid} na grade`}
                        </Typography>
                      </Box>
                      <IconButton aria-label={`Subir ${c}`} disabled={idx === 0} onClick={() => moveCategory(idx, 'up')}>
                        <ArrowUpwardRoundedIcon />
                      </IconButton>
                      <IconButton aria-label={`Descer ${c}`} disabled={idx === categoryOrder.length - 1} onClick={() => moveCategory(idx, 'down')}>
                        <ArrowDownwardRoundedIcon />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, pl: 5.5 }}>
                      <TextField
                        type="time"
                        size="small"
                        label="Início"
                        value={getCategoryStartTime(c, activeGridStageId)}
                        onChange={(e) => updateCategoryStartTime(c, e.target.value, activeGridStageId)}
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                        sx={{ flex: 1 }}
                      />
                      <Button
                        variant="outlined"
                        color="inherit"
                        disabled={count === 0}
                        onClick={() => handleShuffleSingleCategory(c)}
                        startIcon={<ShuffleRoundedIcon />}
                        sx={{ flexShrink: 0 }}
                      >
                        Sortear
                      </Button>
                    </Box>
                  </Box>
                )
              })}
            </ListCard>
          </Section>

          <Button variant="contained" size="large" startIcon={<ShuffleRoundedIcon />} onClick={handleGenerateGrid}>
            {stageGrid.length > 0 ? 'Sortear de novo' : 'Gerar grade'} · {currentStageObj?.name ?? 'Especial'}
          </Button>

          {stageGrid.length > 0 && (
            <Section
              title="Ordem gerada"
              count={stageGrid.length}
              action={
                <Box sx={{ display: 'flex' }}>
                  <Button size="small" color="warning" onClick={() => setConfirmClear('stage')} sx={{ minHeight: 32 }}>
                    Limpar especial
                  </Button>
                  <Button size="small" color="error" onClick={() => setConfirmClear('all')} sx={{ minHeight: 32 }}>
                    Limpar tudo
                  </Button>
                </Box>
              }
            >
              <StartGridList items={stageGrid} stages={stages} />
            </Section>
          )}

          <Typography variant="caption" color="text.secondary">
            A grade é publicada para todos os aparelhos. Os horários de início por categoria ficam salvos neste aparelho.
          </Typography>
        </>
      )}

      {tab === 'acesso' && <MarshalAccess state={state} act={act} />}

      {/* ============ PAINÉIS E CONFIRMAÇÕES ============ */}
      <ImportCsv open={importOpen} onClose={() => setImportOpen(false)} state={state} act={act} />

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Novo atleta">
        <Box component="form" onSubmit={(e) => void submitRider(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="Nº"
              value={num}
              onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
              inputRef={numInputRef}
              autoFocus
              slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', enterKeyHint: 'next' } }}
              sx={{ width: 96, flexShrink: 0 }}
              required
            />
            <AthleteNameField
              value={name}
              onChange={setName}
              onPick={(a) => {
                setName(a.name)
                setTeam(a.team ?? '')
              }}
            />
          </Box>
          <TextField label="Equipe (opcional)" value={team} onChange={(e) => setTeam(e.target.value.slice(0, 40))} fullWidth />
          {categorySelect(activeCat, setCat)}
          <Button type="submit" variant="contained" size="large">
            Cadastrar e continuar
          </Button>
        </Box>
      </BottomSheet>

      <BottomSheet open={Boolean(editingRider)} onClose={() => setEditingRider(null)} title={`Editar atleta #${editingRider?.originalNum ?? ''}`}>
        {editingRider && (
          <Box component="form" onSubmit={(e) => void saveEdit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label="Nº"
                value={editingRider.num}
                onChange={(e) => setEditingRider({ ...editingRider, num: e.target.value.replace(/\D/g, '') })}
                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                sx={{ width: 96, flexShrink: 0 }}
                required
              />
              <AthleteNameField
                value={editingRider.name}
                onChange={(v) => setEditingRider({ ...editingRider, name: v })}
                onPick={(a) => setEditingRider({ ...editingRider, name: a.name, team: a.team ?? editingRider.team })}
              />
            </Box>
            <TextField
              label="Equipe (opcional)"
              value={editingRider.team}
              onChange={(e) => setEditingRider({ ...editingRider, team: e.target.value.slice(0, 40) })}
              helperText="Vale para este atleta em todos os eventos"
              fullWidth
            />
            {categorySelect(editingRider.cat, (v) => setEditingRider({ ...editingRider, cat: v }))}
            <AthleteHistory athleteId={editingRider.athleteId} currentEventId={state.event?.id} />
            <Button type="submit" variant="contained" size="large">
              Salvar
            </Button>
            <Button
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => {
                const r = state.riders.find((x) => x.num === editingRider.originalNum)
                if (r) setDeletingRider(r)
              }}
            >
              Excluir atleta
            </Button>
          </Box>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(editingCategory)} onClose={() => setEditingCategory(null)} title="Renomear categoria">
        {editingCategory && (
          <Box component="form" onSubmit={(e) => void saveEditCategory(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Nome" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} fullWidth required autoFocus />
            {state.riders.some((r) => r.cat === editingCategory.oldName) && (
              <Typography variant="body2" color="text.secondary">
                {state.riders.filter((r) => r.cat === editingCategory.oldName).length} atleta(s) desta categoria serão atualizados.
              </Typography>
            )}
            <Button type="submit" variant="contained" size="large">
              Salvar
            </Button>
          </Box>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(editingStage)} onClose={() => setEditingStage(null)} title="Renomear especial">
        {editingStage && (
          <Box component="form" onSubmit={(e) => void saveEditStage(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Nome" value={editingStage.name} onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })} fullWidth required autoFocus />
            <Button type="submit" variant="contained" size="large">
              Salvar
            </Button>
          </Box>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deletingRider)}
        onClose={() => setDeletingRider(null)}
        onConfirm={() => void confirmRemoveRider()}
        icon={<WarningAmberRoundedIcon />}
        title="Excluir atleta?"
        confirmLabel="Excluir"
      >
        <strong>
          #{deletingRider?.num} {deletingRider?.name}
        </strong>{' '}
        e todas as descidas e tempos dele serão apagados.
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => void executeRemoveCategory()}
        icon={<WarningAmberRoundedIcon />}
        tone="warning"
        title={`Excluir "${deletingCategory?.name ?? ''}"?`}
        confirmLabel="Excluir"
      >
        {deletingCategory && deletingCategory.ridersCount > 0
          ? `${deletingCategory.ridersCount} atleta(s) ficarão sem categoria e não poderão largar até serem reclassificados.`
          : 'Nenhum atleta está nesta categoria.'}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deletingStage)}
        onClose={() => setDeletingStage(null)}
        onConfirm={() => void executeRemoveStage()}
        icon={<WarningAmberRoundedIcon />}
        title={`Excluir "${deletingStage?.name ?? ''}"?`}
        confirmLabel="Excluir tudo"
      >
        A especial será excluída junto com <strong>{deletingStage?.runsCount} descida(s)</strong> gravada(s). Os tempos serão perdidos.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        onConfirm={() => {
          setConfirmDemo(false)
          void act(() => api.loadDemo(), 'Atletas de exemplo carregados')
        }}
        icon={<ScienceRoundedIcon />}
        tone="warning"
        title="Carregar atletas de exemplo?"
        confirmLabel="Carregar"
      >
        Adiciona 6 atletas de teste (Elite Masculino e Feminino) e as 3 especiais de exemplo.{' '}
        <strong>As descidas e grades registradas serão apagadas.</strong>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClear !== null}
        onClose={() => setConfirmClear(null)}
        onConfirm={runClearGrid}
        tone="warning"
        title={confirmClear === 'all' ? 'Limpar todas as grades?' : `Limpar grade da ${currentStageObj?.name ?? 'especial'}?`}
        confirmLabel="Limpar"
      >
        A ordem de largada sorteada será descartada.
      </ConfirmDialog>
    </Box>
  )
}
