-- =====================================================================
--  FUJIYAMA · Esquema de base de datos y almacenamiento (Supabase)
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Administradores ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Primer acceso: si todavía no hay ningún administrador, el primer usuario que
-- entre en /admin/ y lo solicite se convierte en administrador. Después queda cerrado.
create or replace function public.claim_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.admins) then
    return exists (select 1 from public.admins where user_id = auth.uid());
  end if;
  insert into public.admins (user_id) values (auth.uid());
  return true;
end;
$$;
revoke execute on function public.claim_admin() from anon, public;
grant execute on function public.claim_admin() to authenticated;

create or replace function public.has_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins);
$$;
grant execute on function public.has_admin() to anon, authenticated;

drop policy if exists "admins: ver propio" on public.admins;
create policy "admins: ver propio" on public.admins for select using (user_id = auth.uid());

-- ---------- Datos del restaurante (una sola fila) ----------
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "settings: lectura pública" on public.site_settings;
create policy "settings: lectura pública" on public.site_settings for select using (true);
drop policy if exists "settings: admin actualiza" on public.site_settings;
create policy "settings: admin actualiza" on public.site_settings for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Galería (fotos y vídeos) ----------
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image','video')),
  title text,
  description text,
  category text not null default 'Platos',
  src_path text not null,          -- ruta en el bucket "media"
  thumb_path text,                 -- miniatura (foto) o póster (vídeo)
  width int, height int,
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gallery_items_position_idx on public.gallery_items(position);
alter table public.gallery_items enable row level security;
drop policy if exists "galería: lectura pública" on public.gallery_items;
create policy "galería: lectura pública" on public.gallery_items for select using (published or public.is_admin());
drop policy if exists "galería: admin escribe" on public.gallery_items;
create policy "galería: admin escribe" on public.gallery_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Carta ----------
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  grp text not null default 'Cocina',
  note text,
  position int not null default 0,
  visible boolean not null default true
);
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  code text,
  name text not null,
  description text,
  origin text,
  price numeric(8,2),
  image_path text,
  position int not null default 0,
  visible boolean not null default true
);
create index if not exists menu_items_cat_idx on public.menu_items(category_id, position);
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
drop policy if exists "carta cat: lectura" on public.menu_categories;
create policy "carta cat: lectura" on public.menu_categories for select using (visible or public.is_admin());
drop policy if exists "carta cat: admin" on public.menu_categories;
create policy "carta cat: admin" on public.menu_categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "carta items: lectura" on public.menu_items;
create policy "carta items: lectura" on public.menu_items for select using (visible or public.is_admin());
drop policy if exists "carta items: admin" on public.menu_items;
create policy "carta items: admin" on public.menu_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Mensajes y solicitudes de reserva ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'consulta' check (kind in ('consulta','reserva')),
  name text not null check (char_length(name) between 2 and 120),
  email text check (email is null or char_length(email) <= 200),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 3000),
  res_date date,
  res_time text check (res_time is null or char_length(res_time) <= 10),
  people int check (people is null or people between 1 and 60),
  status text not null default 'nuevo' check (status in ('nuevo','visto','confirmado','descartado')),
  created_at timestamptz not null default now()
);
alter table public.messages add column if not exists location text check (location is null or char_length(location) <= 80);
alter table public.messages enable row level security;
-- (La web ya no tiene formulario: nadie puede escribir mensajes desde fuera.)
drop policy if exists "mensajes: cualquiera envía" on public.messages;
drop policy if exists "mensajes: admin lee" on public.messages;
create policy "mensajes: admin lee" on public.messages for select using (public.is_admin());
drop policy if exists "mensajes: admin borra" on public.messages;
create policy "mensajes: admin borra" on public.messages for delete using (public.is_admin());

-- ---------- Almacenamiento: bucket público "media" ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- El bucket es público: las fotos se sirven por URL pública sin necesidad de
-- política de lectura. Solo el admin puede listar (necesario para borrar).
drop policy if exists "media: lectura pública" on storage.objects;
drop policy if exists "media: admin lista" on storage.objects;
create policy "media: admin lista" on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin sube" on storage.objects;
create policy "media: admin sube" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin actualiza" on storage.objects;
create policy "media: admin actualiza" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin borra" on storage.objects;
create policy "media: admin borra" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());
