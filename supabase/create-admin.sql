-- 1. Crear el usuario en Supabase > Authentication > Users > Add user.
-- 2. Reemplazar el correo a continuación y ejecutar este bloque.
-- Esta operación solo puede realizarla el dueño de la base desde SQL Editor.
do $$
declare
  admin_email text := 'REEMPLAZAR_POR_TU_CORREO';
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower(trim(admin_email));
  if admin_id is null then
    raise exception 'Primero crea el usuario con ese correo en Authentication > Users.';
  end if;
  insert into public.profiles(id, role, subject_id, display_name, identifier)
  values (admin_id, 'admin', null, admin_email, admin_email)
  on conflict(id) do update set role = 'admin', subject_id = null,
    display_name = excluded.display_name, identifier = excluded.identifier;
end $$;
