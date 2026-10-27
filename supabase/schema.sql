-- MTB Cronômetro - esquema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- É seguro rodar de novo: cria o que falta e atualiza as funções sem apagar pilotos nem tempos.
--
-- Migrações automáticas:
-- - Bancos sem especiais: as descidas existentes vão para a primeira especial.
-- - Bancos de uma prova só (antes dos eventos): tudo vai para o evento "Prova atual".

-- ---------------------------------------------------------------------------
-- Eventos (cada prova tem as próprias categorias, pilotos, especiais, descidas e grade)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  starts_on   date not null default current_date,
  location    text,
  status      text not null default 'aberto' check (status in ('rascunho', 'aberto', 'encerrado')),
  public_code text unique,
  created_at  timestamptz not null default now()
);

insert into events (name)
select 'Prova atual'
where not exists (select 1 from events);

-- Evento mais antigo: destino dos dados migrados e das chamadas de versões antigas do app
create or replace function first_event_id() returns uuid
language sql stable as $$ select id from events order by created_at, id limit 1 $$;

-- ---------------------------------------------------------------------------
-- Tabelas da prova (formato mínimo; event_id e chaves são acertados logo abaixo)
-- ---------------------------------------------------------------------------
create table if not exists categories (
  name text not null
);

create table if not exists riders (
  num      text not null,
  name     text not null,
  category text not null
);

-- Especiais (trilhas cronometradas)
create table if not exists stages (
  id       text not null,
  name     text not null,
  position int  not null
);

create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  rider_num   text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'track' check (status in ('track', 'done', 'dnf'))
);
alter table runs add column if not exists stage_id text;

-- Ordem de largada por especial (nome e categoria vêm de riders)
create table if not exists start_grid (
  stage_id     text not null,
  rider_num    text not null,
  position     int  not null,
  scheduled_at timestamptz not null
);

-- Toda tabela da prova pertence a um evento. Linhas antigas vão para o primeiro evento;
-- o valor padrão mantém funcionando as versões antigas do app, que não enviam event_id.
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    execute format('alter table %I add column if not exists event_id uuid', t);
    execute format('update %I set event_id = first_event_id() where event_id is null', t);
    execute format('alter table %I alter column event_id set default first_event_id()', t);
    execute format('alter table %I alter column event_id set not null', t);
  end loop;
end $$;

-- Dados iniciais só em banco novo (não recria o que foi excluído)
insert into categories (event_id, name)
select first_event_id(), c from (values ('Elite Masculino'), ('Elite Feminino')) as v(c)
where not exists (select 1 from categories);

insert into stages (event_id, id, name, position)
select first_event_id(), v.* from (values ('stage-1', 'E1', 1), ('stage-2', 'E2', 2), ('stage-3', 'E3', 3)) as v(id, name, position)
where not exists (select 1 from stages);

-- Descidas de bancos sem especiais vão para a primeira especial do evento
update runs r
   set stage_id = (select s.id from stages s where s.event_id = r.event_id order by s.position limit 1)
 where r.stage_id is null;
alter table runs alter column stage_id set not null;

-- ---------------------------------------------------------------------------
-- Chaves: placa, categoria e especial são únicas dentro do evento (outro evento
-- pode ter a mesma placa 12). Recriadas a cada execução para migrar as antigas.
-- ---------------------------------------------------------------------------
alter table runs       drop constraint if exists runs_rider_num_fkey;
alter table runs       drop constraint if exists runs_stage_id_fkey;
alter table runs       drop constraint if exists runs_rider_fkey;
alter table runs       drop constraint if exists runs_stage_fkey;
alter table start_grid drop constraint if exists start_grid_rider_num_fkey;
alter table start_grid drop constraint if exists start_grid_stage_id_fkey;
alter table start_grid drop constraint if exists start_grid_rider_fkey;
alter table start_grid drop constraint if exists start_grid_stage_fkey;

alter table categories drop constraint if exists categories_pkey;
alter table riders     drop constraint if exists riders_pkey;
alter table stages     drop constraint if exists stages_pkey;
alter table start_grid drop constraint if exists start_grid_pkey;

alter table categories add constraint categories_pkey primary key (event_id, name);
alter table riders     add constraint riders_pkey     primary key (event_id, num);
alter table stages     add constraint stages_pkey     primary key (event_id, id);
alter table start_grid add constraint start_grid_pkey primary key (event_id, stage_id, rider_num);

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_event_fkey');
    execute format('alter table %I add constraint %I foreign key (event_id) references events(id) on delete cascade', t, t || '_event_fkey');
  end loop;
end $$;

alter table runs add constraint runs_rider_fkey foreign key (event_id, rider_num)
  references riders (event_id, num) on delete cascade on update cascade;
alter table runs add constraint runs_stage_fkey foreign key (event_id, stage_id)
  references stages (event_id, id) on delete cascade on update cascade;
alter table start_grid add constraint start_grid_rider_fkey foreign key (event_id, rider_num)
  references riders (event_id, num) on delete cascade on update cascade;
alter table start_grid add constraint start_grid_stage_fkey foreign key (event_id, stage_id)
  references stages (event_id, id) on delete cascade on update cascade;

drop index if exists runs_stage_idx;
create index runs_stage_idx on runs (event_id, stage_id);

-- Um piloto só pode estar na pista em um lugar por vez (dentro do evento)
drop index if exists one_open_run_per_rider;
create unique index one_open_run_per_rider on runs (event_id, rider_num) where status = 'track';

-- Uma descida por piloto em cada especial. Bancos antigos podem ter repetições
-- (antes tudo caía na mesma especial): nesse caso o índice não é criado e as
-- funções abaixo continuam bloqueando novas repetições.
drop index if exists one_run_per_rider_stage;
do $$
begin
  create unique index one_run_per_rider_stage on runs (event_id, rider_num, stage_id);
exception when unique_violation then
  raise notice 'Há descidas repetidas na mesma especial; índice one_run_per_rider_stage não criado.';
end $$;

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
--   MTB07  evento não encontrado
-- ---------------------------------------------------------------------------
drop function if exists start_run(text);
drop function if exists start_run(text, timestamptz, uuid);
drop function if exists finish_run(text);
drop function if exists finish_run(text, timestamptz);
drop function if exists dnf_run(uuid);

create or replace function start_run(
  p_event uuid,
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

  if not exists (select 1 from events where id = p_event) then
    raise exception 'Evento não encontrado' using errcode = 'MTB07';
  end if;

  select name into v_name from riders where event_id = p_event and num = p_num;
  if not found then
    raise exception 'Piloto #% não cadastrado', p_num using errcode = 'MTB02';
  end if;

  if p_stage is null then
    select * into v_stage from stages where event_id = p_event order by position limit 1;
  else
    select * into v_stage from stages where event_id = p_event and id = p_stage;
  end if;
  if v_stage.id is null then
    raise exception 'Especial % não cadastrada', coalesce(p_stage, '(nenhuma)') using errcode = 'MTB05';
  end if;

  if exists (select 1 from runs where event_id = p_event and rider_num = p_num and status = 'track') then
    raise exception '% já está na pista', v_name using errcode = 'MTB03';
  end if;
  if exists (select 1 from runs where event_id = p_event and rider_num = p_num and stage_id = v_stage.id) then
    raise exception '% já possui descida na %', v_name, v_stage.name using errcode = 'MTB04';
  end if;

  insert into runs (id, event_id, rider_num, stage_id, started_at)
  values (p_id, p_event, p_num, v_stage.id, v_at)
  returning * into r;
  return r;
end $$;

create or replace function finish_run(
  p_event uuid,
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
  select name into v_name from riders where event_id = p_event and num = p_num;
  if not found then
    raise exception 'Piloto #% não cadastrado', p_num using errcode = 'MTB02';
  end if;

  -- Reenvio da mesma chegada: devolve a que já foi registrada
  select * into r from runs
    where event_id = p_event and rider_num = p_num and status = 'done' and finished_at = greatest(v_at, started_at)
      and (p_stage is null or stage_id = p_stage)
    limit 1;
  if found then
    return r;
  end if;

  update runs
     set finished_at = greatest(v_at, started_at), status = 'done'
   where event_id = p_event and rider_num = p_num and status = 'track'
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

-- Excluir especial: apaga descidas e grade dela (cascade) e renumera as demais do evento
create or replace function remove_stage(p_event uuid, p_id text) returns void
language plpgsql as $$
begin
  if (select count(*) from stages where event_id = p_event) <= 1 then
    raise exception 'A prova precisa de pelo menos uma especial cadastrada' using errcode = 'MTB06';
  end if;
  delete from stages where event_id = p_event and id = p_id;
  update stages s set position = o.rn
    from (select id, row_number() over (order by position) as rn from stages where event_id = p_event) o
   where s.event_id = p_event and s.id = o.id;
end $$;

-- Substitui a grade de uma especial de uma vez (p_items: [{"num":"12","position":1,"at":"2026-…"}])
-- p_stage nulo limpa a grade de todas as especiais do evento.
create or replace function set_start_grid(p_event uuid, p_stage text, p_items jsonb default '[]'::jsonb) returns void
language plpgsql as $$
begin
  if p_stage is null then
    delete from start_grid where event_id = p_event;
    return;
  end if;
  if not exists (select 1 from stages where event_id = p_event and id = p_stage) then
    raise exception 'Especial não cadastrada' using errcode = 'MTB05';
  end if;
  delete from start_grid where event_id = p_event and stage_id = p_stage;
  insert into start_grid (event_id, stage_id, rider_num, position, scheduled_at)
  select p_event, p_stage, i->>'num', (i->>'position')::int, (i->>'at')::timestamptz
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i
   where exists (select 1 from riders where event_id = p_event and num = i->>'num');
end $$;

-- ---------------------------------------------------------------------------
-- Compatibilidade: versões antigas do app (ainda em cache nos celulares) chamam as
-- funções sem o evento. Elas passam a valer para o primeiro evento ("Prova atual").
-- ---------------------------------------------------------------------------
create or replace function start_run(
  p_num   text,
  p_at    timestamptz default null,
  p_id    uuid default gen_random_uuid(),
  p_stage text default null
) returns runs
language sql as $$ select start_run(first_event_id(), p_num, p_at, p_id, p_stage) $$;

create or replace function finish_run(
  p_num   text,
  p_at    timestamptz default null,
  p_stage text default null
) returns runs
language sql as $$ select finish_run(first_event_id(), p_num, p_at, p_stage) $$;

create or replace function remove_stage(p_id text) returns void
language sql as $$ select remove_stage(first_event_id(), p_id) $$;

create or replace function set_start_grid(p_stage text, p_items jsonb default '[]'::jsonb) returns void
language sql as $$ select set_start_grid(first_event_id(), p_stage, p_items) $$;

-- ---------------------------------------------------------------------------
-- Segurança (PROTÓTIPO): qualquer pessoa com o link pode ler e escrever.
-- Antes de abrir para o público, troque por autenticação (ver docs/PLANO-EVENTOS.md, etapa 2).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['events', 'categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'prototype all ' || t, t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', 'prototype all ' || t, t);
  end loop;
end $$;

-- Tempo real (ignora tabelas que já estão na publicação)
do $$
declare
  t text;
begin
  foreach t in array array['events', 'categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
