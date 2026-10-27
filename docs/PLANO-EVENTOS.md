# Plano: vários eventos com códigos de fiscal e de público

## Objetivo

Hoje o banco guarda uma prova só: pilotos, categorias, especiais, descidas e grade. O fiscal entra com um PIN conferido no navegador, e qualquer pessoa com o link consegue ler e escrever tudo.

A proposta:
- O app passa a guardar **vários eventos**, cada um com nome, data, local, especiais, categorias, inscritos e tempos.
- Cada evento tem dois códigos:
  - **Código do público** (ex.: `SPET-ERE`): abre o evento só para ver os resultados. Não é segredo; vai no link e no QR code.
  - **Código do fiscal** (ex.: `7KQ-4M2`): libera largada e chegada **naquele evento**. É segredo e é conferido no servidor.
- O **organizador** cria e edita eventos com login de verdade. Isso substitui o PIN e resolve o principal ponto de segurança do `docs/ARQUITETURA.md`.

A fila offline, a correção do relógio pelo servidor e as funções que não duplicam ações continuam como estão. Foi nesses pontos que o app do Firebase se mostrou frágil.

## Decisões para você confirmar

| # | Decisão | Recomendação | Alternativa |
|---|---|---|---|
| D1 | **Número da placa** | Por evento: o mesmo piloto pode ter números diferentes em cada prova. | Número fixo do piloto no campeonato. |
| D2 | **Categorias** | Por evento, com a opção "copiar categorias de outro evento". | Uma lista única para todos os eventos. |
| D3 | **Cadastro de pilotos** | Base única de pilotos (nome, equipe, cidade) e inscrição por evento (placa e categoria). | Pilotos separados em cada evento: mais simples, mas sem histórico do piloto. |
| D4 | **Login do organizador** | E-mail e senha (ou link mágico) do Supabase Auth. Só quem estiver na tabela `organizers` cria eventos. | Manter o PIN, mas conferido no servidor. |
| D5 | **Quem vê eventos encerrados** | Público, pelo código ou pela lista de eventos passados. | Só o organizador. |

O plano abaixo segue as recomendações.

## Modelo de dados

```
events        id uuid · name · starts_on date · location · status (rascunho|aberto|encerrado)
              public_code text unique · marshal_code_hash text · created_by uuid

organizers    user_id uuid (auth.users)                     -- quem cria e edita eventos
event_marshals event_id · user_id · joined_at                -- aparelhos liberados como fiscal

riders        id uuid · name · team · city                  -- base única de pilotos (D3)
entries       event_id · num · rider_id · category           -- inscrição: placa e categoria no evento (D1)
categories    event_id · name · position                     -- por evento (D2)
stages        id · event_id · name · position · distance_km
runs          id · event_id · num · stage_id · started_at · finished_at · status
start_grid    event_id · stage_id · num · position · scheduled_at
```

- Toda tabela de prova ganha `event_id`. As chaves passam a ser compostas com ele, por exemplo `entries (event_id, num)` e `runs (event_id, num, stage_id)`. Dois eventos podem ter a placa 12 sem conflito.
- Os índices atuais (um piloto na pista por vez, uma descida por especial) passam a valer **por evento**.
- O código do fiscal é guardado só como hash (`crypt()` do pgcrypto), nunca em texto. O organizador vê o código uma única vez, ao gerar, e pode gerar outro quando quiser.

### Migração dos dados atuais

O script cria um evento "Prova atual" e move para ele tudo o que existe hoje: pilotos viram inscrições, e categorias, especiais, descidas e grade ganham o `event_id`. Como o `schema.sql` atual, o script pode ser rodado mais de uma vez e não apaga tempos. Vou validar no PGlite partindo de uma cópia do banco atual com dados, como fizemos na migração das especiais.

## Segurança e acesso

| Quem | Como entra | O que pode |
|---|---|---|
| Público | Abre o link `…/#/e/SPET-ERE` ou digita o código. Não precisa de login. | Ler um evento aberto ou encerrado. |
| Fiscal | Digita o código do fiscal. O app faz um login anônimo no Supabase e chama `join_event(public_code, marshal_code)`, que confere o hash e grava o aparelho em `event_marshals`. | Largar, registrar chegada, DNF e desfazer **só naquele evento**. |
| Organizador | E-mail e senha. | Criar e editar eventos, inscrições, especiais e grade, e gerar códigos. |

- **As regras de acesso (RLS) passam a valer de verdade.** Leitura é liberada para todos em eventos que não são rascunho. Escrita só pelas funções (`start_run`, `finish_run`…), que conferem se `auth.uid()` está em `event_marshals` daquele evento ou em `organizers`. O acesso aberto atual ("prototype all") sai.
- **Proteção contra tentativa e erro no código do fiscal:** o `join_event` limita as tentativas erradas por aparelho (ex.: 5 por 10 minutos). O código tem 6 caracteres sem letras ambíguas (sem O/0, I/1), o que dá mais de 700 milhões de combinações.
- **Funcionamento sem sinal:** o fiscal precisa de sinal **uma vez**, para entrar com o código. Depois disso, a sessão anônima fica salva no aparelho e a fila offline continua funcionando. Se a sessão expirar sem sinal, as ações ficam na fila e são enviadas quando o sinal voltar e a sessão se renovar.
- **Fechar o acesso ao encerrar:** ao encerrar o evento, o fiscal perde a permissão de escrita. Corrigir tempos depois disso fica com o organizador.

## Telas e navegação

O app passa a usar rotas no `#` da URL, que não exigem configuração no servidor de hospedagem:

| Rota | Tela |
|---|---|
| `#/` | Início: eventos de hoje, campo "Tenho um código" e eventos encerrados. |
| `#/e/:codigo` | Telas do público que já existem (ao vivo, resultados, largadas), no evento escolhido. |
| `#/e/:codigo/fiscal` | Largada, Chegada, Ranking e Prova, depois de entrar com o código do fiscal. |
| `#/organizar` | Login e lista de eventos: criar, editar, duplicar, encerrar. |
| `#/organizar/:id` | Configuração do evento: dados, especiais, categorias, inscrições, grade e códigos (copiar, compartilhar, QR code). |

- **Duplicar evento** copia especiais, categorias e inscrições, sem tempos. É o caminho mais rápido para a etapa seguinte de um campeonato.
- **Importar CSV** passa a inscrever no evento, com colunas `numero; nome; categoria; equipe`. O piloto é reaproveitado da base quando o nome bate (ignorando acentos e maiúsculas); a prévia mostra "piloto existente" ou "piloto novo".
- **Relatório:** o título passa a vir do nome e da data do evento.
- O aparelho lembra o último evento aberto, para o fiscal não digitar o código toda vez.

## Mudanças no código

- `types.ts`: novos tipos `Event` e `Entry`. A interface `Api` ganha métodos de evento e o restante passa a valer para o evento escolhido: `api.useEvent(id)` ou uma fábrica `createEventApi(eventId)`.
- `supabaseApi.ts`:
  - busca e tempo real filtrados por `event_id`;
  - a fila offline guarda o `event_id` de cada ação;
  - login anônimo e `join_event`.
- `localApi.ts`: guarda vários eventos no aparelho, sem conferir códigos. Continua servindo para teste e demonstração.
- `App.tsx`: troca `mode`/`adminTab` por rotas, e o PIN (`AdminLogin`) dá lugar a "Entrar com código" e ao login do organizador.

## Entrega em etapas (um PR cada)

| Etapa | Conteúdo | Risco |
|---|---|---|
| **1. Eventos no banco** | Tabelas novas, `event_id` em tudo, migração para "Prova atual", API por evento. Não muda nada na tela: o app abre direto no evento "Prova atual". | Migração: validada no PGlite com dados reais antes. |
| **2. Acesso por código e login** | Login anônimo, `join_event`, `organizers`, RLS fechada, tela "Entrar com código". O PIN sai. | Uma regra de acesso errada bloqueia o fiscal: testar cada papel (público, fiscal, organizador) contra o Supabase real antes da prova. |
| **3. Telas de eventos** | Início, rotas, área do organizador, criar, editar, duplicar e encerrar evento, códigos e QR code. | Baixo. |
| **4. Base de pilotos** | `riders` única com `entries`, inscrição a partir da base, CSV com equipe, histórico do piloto. | Pilotos repetidos por nomes digitados de jeitos diferentes: a prévia do CSV mostra o que será reaproveitado. |

Cada etapa deixa o app funcionando. Se faltar tempo antes de uma prova, as etapas 1 e 2 sozinhas já resolvem o problema de segurança.

## Andamento

### Etapa 1: eventos no banco (feita)

- **`schema.sql`:**
  - cria a tabela `events` e um evento "Prova atual" com tudo o que já existia;
  - coloca `event_id` em `categories`, `riders`, `stages`, `runs` e `start_grid`;
  - as chaves passam a ser por evento: `(event_id, num)`, `(event_id, id)` etc., e as chaves estrangeiras são compostas e propagam renumeração e exclusão;
  - os índices "um piloto na pista por vez" e "uma descida por especial" passam a valer por evento.
- **Funções:**
  - `start_run`, `finish_run`, `remove_stage` e `set_start_grid` recebem `p_event`;
  - novo erro `MTB07` (evento não encontrado).
- **Compatibilidade com o app antigo:**
  - as versões antigas das funções, sem `p_event`, continuam existindo e valem para o primeiro evento;
  - inserções sem `event_id` também vão para ele.

  Assim, um celular com o app antigo em cache continua funcionando enquanto houver um evento só.
- **App:**
  - a camada Supabase escolhe o evento em uso: o que o aparelho já usava ou o aberto mais recente;
  - filtra tudo por ele;
  - grava o evento em cada ação da fila offline.

  Ações que estavam na fila antes da atualização só são enviadas depois que o evento é conhecido. O nome do evento aparece na aba Prova e vira o título padrão do relatório.
- **Antes da etapa 4:** a tabela `riders` faz o papel de **inscrição** (placa, nome e categoria no evento). A base única de pilotos entra na etapa 4.
- **Validação no PGlite:**
  - migração a partir do banco atual com dados (rodada duas vezes, sem perda);
  - banco muito antigo com descidas repetidas;
  - banco novo;
  - dois eventos com a mesma placa e as mesmas especiais;
  - chamadas do app antigo, no formato nomeado que o Supabase usa.

  **Não testado contra o Supabase real.**

**Como aplicar:** rode `supabase/schema.sql` inteiro no SQL Editor **antes** de publicar o app novo, como nas outras atualizações.

## Fora deste plano

- Pontuação de campeonato somando várias etapas: fica mais fácil depois da etapa 4, mas é outro trabalho.
- Pagamento e inscrição feitos pelo próprio piloto.
- As funcionalidades rápidas levantadas na comparação com o app do Firebase (tempos de referência, equipe, reiniciar especial…). São independentes e podem entrar antes ou depois.
