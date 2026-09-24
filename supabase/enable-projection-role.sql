-- Ejecutar una sola vez en Supabase SQL Editor.
-- Habilita el nuevo perfil de Proyección sin modificar los demás roles.

begin;

alter table public.profiles
  drop constraint if exists profiles_check;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_check
  check (role in ('admin', 'judge', 'moderator', 'projection'));

commit;
