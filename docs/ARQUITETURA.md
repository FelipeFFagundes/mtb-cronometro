# Validação de arquitetura — SPET Race Timer

Revisão feita em 26/10/2026 sobre o branch `dev` (commit `e497499`).

## Visão geral

```
index.html → main.tsx (tema MUI + service worker)
  └─ App.tsx  (modo público/fiscal, navegação, toasts)
       ├─ hooks/useStore.ts      estado da prova (load + subscribe)
       ├─ data/index.ts          escolhe a implementação da Api
       │    ├─ localApi.ts       localStorage (protótipo, só entre abas)
       │    └─ supabaseApi.ts    Supabase + fila offline + relógio do servidor
       ├─ lib/ranking.ts, lib/time.ts   regras puras (ranking de enduro, formatação)
       └─ components/*           telas (Largada, Chegada, Pilotos, Público, Ranking)
supabase/schema.sql              tabelas, RPCs idempotentes, RLS, realtime
public/sw.js                     cache do app para abrir sem sinal
```

## O que está bom

- **Contrato `Api` único** (`types.ts`) com duas implementações intercambiáveis. As telas não sabem se estão em modo local ou Supabase.
- **Fila offline bem resolvida** (`supabaseApi.ts`): o horário do toque é gravado no aparelho já corrigido pelo offset do servidor, a tela mostra servidor + pendências projetadas, os erros são classificados (`network` / `wait` / `blocked` / `rejected`) e as RPCs são idempotentes. É a parte mais madura do projeto.
- **Relógio do servidor**: o offset é medido pelo menor RTT de 3 amostras e todo cronômetro usa `Date.now() + offset`.
- **Regras puras isoladas** em `lib/ranking.ts` e `lib/time.ts`, fáceis de testar.
- **PWA**: manifest + service worker com rede primeiro e tempo limite na navegação.

## Atualização: especiais e grade no banco (resolve os itens 1, 2 e 4)

Feito no branch `redesign/mobile`:

- **`schema.sql`** agora cria `stages` e `start_grid`, adiciona `runs.stage_id` (FK com cascade) e migra os bancos antigos: as descidas existentes vão para a primeira especial. Pode ser rodado mais de uma vez.
- **Funções:** `start_run` e `finish_run` recebem `p_stage`. Também foram criadas `dnf_run` (vale para descida concluída), `undo_run`, `remove_stage` (renumera) e `set_start_grid` (troca a grade de uma especial de uma vez). Novos códigos de erro: `MTB04` (piloto já tem descida na especial), `MTB05` (especial inexistente) e `MTB06` (não dá para excluir a última especial).
- **Índice único `(rider_num, stage_id)`:** se o banco antigo já tiver descidas repetidas, o índice não é criado e a migração segue. As funções continuam bloqueando novas repetições.
- **App:** a grade faz parte de `AppState.grid` e chega em tempo real, como o resto. A grade antiga do `localStorage` é migrada automaticamente no modo local. Só os horários de início por categoria, que são preferência de quem gera a grade, continuam no aparelho.
- **Validação:** o SQL foi testado em Postgres (PGlite) partindo do schema antigo com dados, rodando o novo duas vezes, e com todos os fluxos acima.

### Como aplicar no Supabase

1. Publique o app novo **depois** de rodar o schema. Um app novo apontando para um banco antigo mostra o aviso "O banco precisa ser atualizado" e guarda as largadas na fila até o banco ser atualizado.
2. Supabase → SQL Editor → cole `supabase/schema.sql` inteiro → Run.
3. As especiais começam como `E1`, `E2` e `E3`. Renomeie-as na aba **Prova → Especiais**.
4. Grades geradas antes ficavam só no celular de quem gerou: gere de novo na aba **Prova → Grade**.

## Problemas críticos (corrigir antes de usar numa prova real)

| # | Problema | Onde | Efeito |
|---|----------|------|--------|
| 1 | ✅ *Resolvido.* **Especiais não existem no banco.** `runs` não tem `stage_id`, `start_run`/`finish_run` não recebem a especial e `pull()` nem seleciona a coluna. `addStage`/`updateStage`/`removeStage` só mexem no cache local. | `schema.sql`, `supabaseApi.ts` (`pull`, `send`, `*Stage`) | No modo Supabase, toda descida volta do servidor como `stage-1` (`toRun` usa o fallback). Uma prova com mais de uma especial **perde a separação dos tempos** assim que sincroniza, e cada aparelho tem a própria lista de especiais. |
| 2 | ✅ *Resolvido.* **Grade de largada só existe no aparelho** (`localStorage['mtb_start_grid']`), assim como os horários por categoria. | `Pilotos.tsx`, `Largada.tsx`, `PublicView.tsx`, `EnduroLeaderboard.tsx` | O fiscal da largada e o público não veem a grade gerada no celular do organizador. |
| 3 | ✅ *Resolvido no Supabase (etapa 2 de docs/PLANO-EVENTOS.md): código do fiscal conferido no servidor, login do organizador e RLS fechado. No modo local o PIN continua, por não haver servidor.* **Sem segurança real.** O PIN é comparado no navegador (`VITE_ADMIN_PIN`, padrão `1234`, embutido no JS) e o RLS libera tudo para `anon`. | `AdminLogin.tsx`, `schema.sql` | Qualquer pessoa com a URL e a chave anon (que está no bundle) pode apagar pilotos e tempos direto na API. O PIN só esconde botões. |
| 4 | ✅ *Resolvido.* **Uma descida aberta por piloto no banco inteiro** (`one_open_run_per_rider`) e `finish_run` fecha "a" descida aberta, sem olhar a especial. | `schema.sql` | Combinado com o item 1, impossibilita duas especiais simultâneas confiáveis. |

## Problemas importantes

- ✅ *Resolvido: DNF, desfazer, `loadDemo` e categorias padrão. Na edição de categoria, os erros agora são verificados, mas ela ainda não é atômica.* **DNF e desfazer não passam por RPC**: `dnf` faz `update` direto sem `finished_at` (existe `dnf_run` no schema, mas não é usado) e `undo` faz `delete` direto.
- **`loadDemo` no Supabase**: `delete().neq('id', '')` compara `uuid` com texto vazio. O Postgres rejeita, o erro é ignorado (sem `ensure`) e as descidas antigas **não são apagadas**.
- **Edição de categoria não é atômica**: atualiza `riders` e depois `categories` em duas chamadas sem verificar o erro da primeira. Falha no meio deixa pilotos numa categoria inexistente. Isso deveria ser uma RPC ou FK com `on update cascade`.
- **Categorias padrão divergentes**: o schema semeia `Elite, Master, Sport, Feminino, Iniciante` e o app usa `Elite Masculino, Elite Feminino`.
- **Canal realtime com nome fixo** (`mtb-changes`) criado a cada `subscribe`. Hoje há um assinante só, mas dois `useStore` colidiriam.
- **Timers globais nunca limpos** em `createSupabaseApi` (4 `setInterval` + listeners). Aceitável porque a Api é um singleton, mas impede testes.
- **`PublicView`**: um `useEffect` dependente de um array recriado a cada render forçava a especial de "Próximos a largar", e o seletor não funcionava. (Corrigido no redesign.)

## Organização do código

- Componentes de 700 a 1.700 linhas misturando regra de negócio (geração de grade, validações de largada) com UI. A lógica de grade e as validações deveriam ir para `lib/`.
- Leitura de `mtb_start_grid` + listeners duplicados em 3 arquivos. (Unificado no hook `useStartGrid` no redesign.)
- Dois sistemas de estilo: `index.css` (classes do protótipo estático, quase todas mortas) e `sx` do MUI. (Limpo no redesign.)
- `README.md` ainda é o template do Vite e não explica como configurar o Supabase nem como rodar a prova.
- Nenhum teste. `lib/ranking.ts` e a projeção `project()` da fila são os primeiros candidatos.
- Bundle de 900 kB num único chunk. Vale separar as telas de fiscal das telas públicas com `lazy()`.

## Recomendações, em ordem

1. **Levar especiais para o banco**: tabela `stages`, coluna `runs.stage_id` (FK), índice único `(rider_num, stage_id)` para descidas concluídas, `start_run(p_num, p_stage, p_at, p_id)` e `finish_run(p_num, p_stage, p_at)`. Ajustar `pull`, `send` e `toRun`.
2. **Levar a grade para o banco**: tabela `start_grid (stage_id, rider_num, position, scheduled_at)` com realtime.
3. **Autenticação de verdade**: Supabase Auth (link mágico ou PIN validado numa Edge Function que devolve uma sessão) e RLS com leitura pública e escrita só para usuários autenticados.
4. Usar `dnf_run` e criar `undo_run` como RPC. Corrigir `loadDemo`.
5. Extrair regras de grade e validação para `lib/` e escrever testes de `ranking.ts` e `project()`.
6. Reescrever o README com o passo a passo de configuração.
