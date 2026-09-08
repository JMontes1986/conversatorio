-- Conversatorio Colgemelli: ejecutar completo en Supabase > SQL Editor.
-- Reejecutable sin borrar datos. Los registros conservan su estructura en data JSONB.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'judge', 'moderator')),
  subject_id text,
  display_name text not null,
  identifier text,
  created_at timestamptz not null default now(),
  unique (role, subject_id),
  check ((role = 'admin' and subject_id is null) or (role <> 'admin' and subject_id is not null))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles for select to authenticated using (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['schools','judges','moderators','scores','rounds','rubric','questions',
    'student_questions','survey_responses','site_content','settings','debate_state','draw_state','tiebreak','audit_logs'] loop
    execute format('create table if not exists public.%I (
      id text primary key default gen_random_uuid()::text,
      data jsonb not null default ''{}''::jsonb check (jsonb_typeof(data) = ''object''),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create index if not exists %I on public.%I (created_at, id)', t || '_created_at_idx', t);
  end loop;
end $$;

create unique index if not exists judges_cedula_unique on public.judges ((lower(data->>'cedula')));
create unique index if not exists moderators_username_unique on public.moderators ((lower(data->>'username')));
create unique index if not exists scores_judge_match_unique on public.scores ((data->>'judgeId'), (data->>'matchId'))
  where data->>'judgeId' <> 'system';
create index if not exists scores_match_idx on public.scores ((data->>'matchId'));
create index if not exists schools_status_idx on public.schools ((data->>'status'));
create unique index if not exists rounds_name_unique on public.rounds ((data->>'name'));

-- Los roles se consultan en la base de datos: desactivar una cuenta invalida sus permisos de inmediato.
create or replace function private.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or (p.role = 'judge' and exists (select 1 from public.judges j where j.id = p.subject_id and j.data->>'status' = 'active'))
    or (p.role = 'moderator' and exists (select 1 from public.moderators m where m.id = p.subject_id and m.data->>'status' = 'active'))
  );
$$;
create or replace function private.subject_id() returns text
language sql stable security definer set search_path = '' as $$
  select subject_id from public.profiles where id = auth.uid() and private.app_role() is not null;
$$;
create or replace function public.current_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid() and private.app_role() is not null;
$$;
revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;

create or replace function private.score_is_published(match_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rounds r cross join public.settings s
    where s.id = 'competition'
      and (match_name = r.data->>'name' or starts_with(match_name, (r.data->>'name') || '-bye-'))
      and case r.data->>'phase'
        when 'Fase de Grupos' then s.data->>'groupStageResultsPublished' = 'true'
        when 'Fase de semifinal' then s.data->>'semifinalsResultsPublished' = 'true'
        when 'Fase de semifinales' then s.data->>'semifinalsResultsPublished' = 'true'
        when 'Fase de Finales' then s.data->>'finalsResultsPublished' = 'true'
        else false end
  );
$$;

-- Administrador: gestión completa. Auditoría: solo insertar/consultar.
do $$
declare t text;
begin
  foreach t in array array['schools','judges','moderators','scores','rounds','rubric','questions',
    'student_questions','survey_responses','site_content','settings','debate_state','draw_state','tiebreak'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated
      using ((select private.app_role()) = ''admin'') with check ((select private.app_role()) = ''admin'')', t);
  end loop;
  foreach t in array array['questions','debate_state','draw_state','tiebreak','student_questions'] loop
    execute format('drop policy if exists moderator_manage on public.%I', t);
    execute format('create policy moderator_manage on public.%I for all to authenticated
      using ((select private.app_role()) = ''moderator'') with check ((select private.app_role()) = ''moderator'')', t);
  end loop;
  foreach t in array array['rounds','rubric','site_content','settings','debate_state','draw_state','tiebreak'] loop
    execute format('grant select on public.%I to anon', t);
    execute format('drop policy if exists public_read on public.%I', t);
    execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists moderator_schools on public.schools;
create policy moderator_schools on public.schools for select to authenticated using ((select private.app_role()) = 'moderator');
drop policy if exists moderator_scores on public.scores;
create policy moderator_scores on public.scores for select to authenticated using ((select private.app_role()) = 'moderator');
drop policy if exists moderator_system_score on public.scores;
create policy moderator_system_score on public.scores for insert to authenticated
  with check ((select private.app_role()) = 'moderator' and data->>'judgeId' = 'system');
drop policy if exists judge_scores on public.scores;
create policy judge_scores on public.scores for select to authenticated
  using ((select private.app_role()) = 'judge' and data->>'judgeId' = (select private.subject_id()));
drop policy if exists judge_submit on public.scores;
create policy judge_submit on public.scores for insert to authenticated
  with check ((select private.app_role()) = 'judge' and data->>'judgeId' = (select private.subject_id()));
grant select on public.scores to anon;
drop policy if exists published_scores on public.scores;
create policy published_scores on public.scores for select to anon, authenticated
  using (private.score_is_published(data->>'matchId'));

grant select on public.questions to anon;
drop policy if exists active_question on public.questions;
create policy active_question on public.questions for select to anon, authenticated
  using (id = (select data->>'questionId' from public.debate_state where id = 'current'));

grant insert on public.student_questions, public.survey_responses to anon;
drop policy if exists public_question_submit on public.student_questions;
create policy public_question_submit on public.student_questions for insert to anon, authenticated with check (
  data->>'status' = 'pending' and length(trim(data->>'name')) between 1 and 200
  and length(trim(data->>'text')) between 1 and 3000
  and exists (select 1 from public.debate_state d where d.id = 'current' and d.data->>'isQrEnabled' = 'true'
    and d.data->>'questionId' = student_questions.data->>'relatedDebateQuestionId')
);
drop policy if exists public_survey_submit on public.survey_responses;
create policy public_survey_submit on public.survey_responses for insert to anon, authenticated with check (
  jsonb_typeof(data->'answers') = 'object' and coalesce(data->>'isAdminSubmission', 'false') = 'false'
  and exists (select 1 from public.site_content c where c.id = 'survey' and c.data->>'isActive' = 'true')
);
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using ((select private.app_role()) = 'admin');
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated with check ((select private.app_role()) in ('admin','moderator'));

-- Fechas de servidor y normalización de campos usados por los componentes existentes.
create or replace function private.prepare_document() returns trigger
language plpgsql set search_path = '' as $$
declare k text; v jsonb; stamp jsonb;
begin
  stamp := jsonb_build_object('seconds', floor(extract(epoch from now())), 'nanoseconds', 0);
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.id := old.id;
  else
    if new.data->'createdAt' ? 'seconds' then
      new.created_at := to_timestamp((new.data->'createdAt'->>'seconds')::double precision);
    else
      new.data := new.data || jsonb_build_object('createdAt', stamp);
    end if;
  end if;
  new.updated_at := now();
  for k,v in select * from jsonb_each(new.data) loop
    if v = '{"__serverTimestamp":true}'::jsonb then new.data := jsonb_set(new.data, array[k], stamp); end if;
  end loop;
  if tg_table_name = 'audit_logs' then
    new.data := new.data || jsonb_build_object('timestamp', stamp, 'actorId', auth.uid());
  end if;
  if tg_table_name = 'scores' then new.data := new.data - 'judgeCedula'; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['schools','judges','moderators','scores','rounds','rubric','questions',
    'student_questions','survey_responses','site_content','settings','debate_state','draw_state','tiebreak','audit_logs'] loop
    execute format('drop trigger if exists prepare_document on public.%I', t);
    execute format('create trigger prepare_document before insert or update on public.%I for each row execute function private.prepare_document()', t);
  end loop;
end $$;

-- Un jurado solo puntúa la ronda/equipos activos, con valores 1..5 por criterio.
-- Los totales y su identidad se obtienen del servidor; no se confía en el formulario.
create or replace function private.validate_judge_score() returns trigger
language plpgsql security definer set search_path = '' as $$
declare state jsonb; team jsonb; criterion record; detail jsonb; value numeric; total numeric;
  totals jsonb := '[]'; details jsonb := '[]'; expected integer;
begin
  if private.app_role() is distinct from 'judge' then return new; end if;
  select data into state from public.debate_state where id = 'current';
  if new.data->>'matchId' is distinct from state->>'currentRound' or coalesce(state->>'currentRound','') = '' then
    raise exception 'La ronda activa cambió. Actualiza el formulario.';
  end if;
  select count(*) into expected from public.rubric;
  if expected = 0 or jsonb_typeof(new.data->'fullScores') is distinct from 'array'
    or jsonb_typeof(state->'teams') is distinct from 'array' then raise exception 'Puntuación incompleta.'; end if;
  if jsonb_array_length(state->'teams') < 2 or jsonb_array_length(new.data->'fullScores') <> jsonb_array_length(state->'teams') then
    raise exception 'Equipos no válidos.';
  end if;
  for team in select * from jsonb_array_elements(state->'teams') loop
    if (select count(*) from jsonb_array_elements(new.data->'fullScores') d where d->>'name' = team->>'name') <> 1 then
      raise exception 'Faltan equipos o hay equipos duplicados.';
    end if;
    select d into detail from jsonb_array_elements(new.data->'fullScores') d where d->>'name' = team->>'name';
    if jsonb_typeof(detail->'scores') is distinct from 'object' then raise exception 'Faltan criterios.'; end if;
    if (select count(*) from jsonb_object_keys(detail->'scores')) <> expected then raise exception 'La rúbrica cambió.'; end if;
    total := 0;
    for criterion in select id from public.rubric loop
      if jsonb_typeof(detail->'scores'->criterion.id) is distinct from 'number' then raise exception 'Criterio inválido.'; end if;
      value := (detail->'scores'->>criterion.id)::numeric;
      if value < 1 or value > 5 or value <> trunc(value) then raise exception 'Cada puntuación debe estar entre 1 y 5.'; end if;
      total := total + value;
    end loop;
    totals := totals || jsonb_build_array(jsonb_build_object('name', team->>'name', 'total', total));
    details := details || jsonb_build_array(detail || jsonb_build_object('total', total));
  end loop;
  new.data := new.data || jsonb_build_object('judgeId', private.subject_id(),
    'judgeName', (select display_name from public.profiles where id = auth.uid()),
    'teams', totals, 'fullScores', details,
    'createdAt', jsonb_build_object('seconds', floor(extract(epoch from now())), 'nanoseconds', 0));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists validate_judge_score on public.scores;
create trigger validate_judge_score before insert on public.scores for each row execute function private.validate_judge_score();

-- Merge recursivo: evita sobrescribir campos simultáneos del temporizador/debate.
create or replace function private.jsonb_merge(base jsonb, patch jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb := base; k text; v jsonb;
begin
  for k,v in select * from jsonb_each(patch) loop
    if jsonb_typeof(v) = 'object' and v <> '{}'::jsonb and jsonb_typeof(result->k) = 'object' then
      result := jsonb_set(result, array[k], private.jsonb_merge(result->k, v));
    else result := jsonb_set(result, array[k], v); end if;
  end loop;
  return result;
end $$;

-- SECURITY INVOKER: las políticas RLS se aplican también a lotes y RPC.
create or replace function public.write_documents(operations jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare op jsonb; t text; affected integer;
begin
  if jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations) > 10000 then raise exception 'Lote no válido.'; end if;
  for op in select * from jsonb_array_elements(operations) loop
    t := op->>'table';
    if t is null or t <> all(array['schools','judges','moderators','scores','rounds','rubric','questions',
      'student_questions','survey_responses','site_content','settings','debate_state','draw_state','tiebreak','audit_logs']) then
      raise exception 'Tabla no válida.';
    end if;
    if coalesce(op->>'id','') = '' then raise exception 'ID requerido.'; end if;
    case op->>'operation'
      when 'insert' then execute format('insert into public.%I (id,data) values ($1,$2)', t) using op->>'id', op->'data';
      when 'set' then execute format('insert into public.%I (id,data) values ($1,$2) on conflict(id) do update set data = excluded.data', t) using op->>'id', op->'data';
      when 'merge' then execute format('insert into public.%I as target (id,data) values ($1,$2) on conflict(id) do update set data = private.jsonb_merge(target.data,$2)', t) using op->>'id', op->'data';
      when 'update' then
        execute format('update public.%I set data = data || $2 where id = $1', t) using op->>'id', op->'data';
        get diagnostics affected = row_count;
        if affected = 0 then raise exception 'Registro no encontrado o sin permiso.'; end if;
      when 'delete' then execute format('delete from public.%I where id = $1', t) using op->>'id';
      else raise exception 'Operación no válida.';
    end case;
  end loop;
end $$;
revoke all on function public.write_documents(jsonb) from public;
grant execute on function public.write_documents(jsonb) to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated, service_role;

insert into public.settings(id,data) values ('competition', '{"registrationsClosed":false,"groupStageResultsPublished":false,"semifinalsResultsPublished":false,"finalsResultsPublished":false}') on conflict do nothing;
insert into public.debate_state(id,data) values ('current', '{"currentRound":"","teams":[],"question":"Bienvenidas y bienvenidos al Conversatorio Colgemelli.","questionId":"","videoUrl":"","isQrEnabled":false,"timer":{"duration":300,"lastUpdated":0,"isActive":false}}') on conflict do nothing;
insert into public.site_content(id,data) values ('survey', '{"title":"Encuesta de satisfacción","subtitle":"Comparte tu experiencia.","isActive":false,"sections":[]}') on conflict do nothing;

-- Videos públicos para las pantallas de debate; escritura solo de organizadores.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('debate-media','debate-media',true,52428800,array['video/mp4','video/webm','video/ogg','video/quicktime','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists debate_media_insert on storage.objects;
create policy debate_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'debate-media' and (select private.app_role()) in ('admin','moderator'));
drop policy if exists debate_media_update on storage.objects;
create policy debate_media_update on storage.objects for update to authenticated
  using (bucket_id = 'debate-media' and (select private.app_role()) in ('admin','moderator'))
  with check (bucket_id = 'debate-media' and (select private.app_role()) in ('admin','moderator'));
drop policy if exists debate_media_delete on storage.objects;
create policy debate_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'debate-media' and (select private.app_role()) in ('admin','moderator'));
drop policy if exists debate_media_read on storage.objects;
create policy debate_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'debate-media');

-- Habilitar Realtime sin duplicar tablas al ejecutar nuevamente el script.
do $$
declare t text;
begin
  if not exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['schools','judges','moderators','scores','rounds','rubric','questions',
    'student_questions','survey_responses','site_content','settings','debate_state','draw_state','tiebreak','audit_logs'] loop
    if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
commit;
