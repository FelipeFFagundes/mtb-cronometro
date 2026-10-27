import { useState, type ReactNode } from 'react'
import type { Role } from '../types'
import { display, radius, tabular, tokens } from '../theme'
import { ChipSelect, PageHeader } from './ui'
import { Alert, Box, Card, Typography } from '@mui/material'

/*
 * Página "Como usar": passo a passo de cada papel e checklist do dia da prova.
 * Os nomes de botões e telas aqui precisam acompanhar os da interface.
 */

type Guide = 'fiscal' | 'organizador' | 'publico' | 'dia'

const GUIDES: { value: Guide; label: string }[] = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'organizador', label: 'Organizador' },
  { value: 'publico', label: 'Público' },
  { value: 'dia', label: 'Dia da prova' },
]

/** Nome de botão ou tela, destacado como na interface. */
function B({ children }: { children: ReactNode }) {
  return (
    <Box component="strong" sx={{ color: 'text.primary', fontWeight: 800 }}>
      {children}
    </Box>
  )
}

function Steps({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography sx={{ ...display, fontWeight: 800, fontSize: '1.2rem', textTransform: 'uppercase', mb: 1.5 }}>{title}</Typography>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {items.map((item, i) => (
          <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              aria-hidden
              sx={{
                ...tabular,
                flexShrink: 0,
                width: 26,
                height: 26,
                mt: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: tokens.brand,
                color: tokens.brandInk,
                borderRadius: radius.sm,
                fontWeight: 800,
                fontSize: '0.95rem',
              }}
            >
              {i + 1}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              {item}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  )
}

function Note({ severity = 'info', children }: { severity?: 'info' | 'warning'; children: ReactNode }) {
  return (
    <Alert severity={severity} sx={{ '& .MuiAlert-message': { lineHeight: 1.5 } }}>
      {children}
    </Alert>
  )
}

/** Legenda do indicador de conexão do topo. */
function SyncLegend() {
  const rows: [string, string, string][] = [
    ['Online', tokens.start, 'Tudo enviado. Os tempos já estão no servidor.'],
    ['Enviando', tokens.warn, 'Há registros guardados no aparelho sendo enviados.'],
    ['Offline', tokens.finish, 'Sem sinal. Continue cronometrando: tudo fica guardado e é enviado quando o sinal voltar.'],
  ]
  return (
    <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography sx={{ ...display, fontWeight: 800, fontSize: '1.2rem', textTransform: 'uppercase' }}>Indicador de conexão (topo)</Typography>
      {rows.map(([label, color, text]) => (
        <Box key={label} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: 96, flexShrink: 0, color, fontWeight: 800, ...display }}>
            <Box sx={{ width: 8, height: 8, bgcolor: color, borderRadius: radius.pill }} />
            {label.toUpperCase()}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {text}
          </Typography>
        </Box>
      ))}
    </Card>
  )
}

function FiscalGuide() {
  return (
    <>
      <Steps
        title="Entrar como fiscal"
        items={[
          <>
            Na página inicial, toque em <B>Sou fiscal</B> e digite o código que o organizador passou (ex.: <B>7KQ-4M2</B>).
          </>,
          <>Faça isso com internet, antes de ir para o ponto de largada ou chegada. Depois o celular funciona sem sinal.</>,
          <>
            O código vale só para aquele evento. Se aparecer <B>Código inválido</B>, confira com o organizador: ele pode ter
            gerado um novo.
          </>,
        ]}
      />
      <Steps
        title="Largada"
        items={[
          <>
            Abra a aba <B>Largada</B> e escolha a especial nos botões do topo (ex.: E1, E2).
          </>,
          <>
            O piloto da vez aparece em destaque como <B>Próximo a largar</B>, na ordem da grade. Para largar outro, toque nele na
            fila ou use a busca (placa ou nome).
          </>,
          <>
            Toque em <B>LARGAR</B>. A contagem 3, 2, 1 toca bipes e vibra; o tempo começa no <B>VAI!</B>. Dá para{' '}
            <B>Cancelar largada</B> até o VAI!.
          </>,
          <>
            Largou o piloto errado? Toque em <B>Desfazer</B> no aviso que aparece logo depois (fica 6 segundos). Depois disso, use
            o botão de desfazer ao lado do piloto em <B>Últimas largadas</B>.
          </>,
        ]}
      />
      <Steps
        title="Chegada"
        items={[
          <>
            Abra a aba <B>Chegada</B>. Cada piloto na pista aparece num bloco com o cronômetro correndo; o contorno vermelho
            marca quem largou primeiro.
          </>,
          <>
            Toque no bloco <B>no instante em que o piloto cruzar a linha</B>. O tempo é capturado nesse toque, não no da
            confirmação.
          </>,
          <>
            Confira o nome e toque em <B>CONFIRMAR CHEGADA</B>. Se tocou no piloto errado, toque em <B>Cancelar</B>: o cronômetro
            dele continua correndo.
          </>,
          <>
            Piloto que não vai terminar (queda, desistência): no mesmo painel, <B>Não terminou</B> marca DNF.
          </>,
          <>
            Para corrigir uma chegada, toque em <B>⋯</B> ao lado do piloto em <B>Últimas chegadas</B>: dá para marcar DNF ou{' '}
            <B>Excluir descida</B> (o piloto pode largar de novo).
          </>,
        ]}
      />
      <SyncLegend />
      <Note severity="warning">
        Com o indicador em <B>Enviando</B> ou <B>Offline</B>, não saia do modo fiscal: há tempos guardados só neste celular. Espere
        ficar <B>Online</B>.
      </Note>
      <Note>
        No computador: <B>Enter</B> larga o próximo e <B>/</B> abre a busca, na Largada; <B>1</B> a <B>9</B> registram a chegada
        do piloto naquela posição e <B>Enter</B> confirma, na Chegada. O som da largada liga e desliga no menu <B>⋮</B>.
      </Note>
    </>
  )
}

function OrganizerGuide() {
  return (
    <>
      <Steps
        title="Criar o evento"
        items={[
          <>
            Na página inicial, toque em <B>Organizador</B> e entre com seu e-mail e senha.
          </>,
          <>
            Toque em <B>Novo</B>. Para a próxima etapa de um campeonato, escolha <B>Cópia de</B> um evento anterior: vêm especiais,
            categorias e inscritos, sem tempos.
          </>,
          <>
            Toque em <B>Abrir</B> no evento e vá na aba <B>Prova</B> para os cadastros.
          </>,
        ]}
      />
      <Steps
        title="Preparar a prova (aba Prova)"
        items={[
          <>
            <B>Especiais:</B> cadastre as trilhas cronometradas, na ordem (ex.: E1 · Linha do Trem).
          </>,
          <>
            <B>Categorias:</B> crie as categorias da prova. Atleta sem categoria não pode largar.
          </>,
          <>
            <B>Atletas:</B> toque em <B>Novo atleta</B> (ao digitar o nome, quem já correu outro evento aparece como sugestão) ou{' '}
            <B>Importar planilha</B> com as colunas numero, nome, categoria e equipe. O botão <B>Modelo</B> baixa um exemplo.
          </>,
          <>
            <B>Grade:</B> escolha o horário de início de cada categoria e o intervalo, e toque em <B>Gerar grade</B> para sortear
            a ordem de largada de cada especial.
          </>,
          <>
            <B>Acesso:</B> toque em <B>Gerar código</B> e passe o código para os fiscais. Ele só aparece uma vez: anote ou
            compartilhe na hora.
          </>,
        ]}
      />
      <Steps
        title="Divulgar e encerrar"
        items={[
          <>
            Em <B>Eventos</B>, toque em <B>Divulgar</B>: mostra o QR code e o link para o público acompanhar ao vivo.
          </>,
          <>
            Perdeu o controle de quem tem o código? Em <B>Prova → Acesso</B>, <B>Trocar código</B> e marque para tirar o acesso dos
            aparelhos que já entraram.
          </>,
          <>
            No fim, em <B>Editar</B>, mude a situação para <B>Encerrado</B>: os resultados continuam públicos e os fiscais param de
            registrar. Você ainda pode corrigir tempos.
          </>,
          <>
            Os resultados saem em PDF ou imagem pelo botão <B>Exportar</B>, no Ranking.
          </>,
        ]}
      />
      <Note severity="warning">
        <B>Excluir</B> um evento apaga todos os inscritos e tempos dele, sem volta. Para só tirar do ar, use <B>Rascunho</B>{' '}
        (escondido do público) ou <B>Encerrado</B>.
      </Note>
    </>
  )
}

function PublicGuide() {
  return (
    <>
      <Steps
        title="Acompanhar uma prova"
        items={[
          <>
            Abra o link ou aponte a câmera para o QR code da prova. Ou, na página inicial, toque em <B>Acompanhar uma prova</B> e
            escolha o evento (ou digite o código do evento).
          </>,
          <>
            <B>Ao vivo:</B> quem está na pista, com o cronômetro correndo, e as últimas chegadas.
          </>,
          <>
            <B>Resultados:</B> classificação geral (soma das especiais) ou de uma especial, por categoria. Toque num piloto para ver
            os tempos de cada especial.
          </>,
          <>
            <B>Largadas:</B> a ordem e o horário de largada de cada especial.
          </>,
        ]}
      />
      <Note>Os tempos atualizam sozinhos. Não precisa recarregar a página.</Note>
    </>
  )
}

function RaceDayGuide() {
  return (
    <>
      <Steps
        title="Na véspera (organizador)"
        items={[
          <>Confira especiais, categorias e inscritos; ninguém pode estar sem categoria.</>,
          <>Gere a grade de largada e o código dos fiscais.</>,
          <>Divulgue o QR code do evento para o público.</>,
        ]}
      />
      <Steps
        title="Antes de ir para a trilha (fiscais)"
        items={[
          <>Celular carregado (leve bateria extra) e com o brilho da tela no máximo.</>,
          <>
            Entre com o código do fiscal <B>ainda com internet</B> e confira que aparecem as abas Largada e Chegada.
          </>,
          <>
            Teste o som: menu <B>⋮</B> → <B>Som da largada</B>. No iPhone, desligue a chave de silencioso.
          </>,
          <>Combine quem fica na largada e quem fica na chegada de cada especial.</>,
        ]}
      />
      <Steps
        title="Durante a prova"
        items={[
          <>Na chegada, toque no piloto exatamente quando ele cruzar a linha; confirme com calma depois.</>,
          <>Sem sinal, continue normalmente: o indicador fica Offline e os tempos são enviados quando o sinal voltar.</>,
          <>Errou? Desfaça a largada pelo aviso ou corrija a chegada em Últimas chegadas.</>,
          <>No fim, espere o indicador ficar Online antes de sair do modo fiscal ou fechar o app.</>,
        ]}
      />
    </>
  )
}

/** Página "Como usar". Abre no guia do papel de quem está usando. */
export function Help({ role }: { role: Role }) {
  const [guide, setGuide] = useState<Guide>(role === 'organizer' ? 'organizador' : 'fiscal')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader title="Como usar" subtitle="Passo a passo para cada função e para o dia da prova" />
      <ChipSelect ariaLabel="Guia" value={guide} onChange={(v) => setGuide(v as Guide)} options={GUIDES} />
      {guide === 'fiscal' && <FiscalGuide />}
      {guide === 'organizador' && <OrganizerGuide />}
      {guide === 'publico' && <PublicGuide />}
      {guide === 'dia' && <RaceDayGuide />}
    </Box>
  )
}
