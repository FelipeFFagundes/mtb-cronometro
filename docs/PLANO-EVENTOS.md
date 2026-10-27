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
- **Inscrição:** a tabela `riders` faz o papel de inscrição (placa, nome e categoria no evento). A base única de pilotos entrou na etapa 4, como `athletes`.
- **Validação no PGlite:**
  - migração a partir do banco atual com dados (rodada duas vezes, sem perda);
  - banco muito antigo com descidas repetidas;
  - banco novo;
  - dois eventos com a mesma placa e as mesmas especiais;
  - chamadas do app antigo, no formato nomeado que o Supabase usa.

  **Não testado contra o Supabase real.**

**Como aplicar:** rode `supabase/schema.sql` inteiro no SQL Editor **antes** de publicar o app novo, como nas outras atualizações.

### Etapa 2: acesso por código e login (feita)

- **Banco:**
  - novas tabelas `organizers`, `event_marshals` (aparelhos liberados como fiscal), `event_secrets` (hash do código, sem leitura pela API) e `join_attempts` (limite de tentativas);
  - `set_marshal_code` gera o código do fiscal (6 caracteres sem 0/O/1/I, mostrado como `ABC-123`); `join_event` libera o aparelho; `my_access` diz o papel; `event_access_info` mostra a situação ao organizador;
  - as funções de largada e chegada conferem quem chama (`MTB08` sem permissão) e as de cadastro, como grade e excluir especial, são só do organizador;
  - 5 códigos errados em 10 minutos bloqueiam o aparelho (`MTB09`).
- **Regras de acesso fechadas:**
  - leitura liberada para todos em eventos que não são rascunho;
  - escrita direta nas tabelas só pelo organizador;
  - o fiscal grava só pelas funções;
  - as regras abertas do protótipo foram removidas, junto com as funções sem evento e o padrão de `event_id` da etapa 1.
- **App:**
  - "Fiscal" abre a entrada com duas abas: **código do fiscal** (login anônimo e `join_event`) e **organizador** (e-mail e senha);
  - o fiscal vê Largada, Chegada e Ranking;
  - o organizador vê também Prova (com a nova aba **Acesso**, que gera e troca o código) e os itens de dados de exemplo e de apagar;
  - o papel fica guardado no aparelho e vale sem sinal;
  - se o servidor recusar uma ação por falta de permissão, ela continua na fila e o app pede para entrar de novo, sem descartar nada;
  - no modo local, o PIN continua funcionando como antes.
- **Validação:** no PGlite, cada papel (público, fiscal com e sem código, organizador) foi testado contra cada operação, incluindo evento encerrado, rascunho, troca de código com revogação, limite de tentativas e o schema rodado duas vezes a partir do banco da etapa 1. **Não testado contra o Supabase real.**

**Como aplicar (nesta ordem, fora do horário de prova):**

1. No Supabase, ative o login anônimo: **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
2. Desative o cadastro aberto, para ninguém criar conta sozinho: **Authentication → Sign In / Providers → desmarque "Allow new users to sign up"**. Os organizadores são criados por você no painel.
3. Crie o organizador: **Authentication → Users → Add user** (e-mail e senha, marcando "Auto Confirm User").
4. Rode `supabase/schema.sql` inteiro no SQL Editor.
5. Libere o organizador (troque o e-mail):

   ```sql
   insert into organizers (user_id) select id from auth.users where email = 'seu@email.com';
   ```
6. Publique o app novo **logo em seguida**. Depois do passo 4, o app antigo deixa de conseguir gravar.
7. No app: **Fiscal → Organizador**, entre com o e-mail e gere o código em **Prova → Acesso**.

### Etapa 3: telas de eventos (feita)

- **Banco:**
  - código público de 5 caracteres para cada evento, gerado automaticamente (gatilho `events_public_code`); o "Prova atual" ganha o seu ao rodar o schema;
  - `create_event` cria um evento do zero (especial E1 e categorias padrão) ou duplicando outro (especiais, categorias e inscritos, sem tempos nem grade);
  - editar, encerrar e excluir continuam direto na tabela, liberados só para o organizador pelas regras da etapa 2.
- **Rotas** (no `#` da URL, sem configuração no servidor):

  | Rota | Tela |
  |---|---|
  | `#/` | Página inicial: acompanhar uma prova, fiscal ou organizador |
  | `#/eventos` | Lista de eventos |
  | `#/ajuda` | Como usar: passo a passo do fiscal, do organizador, do público e checklist do dia da prova |
  | `#/e/K7MQ2` | Público do evento |
  | `#/e/K7MQ2/fiscal` | Fiscal e organizador do evento |
  | `#/organizar` | Área do organizador |

  O antigo `#admin` leva às telas do fiscal do evento em uso. O botão Voltar navega entre as telas.
- **Página inicial** (`#/`), com três entradas:
  - **Acompanhar uma prova:** leva à lista de eventos e mostra quantos estão abertos ou quais são de hoje;
  - **Sou fiscal:** abre a entrada com o código do fiscal; quem já entrou continua direto no evento;
  - **Organizador:** abre o login de organizador e, depois de entrar, a área do organizador.

  O botão "Fiscal" do topo some nessa página, porque as entradas já estão nela. Quem chega pelo link ou QR code de um evento continua indo direto para ele.
- **Lista de eventos** (`#/eventos`):
  - eventos abertos (os de hoje primeiro, marcados com "Hoje") e encerrados;
  - campo "Tenho um código";
  - link para a área do organizador.
- **Área do organizador:** cria, edita (nome, data, local e situação: rascunho, aberto ou encerrado), duplica e exclui eventos. Para excluir, é preciso digitar o nome do evento. A confirmação mostra quantos inscritos e tempos serão apagados e, se houver tempos, oferece encerrar em vez de excluir. O painel de edição mostra o nome do evento no título. **Divulgar** mostra o QR code e o link do evento, com copiar e compartilhar.
- **Topo:** o nome do evento aparece abaixo de "Race Timer"; o logo volta ao início. No menu do organizador, o item **Eventos** abre a área do organizador.
- **Modo local:** guarda vários eventos no aparelho, com as mesmas telas. Os dados que já existiam ficam no evento "Prova atual" (código `LOCAL`).
- **Validação:**
  - PGlite: 16 conferências novas (código público, criar e duplicar, permissões, normalização do código, banco novo); as 44 da etapa 2 continuam passando com o schema novo;
  - navegador, modo local: abertura direta, PIN, criar evento duplicado, abrir no fiscal, voltar, código digitado, evento inexistente, link antigo e QR code.

  **Não testado contra o Supabase real.**

**Como aplicar:** rode `supabase/schema.sql` inteiro no SQL Editor. Ele só acrescenta coisas à etapa 2: o app publicado com a etapa 2 continua funcionando.

### Etapa 4: base de pilotos (feita)

- **Banco:**
  - tabela `athletes` (nome, equipe, cidade): cada pessoa é cadastrada uma vez;
  - a inscrição no evento continua em `riders` (placa, nome e categoria do evento) e ganha `athlete_id`;
  - **o vínculo é automático pelo nome**, ignorando acentos, maiúsculas e espaços repetidos (gatilho `riders_link_athlete`): "joao  da silva" num evento novo reaproveita o "João da Silva" que já existe. Homônimos ficam no mesmo atleta;
  - ao rodar o schema, as inscrições existentes são ligadas aos atletas, sem perder nada;
  - duplicar evento mantém os mesmos atletas;
  - `set_teams` grava a equipe (só organizador) e `search_athletes` busca na base sem diferenciar acentos;
  - leitura pública; escrita só do organizador.
- **App:**
  - **Novo atleta:** ao digitar o nome, sugere quem já está na base (com equipe e número de eventos); escolher preenche nome e equipe;
  - **campo Equipe** no cadastro e na edição; vale para o atleta em todos os eventos;
  - **"Outros eventos"** no painel de edição mostra o histórico do atleta (data, evento, placa e categoria);
  - a equipe aparece na lista de atletas, na contagem regressiva e na classificação;
  - **planilha:** coluna opcional `equipe` (modelo atualizado); sem a coluna, a equipe já cadastrada não muda.
- **Modo local:** o atleta é reconhecido pelo nome em todos os eventos do aparelho.
- **Validação:**
  - PGlite: 21 conferências novas (migração, vínculo por nome com acentos, troca de nome, duplicar, equipe, busca, permissões, banco novo); as 44 da etapa 2 e as 16 da etapa 3 continuam passando;
  - navegador, modo local: importar o modelo com equipe, o mesmo atleta em duas etapas, sugestão ao digitar, escolher a sugestão e histórico no painel de edição.

  - Supabase real (schema aplicado): sem login, inscrições ligadas aos atletas, busca sem acento e escrita bloqueada; com o organizador, equipe gravada, sugestão ao digitar, histórico em "Outros eventos" e busca "pescoco" achando "Sem pescoço". O teste no Supabase pegou dois erros, já corrigidos: o histórico precisava indicar qual ligação entre inscrição e evento usar, e as buscas das listas diferenciavam acentos.

**Como aplicar:** rode `supabase/schema.sql` inteiro no SQL Editor. Ele só acrescenta coisas à etapa 3.

## Fora deste plano

- Pontuação de campeonato somando várias etapas: fica mais fácil depois da etapa 4, mas é outro trabalho.
- Pagamento e inscrição feitos pelo próprio piloto.
- As funcionalidades rápidas levantadas na comparação com o app do Firebase (tempos de referência, equipe, reiniciar especial…). São independentes e podem entrar antes ou depois.
