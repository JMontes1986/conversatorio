-- Ejecutar en SQL Editor del MISMO proyecto Supabase conectado a Vercel.
-- Asigna el rol al usuario existente; no modifica su contraseña.
do $$
declare
  target_email text := 'sistemas@colgemelli.edu.co';
  target_id uuid;
begin
  select id into target_id from auth.users
  where lower(trim(email)) = lower(trim(target_email));
  if target_id is null then
    raise exception 'No existe % en Authentication de este proyecto. Verifica el proyecto y el correo.', target_email;
  end if;
  insert into public.profiles(id, role, subject_id, display_name, identifier)
  values (target_id, 'admin', null, target_email, target_email)
  on conflict(id) do update set role = 'admin', subject_id = null,
    display_name = excluded.display_name, identifier = excluded.identifier;
end $$;

select u.id, u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(trim(u.email)) = 'sistemas@colgemelli.edu.co';
