-- Recursos de prova trazidos da comparação com o spetchrono:
--   penalidades, DNS/DSQ, quem registrou, distância e cores das especiais, cores das categorias,
--   histórico de alterações, organizadores geridos pela tela, TVs pareadas por código e imagens do telão.
-- Idempotente (pode rodar de novo). Aplique com: npm run db:push

-- ---------------------------------------------------------------------------
-- Descidas: novos estados, penalidade e quem registrou
-- ---------------------------------------------------------------------------
alter table runs drop constraint if exists runs_status_check;
alter table runs add constraint runs_status_check check (status in ('track', 'done', 'dnf', 'dns', 'dsq'));
alter table runs add column if not exists penalty_ms int not null default 0;
alter table runs add column if not exists started_by text;
alter table runs add column if not exists finished_by text;

-- Especiais e categorias: distância (km) e cor
alter table stages add column if not exists km numeric(6, 2);
alter table stages add column if not exists color text;
alter table categories add column if not exists color text;

-- Telão: segundos de cada imagem
alter table events add column if not exists tv_image_seconds int not null default 10;

-- ---------------------------------------------------------------------------
-- Largada e chegada com o nome de quem registrou (as versões antigas saem para não haver ambiguidade)
-- ---------------------------------------------------------------------------
drop function if exists start_run(uuid, text, timestamptz, uuid, text);
create or replace function start_run(
  p_event uuid,
  p_num   text,
  p_at    timestamptz default null,
  p_id    uuid default gen_random_uuid(),
  p_stage text default null,
  p_by    text default null
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

  insert into runs (id, event_id, rider_num, stage_id, started_at, started_by)
  values (p_id, p_event, p_num, v_stage.id, v_at, nullif(trim(p_by), ''))
  returning * into r;
  return r;
end $$;

drop function if exists finish_run(uuid, text, timestamptz, text);
create or replace function finish_run(
  p_event uuid,
  p_num   text,
  p_at    timestamptz default null,
  p_stage text default null,
  p_by    text default null
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
     set finished_at = greatest(v_at, started_at), status = 'done', finished_by = nullif(trim(p_by), '')
   where event_id = p_event and rider_num = p_num and status = 'track'
     and (p_stage is null or stage_id = p_stage)
   returning * into r;
  if not found then
    raise exception '% não está na pista', v_name using errcode = 'MTB01';
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Decisões da organização: DSQ numa descida, DNS (não largou) e penalidade
-- ---------------------------------------------------------------------------
create or replace function set_run_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := (select event_id from runs where id = p_id);
begin
  if v_event is null then
    return;
  end if;
  if p_status not in ('dnf', 'dsq', 'done') then
    raise exception 'Situação inválida: %', p_status using errcode = 'MTB06';
  end if;
  -- DNF pode vir do fiscal; DSQ e "voltar a valer" são decisão do organizador
  if p_status = 'dnf' and not can_write_event(v_event) or p_status <> 'dnf' and not is_organizer() then
    raise exception 'Sem permissão para mudar esta descida' using errcode = 'MTB08';
  end if;
  update runs
     set status = case when p_status = 'done' and finished_at is null then 'track' else p_status end,
         finished_at = case when p_status in ('dnf', 'dsq') then coalesce(finished_at, clock_timestamp()) else finished_at end
   where id = p_id;
end $$;

create or replace function mark_dns(p_event uuid, p_num text, p_stage text) returns runs
language plpgsql security definer set search_path = public as $$
declare
  r runs;
begin
  if not is_organizer() then
    raise exception 'Só o organizador marca DNS' using errcode = 'MTB08';
  end if;
  if exists (select 1 from runs where event_id = p_event and rider_num = p_num and stage_id = p_stage) then
    raise exception 'O piloto já tem descida nesta especial' using errcode = 'MTB04';
  end if;
  insert into runs (event_id, rider_num, stage_id, started_at, finished_at, status)
  values (p_event, p_num, p_stage, clock_timestamp(), clock_timestamp(), 'dns')
  returning * into r;
  return r;
end $$;

create or replace function set_penalty(p_id uuid, p_ms int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só o organizador aplica penalidades' using errcode = 'MTB08';
  end if;
  update runs set penalty_ms = greatest(0, p_ms) where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Histórico de alterações das descidas (quem, o quê, quando)
-- ---------------------------------------------------------------------------
create table if not exists run_log (
  id        bigint generated always as identity primary key,
  event_id  uuid not null references events(id) on delete cascade,
  at        timestamptz not null default clock_timestamp(),
  action    text not null,
  rider_num text,
  stage_id  text,
  detail    text,
  actor     text
);
create index if not exists run_log_event_idx on run_log (event_id, at desc);

create or replace function log_run_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row    runs := coalesce(new, old);
  v_actor  text;
  v_action text;
  v_detail text;
begin
  -- Quem: o nome que o fiscal informou; senão, o e-mail do organizador; senão, "fiscal"
  v_actor := coalesce(
    case when tg_op = 'UPDATE' and new.finished_by is distinct from old.finished_by then new.finished_by end,
    case when tg_op = 'INSERT' then new.started_by end,
    (select email from auth.users where id = auth.uid()),
    case when auth.uid() is null then 'sistema' else 'fiscal' end
  );
  if tg_op = 'INSERT' then
    v_action := case v_row.status when 'dns' then 'DNS' else 'Largada' end;
  elsif tg_op = 'DELETE' then
    v_action := 'Descida apagada';
    v_detail := old.status;
  elsif new.status is distinct from old.status then
    v_action := case
      when new.status = 'done' and old.status in ('dnf', 'dsq') then 'Volta a valer'
      when new.status = 'done' then 'Chegada'
      when new.status = 'dnf' then 'DNF'
      when new.status = 'dsq' then 'DSQ'
      else 'Situação'
    end;
    v_detail := old.status || ' → ' || new.status;
  elsif new.penalty_ms is distinct from old.penalty_ms then
    v_action := 'Penalidade';
    v_detail := '+' || (new.penalty_ms / 1000) || 's';
  else
    return null;
  end if;
  insert into run_log (event_id, action, rider_num, stage_id, detail, actor)
  values (v_row.event_id, v_action, v_row.rider_num, v_row.stage_id, v_detail, v_actor);
  return null;
end $$;

drop trigger if exists runs_log on runs;
create trigger runs_log after insert or update or delete on runs
  for each row execute function log_run_change();

-- ---------------------------------------------------------------------------
-- Organizadores geridos pela tela (antes era insert manual no banco)
-- ---------------------------------------------------------------------------
create or replace function list_organizers()
returns table (user_id uuid, email text, me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só organizadores veem a lista' using errcode = 'MTB08';
  end if;
  return query
    select o.user_id, u.email::text, o.user_id = auth.uid()
      from organizers o join auth.users u on u.id = o.user_id
     order by u.email;
end $$;

create or replace function add_organizer(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if not is_organizer() then
    raise exception 'Só organizadores adicionam organizadores' using errcode = 'MTB08';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Nenhuma conta com o e-mail %. Crie o usuário em Supabase > Authentication primeiro.', p_email using errcode = 'MTB07';
  end if;
  insert into organizers (user_id) values (v_user) on conflict do nothing;
end $$;

create or replace function remove_organizer(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só organizadores removem organizadores' using errcode = 'MTB08';
  end if;
  if p_user = auth.uid() then
    raise exception 'Você não pode remover o próprio acesso' using errcode = 'MTB08';
  end if;
  delete from organizers where user_id = p_user;
end $$;

-- ---------------------------------------------------------------------------
-- TVs pareadas por código: a TV mostra um código; o organizador escolhe o evento e o que ela exibe
-- ---------------------------------------------------------------------------
create table if not exists tv_screens (
  code       text primary key,
  event_id   uuid references events(id) on delete set null,
  panels     text[] not null default array['track', 'progress', 'standings'],
  scale      int not null default 100,
  seen_at    timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function tv_register(p_code text) returns tv_screens
language plpgsql security definer set search_path = public as $$
declare
  r tv_screens;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'Código de TV inválido' using errcode = 'MTB06';
  end if;
  insert into tv_screens (code) values (p_code)
  on conflict (code) do update set seen_at = now()
  returning * into r;
  return r;
end $$;

create or replace function tv_link(p_code text, p_event uuid, p_panels text[], p_scale int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer() then
    raise exception 'Só o organizador vincula TVs' using errcode = 'MTB08';
  end if;
  update tv_screens
     set event_id = p_event,
         panels = coalesce(p_panels, panels),
         scale = least(150, greatest(50, coalesce(p_scale, scale))),
         updated_at = now()
   where code = p_code;
  if not found then
    raise exception 'Nenhuma TV com o código %. Abra o modo TV na TV primeiro.', p_code using errcode = 'MTB07';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Imagens do telão (patrocinadores, mapa, avisos): arquivo no Storage, lista por evento
-- ---------------------------------------------------------------------------
create table if not exists tv_images (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  path       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('tv-images', 'tv-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Regras de acesso das tabelas novas
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public' and tablename in ('run_log', 'tv_screens', 'tv_images')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;

  alter table run_log enable row level security;
  alter table tv_screens enable row level security;
  alter table tv_images enable row level security;

  -- Histórico: só o organizador lê; só o gatilho escreve
  create policy "organizador lê o histórico" on run_log for select to authenticated using (is_organizer());

  -- TVs: qualquer um lê (a TV acompanha a própria linha); gravação só pelas funções
  create policy "ler telas" on tv_screens for select to anon, authenticated using (true);

  -- Imagens: leitura junto com o evento; o organizador cadastra e remove
  create policy "ler imagens do telão" on tv_images for select to anon, authenticated using (event_visible(event_id));
  create policy "organizador cria imagens do telão" on tv_images for insert to authenticated with check (is_organizer());
  create policy "organizador altera imagens do telão" on tv_images for update to authenticated using (is_organizer()) with check (is_organizer());
  create policy "organizador exclui imagens do telão" on tv_images for delete to authenticated using (is_organizer());
end $$;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'tv-images:%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
  create policy "tv-images: organizador envia" on storage.objects for insert to authenticated
    with check (bucket_id = 'tv-images' and public.is_organizer());
  create policy "tv-images: organizador apaga" on storage.objects for delete to authenticated
    using (bucket_id = 'tv-images' and public.is_organizer());
end $$;

-- Tempo real das tabelas novas
do $$
declare
  t text;
begin
  foreach t in array array['tv_screens', 'tv_images'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
