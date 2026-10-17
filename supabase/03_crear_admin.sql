-- Dar permisos de administrador a un usuario.
-- 1) Crea el usuario en Supabase → Authentication → Users → "Add user" (email + contraseña, marca "Auto confirm").
-- 2) Cambia el email de abajo y ejecuta este script.
insert into public.admins (user_id)
select id from auth.users where email = 'TU_EMAIL@ejemplo.com'
on conflict do nothing;

-- Comprobar:
select u.email from public.admins a join auth.users u on u.id = a.user_id;
