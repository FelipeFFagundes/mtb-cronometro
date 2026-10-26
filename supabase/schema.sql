-- MTB Cronômetro - esquema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- É seguro rodar de novo: cria o que falta e atualiza as funções sem apagar pilotos nem tempos.
-- Bancos antigos (sem especiais) são migrados: as descidas existentes vão para a primeira especial.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists categories (
  name text primary key
);

-- Categorias padrão só quando a tabela está vazia (não recria as que foram excluídas)
insert into categories (name)
select c from (values ('Elite Masculino'), ('Elite Feminino')) as v(c)
where not exists (select 1 from categories);

create table if not exists riders (
  num      text primary key,
  name     text not null,
  category text not null
);

-- Especiais (trilhas cronometradas) da prova
create table if not exists stages (
  id       text primary key,
  name     text not null,
  position int  not null
);

insert into stages (id, name, position)
select * from (values ('stage-1', 'E1', 1), ('stage-2', 'E2', 2), ('stage-3', 'E3', 3)) as v(id, name, position)
where not exists (select 1 from stages);

create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  rider_num   text not null references riders(num) on delete cascade on update cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'track' check (status in ('track', 'done', 'dnf'))
);

-- Migração: cada descida pertence a uma especial
alter table runs add column if not exists stage_id text references stages(id) on delete cascade on update cascade;
update runs set stage_id = (select id from stages order by position limit 1) where stage_id is null;
alter table runs alter column stage_id set not null;
create index if not exists runs_stage_idx on runs (stage_id);

-- Um piloto só pode estar na pista em um lugar por vez
create unique index if not exists one_open_run_per_rider
  on runs (rider_num) where status = 'track';

-- Uma descida por piloto em cada especial. Bancos antigos podem ter repetições
-- (antes tudo caía na mesma especial): nesse caso o índice não é criado e as
-- funções abaixo continuam bloqueando novas repetições.
do $$
begin
  create unique index if not exists one_run_per_rider_stage on runs (rider_num, stage_id);
exception when unique_violation then
  raise notice 'Há descidas repetidas na mesma especial; índice one_run_per_rider_stage não criado.';
end $$;

-- Ordem de largada por especial (nome e categoria vêm de riders)
create table if not exists start_grid (
  stage_id     text not null references stages(id) on delete cascade on update cascade,
  rider_num    text not null references riders(num) on delete cascade on update cascade,
  position     int  not null,
  scheduled_at timestamptz not null,
  primary key (stage_id, rider_num)
);

-- Horário do servidor (o app usa para calcular o offset do relógio do celular)
create or replace function server_now() returns timestamptz
language sql stable as $$ select now() $$;

-- ---------------------------------------------------------------------------
-- Funções de largada/chegada (versão com fila offline)
--
-- O celular guarda o horário em que o botão foi apertado (p_at), já corrigido pelo
-- offset do relógio do servidor, e envia depois, quando houver sinal. O servidor
-- nunca aceita horário no futuro. As funções são idempotentes: reenviar a mesma
-- ação (ex.: a resposta se perdeu no sinal fraco) não duplica nada.
--
-- Códigos de erro próprios:
--   MTB01  piloto sem descida em andamento (o app aguarda a largada chegar e tenta de novo)
--   MTB02  piloto não cadastrado
--   MTB03  piloto já está na pista
--   MTB04  piloto já tem descida nesta especial
--   MTB05  especial não cadastrada
--   MTB06  a prova precisa de pelo menos uma especial
-- ---------------------------------------------------------------------------
drop function if exists start_run(text);
drop function if exists start_run(text, timestamptz, uuid);
drop function if exists finish_run(text);
drop function if exists finish_run(text, timestamptz);
drop function if exists dnf_run(uuid);

create or replace function start_run(
  p_num   text,
  p_at    timestamptz default null,
  p_id    uuid default gen_random_uuid(),
  p_stage text default null
) returns runs
language plpgsql as $$
declare
  v_name  text;
  v_stage stages;
  v_at    timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  r       runs;
begin
  -- Reenvio da mesma largada: devolve a que já existe
  select * into r from runs where id = p_id;
  if found then
    return r;
  end if;

  select name into v_name from riders where num = p_num;
  if not found then
    raise exception 'Piloto #% não cadastrado', p_num using errcode = 'MTB02';
  end if;

  if p_stage is null then
    select * into v_stage from stages order by position limit 1;
  else
    select * into v_stage from stages where id = p_stage;
  end if;
  if v_stage.id is null then
    raise exception 'Especial % não cadastrada', coalesce(p_stage, '(nenhuma)') using errcode = 'MTB05';
  end if;

  if exists (select 1 from runs where rider_num = p_num and status = 'track') then
    raise exception '% já está na pista', v_name using errcode = 'MTB03';
  end if;
  if exists (select 1 from runs where rider_num = p_num and stage_id = v_stage.id) then
    raise exception '% já possui descida na %', v_name, v_stage.name using errcode = 'MTB04';
  end if;

  insert into runs (id, rider_num, stage_id, started_at)
  values (p_id, p_num, v_stage.id, v_at)
  returning * into r;
  return r;
end $$;

create or replace function finish_run(
  p_num   text,
  p_at    timestamptz default null,
  p_stage text default null
) returns runs
language plpgsql as $$
declare
  v_name text;
  v_at   timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  r      runs;
begin
  select name into v_name from riders where num = p_num;
  if not found then
    raise exception 'Piloto #% não cadastrado', p_num using errcode = 'MTB02';
  end if;

  -- Reenvio da mesma chegada: devolve a que já foi registrada
  select * into r from runs
    where rider_num = p_num and status = 'done' and finished_at = greatest(v_at, started_at)
      and (p_stage is null or stage_id = p_stage)
    limit 1;
  if found then
    return r;
  end if;

  update runs
     set finished_at = greatest(v_at, started_at), status = 'done'
   where rider_num = p_num and status = 'track'
     and (p_stage is null or stage_id = p_stage)
   returning * into r;
  if not found then
    raise exception '% não está na pista', v_name using errcode = 'MTB01';
  end if;
  return r;
end $$;

-- DNF/desclassificação: vale para descida em andamento ou já concluída
create or replace function dnf_run(
  p_id uuid,
  p_at timestamptz default null
) returns void
language sql as $$
  update runs
     set finished_at = coalesce(finished_at, greatest(least(coalesce(p_at, clock_timestamp()), clock_timestamp()), started_at)),
         status = 'dnf'
   where id = p_id and status <> 'dnf'
$$;

-- Desfazer/excluir uma descida (o piloto pode largar de novo nessa especial)
create or replace function undo_run(p_id uuid) returns void
language sql as $$
  delete from runs where id = p_id
$$;

-- Excluir especial: apaga descidas e grade dela (cascade) e renumera as demais
create or replace function remove_stage(p_id text) returns void
language plpgsql as $$
begin
  if (select count(*) from stages) <= 1 then
    raise exception 'A prova precisa de pelo menos uma especial cadastrada' using errcode = 'MTB06';
  end if;
  delete from stages where id = p_id;
  update stages s set position = o.rn
    from (select id, row_number() over (order by position) as rn from stages) o
   where s.id = o.id;
end $$;

-- Substitui a grade de uma especial de uma vez (p_items: [{"num":"12","position":1,"at":"2026-…"}])
-- p_stage nulo limpa a grade de todas as especiais.
create or replace function set_start_grid(p_stage text, p_items jsonb default '[]'::jsonb) returns void
language plpgsql as $$
begin
  if p_stage is null then
    delete from start_grid where true;
    return;
  end if;
  if not exists (select 1 from stages where id = p_stage) then
    raise exception 'Especial não cadastrada' using errcode = 'MTB05';
  end if;
  delete from start_grid where stage_id = p_stage;
  insert into start_grid (stage_id, rider_num, position, scheduled_at)
  select p_stage, i->>'num', (i->>'position')::int, (i->>'at')::timestamptz
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i
   where exists (select 1 from riders where num = i->>'num');
end $$;

-- ---------------------------------------------------------------------------
-- Segurança (PROTÓTIPO): qualquer pessoa com o link pode ler e escrever.
-- Antes de abrir para o público, troque por autenticação (ver docs/ARQUITETURA.md).
-- ---------------------------------------------------------------------------
alter table categories enable row level security;
alter table riders     enable row level security;
alter table stages     enable row level security;
alter table runs       enable row level security;
alter table start_grid enable row level security;

drop policy if exists "prototype all categories" on categories;
drop policy if exists "prototype all riders"     on riders;
drop policy if exists "prototype all stages"     on stages;
drop policy if exists "prototype all runs"       on runs;
drop policy if exists "prototype all start_grid" on start_grid;
create policy "prototype all categories" on categories for all to anon using (true) with check (true);
create policy "prototype all riders"     on riders     for all to anon using (true) with check (true);
create policy "prototype all stages"     on stages     for all to anon using (true) with check (true);
create policy "prototype all runs"       on runs       for all to anon using (true) with check (true);
create policy "prototype all start_grid" on start_grid for all to anon using (true) with check (true);

-- Tempo real (ignora tabelas que já estão na publicação)
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
