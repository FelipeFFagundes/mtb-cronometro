import type { ReactNode } from 'react'
import type { Access, EventInfo } from '../types'
import { sortEvents, todayIso } from '../lib/events'
import { display, look, radius, tokens } from '../theme'
import { Box, ButtonBase, Chip, Typography } from '@mui/material'
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'

interface Props {
  events: EventInfo[]
  access: Access
  /** Evento em uso (para "continuar como fiscal"). */
  currentEvent?: EventInfo
  onEvents: () => void
  onFiscal: () => void
  onOrganizer: () => void
}

function EntryCard({
  icon,
  color,
  ink,
  title,
  text,
  badge,
  onClick,
}: {
  icon: ReactNode
  color: string
  ink: string
  title: string
  text: string
  badge?: ReactNode
  onClick: () => void
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        minHeight: 104,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: `1px solid ${tokens.line}`,
        borderRadius: radius.lg,
        ...(look.accentBar && { borderLeft: `4px solid ${color}` }),
        transition: 'transform 0.1s, border-color 0.2s',
        '&:hover': { borderColor: tokens.lineStrong },
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: color,
          color: ink,
          borderRadius: radius.md,
          '& svg': { fontSize: 30 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...display, fontWeight: 800, fontSize: '1.35rem', textTransform: look.displayCase, lineHeight: 1.15 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {text}
        </Typography>
        {badge && <Box sx={{ mt: 1 }}>{badge}</Box>}
      </Box>
      <ChevronRightRoundedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </ButtonBase>
  )
}

/** Página inicial: escolher entre acompanhar uma prova, entrar como fiscal ou como organizador. */
export function Landing({ events, access, currentEvent, onEvents, onFiscal, onOrganizer }: Props) {
  const { open } = sortEvents(events)
  const today = open.filter((e) => e.startsOn === todayIso() && e.status === 'aberto')
  const canOperate = access.role !== 'public'

  const eventsBadge =
    today.length > 0 ? (
      <Chip size="small" color="primary" label={today.length === 1 ? `Hoje: ${today[0].name}` : `${today.length} provas hoje`} />
    ) : open.length > 0 ? (
      <Chip size="small" variant="outlined" label={`${open.length} ${open.length === 1 ? 'evento aberto' : 'eventos abertos'}`} />
    ) : undefined

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
        {/* "screen" tira o fundo preto do logo, que ficaria como um retângulo sobre o desenho do fundo */}
        <Box component="img" src="/logo.png" alt="SPET" sx={{ height: 72, width: 'auto', mixBlendMode: 'screen' }} />
        <Typography
          component="h1"
          sx={{ ...display, fontWeight: 800, fontSize: '2.4rem', lineHeight: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          Race Timer
        </Typography>
        <Typography color="text.secondary">Cronometragem de enduro MTB</Typography>
      </Box>

      <Box component="nav" aria-label="Escolha como entrar" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <EntryCard
          icon={<SensorsRoundedIcon />}
          color={tokens.brand}
          ink={tokens.brandInk}
          title="Acompanhar uma prova"
          text="Tempos ao vivo, resultados e ordem de largada"
          badge={eventsBadge}
          onClick={onEvents}
        />
        <EntryCard
          icon={<TrafficRoundedIcon />}
          color={tokens.start}
          ink={tokens.startInk}
          title="Sou fiscal"
          text={
            canOperate && currentEvent
              ? `Continuar em ${currentEvent.name}`
              : 'Largada e chegada, com o código que o organizador passou'
          }
          onClick={onFiscal}
        />
        <EntryCard
          icon={<ManageAccountsRoundedIcon />}
          color={tokens.raised}
          ink={tokens.text}
          title="Organizador"
          text={
            access.role === 'organizer'
              ? access.email
                ? `Conectado como ${access.email}`
                : 'Criar e gerenciar eventos'
              : 'Criar eventos, inscrever atletas e gerar os códigos'
          }
          onClick={onOrganizer}
        />
      </Box>
    </Box>
  )
}
