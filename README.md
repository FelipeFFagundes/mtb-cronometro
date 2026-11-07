# MTB Cronômetro

App de cronometragem de provas de MTB (React + Vite + Supabase). Detalhes em `docs/ARQUITETURA.md`.

```bash
npm install
npm run dev
```

## Banco de dados: migrations

O banco é versionado em `supabase/migrations/`. **Nunca mais cole SQL no SQL Editor**: toda mudança é um arquivo novo.

### Primeira vez (uma vez por máquina)

```bash
npx supabase login
npm run db:link -- --project-ref SEU_PROJECT_REF
```

O `project-ref` está na URL do painel: `supabase.com/dashboard/project/<project-ref>`.

### Banco que já existe (o da prova atual)

A `baseline` é o antigo `schema.sql`, idempotente. Marque-a como já aplicada, sem rodar nada:

```bash
npx supabase migration repair --status applied 20261029120000
npm run db:status
```

### Dia a dia

```bash
npm run db:new -- nome_da_mudanca   # cria supabase/migrations/<timestamp>_nome_da_mudanca.sql
# edite o arquivo, depois:
npm run db:push                     # aplica no projeto ligado (só o que falta)
npm run db:status                   # compara local x remoto
```

Regras:
- Não edite uma migration já aplicada. Crie outra.
- Prefira SQL idempotente (`if not exists`, `create or replace`), como a baseline.
- Para testar antes, com Docker instalado: `npm run db:start` e `npm run db:reset` (recria o banco local do zero a partir das migrations).
