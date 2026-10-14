-- MTB Cronômetro - esquema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- É seguro rodar de novo: atualiza as funções sem apagar pilotos nem tempos.

create table if not exists riders (
  num      text primary key,
  name     text not null,
  category text not null
);

create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  rider_num   text not null references riders(num) on delete cascade on update cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'track' check (status in ('track', 'done', 'dnf'))
);

-- Um piloto só pode ter uma descida em andamento por vez
create unique index if not exists one_open_run_per_rider
  on runs (rider_num) where status = 'track';

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
-- ---------------------------------------------------------------------------
drop function if exists start_run(text);
drop function if exists finish_run(text);
drop function if exists dnf_run(uuid);

create or replace function start_run(
  p_num text,
  p_at  timestamptz default null,
  p_id  uuid default gen_random_uuid()
) returns runs
language plpgsql as $$
declare
  v_name text;
  v_at   timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  r      runs;
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
  if exists (select 1 from runs where rider_num = p_num and status = 'track') then
    raise exception '% já está na pista', v_name using errcode = 'MTB03';
  end if;

  insert into runs (id, rider_num, started_at) values (p_id, p_num, v_at) returning * into r;
  return r;
end $$;

create or replace function finish_run(
  p_num text,
  p_at  timestamptz default null
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
    where rider_num = p_num and status = 'done' and finished_at = v_at
    limit 1;
  if found then
    return r;
  end if;

  update runs
     set finished_at = greatest(v_at, started_at), status = 'done'
   where rider_num = p_num and status = 'track'
   returning * into r;
  if not found then
    raise exception '% não está na pista', v_name using errcode = 'MTB01';
  end if;
  return r;
end $$;

create or replace function dnf_run(
  p_id uuid,
  p_at timestamptz default null
) returns void
language sql as $$
  update runs
     set finished_at = greatest(least(coalesce(p_at, clock_timestamp()), clock_timestamp()), started_at),
         status = 'dnf'
   where id = p_id and status = 'track'
$$;

-- Segurança (PROTÓTIPO): qualquer pessoa com o link pode ler e escrever.
-- Antes de abrir para o público, troque por autenticação (ex.: PIN do evento).
alter table riders enable row level security;
alter table runs   enable row level security;

drop policy if exists "prototype all riders" on riders;
drop policy if exists "prototype all runs"   on runs;
create policy "prototype all riders" on riders for all to anon using (true) with check (true);
create policy "prototype all runs"   on runs   for all to anon using (true) with check (true);

-- Tempo real (ignora se as tabelas já estiverem na publicação)
do $$
begin
  begin
    alter publication supabase_realtime add table riders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table runs;
  exception when duplicate_object then null;
  end;
end $$;
