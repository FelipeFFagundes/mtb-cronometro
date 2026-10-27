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

-- Toda tabela da prova pertence a um evento. Linhas antigas vão para o primeiro evento.
-- Sem valor padrão: gravar sem dizer o evento é erro (a etapa 1 tinha um padrão para o app antigo).
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    execute format('alter table %I add column if not exists event_id uuid', t);
    execute format('update %I set event_id = first_event_id() where event_id is null', t);
    execute format('alter table %I alter column event_id drop default', t);
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

-- ---------------------------------------------------------------------------
-- Acesso
--
-- - Público: lê eventos que não são rascunho. Não precisa de login.
-- - Fiscal: entra com o código do fiscal do evento. O app faz login anônimo no Supabase
--   e chama join_event(código); o aparelho fica liberado para largada, chegada, DNF e
--   desfazer naquele evento enquanto ele estiver aberto.
-- - Organizador: login com e-mail e senha (Supabase Auth) e linha em organizers.
--   Cadastra tudo e gera os códigos. Para criar o primeiro organizador:
--     1. Supabase > Authentication > Users > Add user (e-mail e senha)
--     2. insert into organizers (user_id) select id from auth.users where email = 'seu@email';
-- ---------------------------------------------------------------------------
create table if not exists organizers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Aparelhos liberados como fiscal em cada evento
create table if not exists event_marshals (
  event_id  uuid not null references events(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Código do fiscal guardado só como hash (sem leitura pela API)
create table if not exists event_secrets (
  event_id     uuid primary key references events(id) on delete cascade,
  marshal_salt text not null,
  marshal_hash text not null,
  updated_at   timestamptz not null default now()
);

-- Tentativas erradas de código (limite por aparelho)
create table if not exists join_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on join_attempts (user_id, at);

create or replace function is_organizer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizers where user_id = auth.uid())
$$;

-- Pode registrar largada/chegada no evento: organizador, ou fiscal do evento enquanto ele estiver aberto
create or replace function can_write_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_organizer() or exists (
    select 1 from event_marshals m join events e on e.id = m.event_id
     where m.event_id = p_event and m.user_id = auth.uid() and e.status = 'aberto'
  )
$$;

-- Evento visível para quem está lendo (rascunho só para organizador)
create or replace function event_visible(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = p_event and status <> 'rascunho') or is_organizer()
$$;

-- Papel do aparelho no evento: 'organizer', 'marshal' ou 'public'
create or replace function my_access(p_event uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when is_organizer() then 'organizer'
    when can_write_event(p_event) then 'marshal'
    else 'public'
  end
$$;

-- Normaliza o código digitado: só letras e números, em maiúsculas ("7kq-4m2" → "7KQ4M2")
create or replace function normalize_code(p_code text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')) $$;

create or replace function hash_code(p_salt text, p_code text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_salt || normalize_code(p_code), 'UTF8')), 'hex') $$;

-- Gera (ou troca) o código do fiscal do evento e devolve o código, que não fica guardado em texto.
-- p_revoke: tira o acesso dos aparelhos que entraram com o código anterior.
-- Erros: MTB08 sem permissão, MTB07 evento não encontrado.
create or replace function set_marshal_code(p_event uuid, p_revoke boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  -- 32 símbolos sem os ambíguos (0/O, 1/I): cada byte aleatório vira um símbolo sem viés
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code  text := '';
  v_salt  text := replace(gen_random_uuid()::text, '-', '');
begin
  if not is_organizer() then
    raise exception 'Só o organizador pode gerar o código do fiscal' using errcode = 'MTB08';
  end if;
  if not exists (select 1 from events where id = p_event) then
    raise exception 'Evento não encontrado' using errcode = 'MTB07';
  end if;
  -- Bytes 0 a 5 do UUID v4 são totalmente aleatórios
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;

  insert into event_secrets (event_id, marshal_salt, marshal_hash, updated_at)
  values (p_event, v_salt, hash_code(v_salt, v_code), now())
  on conflict (event_id) do update
    set marshal_salt = excluded.marshal_salt, marshal_hash = excluded.marshal_hash, updated_at = now();

  if p_revoke then
    delete from event_marshals where event_id = p_event;
  end if;
  return substr(v_code, 1, 3) || '-' || substr(v_code, 4, 3);
end $$;

-- Situação do acesso do evento (para a tela do organizador)
create or replace function event_access_info(p_event uuid)
returns table (has_code boolean, code_updated_at timestamptz, marshals int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só o organizador pode ver o acesso do evento' using errcode = 'MTB08';
  end if;
  return query
    select exists (select 1 from event_secrets s where s.event_id = p_event),
           (select s.updated_at from event_secrets s where s.event_id = p_event),
           (select count(*)::int from event_marshals m where m.event_id = p_event);
end $$;

-- Fiscal entra com o código. Devolve o evento liberado, ou null se o código estiver errado
-- (devolve null em vez de erro para que a tentativa errada fique registrada).
-- Erros: MTB08 sem login, MTB09 muitas tentativas erradas.
create or replace function join_event(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_event uuid;
begin
  if v_uid is null then
    raise exception 'Sem sessão: abra o app com internet e tente de novo' using errcode = 'MTB08';
  end if;
  if (select count(*) from join_attempts where user_id = v_uid and at > now() - interval '10 minutes') >= 5 then
    raise exception 'Muitas tentativas erradas. Aguarde 10 minutos.' using errcode = 'MTB09';
  end if;

  select s.event_id into v_event
    from event_secrets s join events e on e.id = s.event_id
   where e.status = 'aberto' and s.marshal_hash = hash_code(s.marshal_salt, p_code)
   order by e.starts_on desc
   limit 1;

  if v_event is null then
    insert into join_attempts (user_id) values (v_uid);
    return null;
  end if;

  insert into event_marshals (event_id, user_id) values (v_event, v_uid) on conflict do nothing;
  delete from join_attempts where user_id = v_uid;
  return v_event;
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
-- Rodam com permissão do dono (security definer) e conferem antes quem está chamando.
--
-- Códigos de erro próprios:
--   MTB01  piloto sem descida em andamento (o app aguarda a largada chegar e tenta de novo)
--   MTB02  piloto não cadastrado
--   MTB03  piloto já está na pista
--   MTB04  piloto já tem descida nesta especial
--   MTB05  especial não cadastrada
--   MTB06  a prova precisa de pelo menos uma especial
--   MTB07  evento não encontrado
--   MTB08  sem permissão (entre com o código do fiscal ou como organizador)
--   MTB09  muitas tentativas erradas de código
-- ---------------------------------------------------------------------------
drop function if exists start_run(text);
drop function if exists start_run(text, timestamptz, uuid);
drop function if exists finish_run(text);
drop function if exists finish_run(text, timestamptz);
drop function if exists dnf_run(uuid);
-- Versões sem evento (compatibilidade da etapa 1): sem login não há mais como gravar
drop function if exists start_run(text, timestamptz, uuid, text);
drop function if exists finish_run(text, timestamptz, text);
drop function if exists remove_stage(text);
drop function if exists set_start_grid(text, jsonb);

create or replace function start_run(
  p_event uuid,
  p_num   text,
  p_at    timestamptz default null,
  p_id    uuid default gen_random_uuid(),
  p_stage text default null
) returns runs
language plpgsql security definer set search_path = public as $$
declare
  v_name  text;
  v_stage stages;
  v_at    timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  r       runs;
begin
  if not can_write_event(p_event) then
    raise exception 'Sem permissão para registrar neste evento' using errcode = 'MTB08';
  end if;

  -- Reenvio da mesma largada: devolve a que já existe
  select * into r from runs where id = p_id and event_id = p_event;
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
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_at   timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  r      runs;
begin
  if not can_write_event(p_event) then
    raise exception 'Sem permissão para registrar neste evento' using errcode = 'MTB08';
  end if;

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
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := (select event_id from runs where id = p_id);
begin
  if v_event is null then
    return; -- já foi desfeita
  end if;
  if not can_write_event(v_event) then
    raise exception 'Sem permissão para registrar neste evento' using errcode = 'MTB08';
  end if;
  update runs
     set finished_at = coalesce(finished_at, greatest(least(coalesce(p_at, clock_timestamp()), clock_timestamp()), started_at)),
         status = 'dnf'
   where id = p_id and status <> 'dnf';
end $$;

-- Desfazer/excluir uma descida (o piloto pode largar de novo nessa especial)
create or replace function undo_run(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := (select event_id from runs where id = p_id);
begin
  if v_event is null then
    return; -- já foi desfeita
  end if;
  if not can_write_event(v_event) then
    raise exception 'Sem permissão para registrar neste evento' using errcode = 'MTB08';
  end if;
  delete from runs where id = p_id;
end $$;

-- Excluir especial: apaga descidas e grade dela (cascade) e renumera as demais do evento
create or replace function remove_stage(p_event uuid, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só o organizador pode excluir especiais' using errcode = 'MTB08';
  end if;
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
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só o organizador pode mudar a grade' using errcode = 'MTB08';
  end if;
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
-- Regras de acesso (RLS)
-- Leitura: qualquer pessoa, em eventos que não são rascunho.
-- Escrita direta nas tabelas: só organizador. Fiscal grava só pelas funções acima.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  -- Remove todas as regras anteriores (inclusive as abertas do protótipo)
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('events', 'categories', 'riders', 'stages', 'runs', 'start_grid',
                         'organizers', 'event_marshals', 'event_secrets', 'join_attempts')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;

  foreach t in array array['events', 'categories', 'riders', 'stages', 'runs', 'start_grid',
                           'organizers', 'event_marshals', 'event_secrets', 'join_attempts'] loop
    execute format('alter table %I enable row level security', t);
  end loop;

  -- Eventos
  create policy "ler eventos" on events for select to anon, authenticated
    using (status <> 'rascunho' or is_organizer());
  create policy "organizador cria eventos" on events for insert to authenticated with check (is_organizer());
  create policy "organizador altera eventos" on events for update to authenticated using (is_organizer()) with check (is_organizer());
  create policy "organizador exclui eventos" on events for delete to authenticated using (is_organizer());

  -- Dados da prova
  foreach t in array array['categories', 'riders', 'stages', 'runs', 'start_grid'] loop
    execute format('create policy %I on %I for select to anon, authenticated using (event_visible(event_id))', 'ler ' || t, t);
    execute format('create policy %I on %I for insert to authenticated with check (is_organizer())', 'organizador cria ' || t, t);
    execute format('create policy %I on %I for update to authenticated using (is_organizer()) with check (is_organizer())', 'organizador altera ' || t, t);
    execute format('create policy %I on %I for delete to authenticated using (is_organizer())', 'organizador exclui ' || t, t);
  end loop;

  -- Cada um vê só a própria linha; event_secrets e join_attempts ficam sem regra (só as funções acessam)
  create policy "ver o próprio cadastro de organizador" on organizers for select to authenticated using (user_id = auth.uid());
  create policy "ver os próprios acessos de fiscal" on event_marshals for select to authenticated using (user_id = auth.uid());
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
