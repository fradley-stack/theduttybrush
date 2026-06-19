-- ============================================================================
--  THE DUTTY BRUSH — Supabase / Postgres schema
--  Idempotent: safe to re-run. Creates the workbench data model, row-level
--  security, a public storage bucket, and seeds factions + the initial catalogue.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- admins ----
-- Who is allowed to write. is_admin() is SECURITY DEFINER so RLS policies can
-- call it without exposing the admins table to the public.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- -------------------------------------------------------------- factions ----
create table if not exists public.factions (
  name     text primary key,
  grouping text
);

-- -------------------------------------------------------------- projects ----
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  faction      text references public.factions(name),
  category     text not null default 'Personal' check (category in ('Commission','Personal')),
  progress     int  not null default 0 check (progress between 0 and 100),
  notes        text not null default '',
  cover_url    text,
  is_published boolean not null default true,
  sort         int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists projects_sort_idx on public.projects (sort, created_at);

-- --------------------------------------------------------- project_images ---
create table if not exists public.project_images (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort       int  not null default 0
);
create index if not exists project_images_project_idx on public.project_images (project_id, sort);

-- --------------------------------------------------------- project_paints ---
create table if not exists public.project_paints (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage      text not null,
  paints     text not null default '',
  sort       int  not null default 0
);
create index if not exists project_paints_project_idx on public.project_paints (project_id, sort);

-- ----------------------------------------------------------- commissions ----
create table if not exists public.commissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  faction     text,
  model_count text,
  tier        text,
  brief       text not null default '',
  status      text not null default 'new'
              check (status in ('new','quoted','in_progress','done','declined')),
  created_at  timestamptz not null default now()
);
create index if not exists commissions_status_idx on public.commissions (status, created_at desc);

-- ------------------------------------------------------- updated_at touch ---
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ============================================================================
--  ROW-LEVEL SECURITY
-- ============================================================================
alter table public.admins         enable row level security;
alter table public.factions       enable row level security;
alter table public.projects       enable row level security;
alter table public.project_images enable row level security;
alter table public.project_paints enable row level security;
alter table public.commissions    enable row level security;

-- admins: a user may see only their own row (is_admin() bypasses RLS anyway)
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
  for select using (user_id = auth.uid());

-- factions: world-readable
drop policy if exists factions_read on public.factions;
create policy factions_read on public.factions
  for select using (true);
drop policy if exists factions_write on public.factions;
create policy factions_write on public.factions
  for all using (public.is_admin()) with check (public.is_admin());

-- projects: public reads published rows; admins do everything
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select using (is_published or public.is_admin());
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- images: readable when the parent project is readable; admins write
drop policy if exists images_read on public.project_images;
create policy images_read on public.project_images
  for select using (
    exists (select 1 from public.projects p
            where p.id = project_id and (p.is_published or public.is_admin()))
  );
drop policy if exists images_write on public.project_images;
create policy images_write on public.project_images
  for all using (public.is_admin()) with check (public.is_admin());

-- paints: same pattern
drop policy if exists paints_read on public.project_paints;
create policy paints_read on public.project_paints
  for select using (
    exists (select 1 from public.projects p
            where p.id = project_id and (p.is_published or public.is_admin()))
  );
drop policy if exists paints_write on public.project_paints;
create policy paints_write on public.project_paints
  for all using (public.is_admin()) with check (public.is_admin());

-- commissions: anyone may submit (INSERT); only admins may read / manage
drop policy if exists commissions_insert on public.commissions;
create policy commissions_insert on public.commissions
  for insert with check (true);
drop policy if exists commissions_read on public.commissions;
create policy commissions_read on public.commissions
  for select using (public.is_admin());
drop policy if exists commissions_manage on public.commissions;
create policy commissions_manage on public.commissions
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists commissions_delete on public.commissions;
create policy commissions_delete on public.commissions
  for delete using (public.is_admin());

-- ============================================================================
--  STORAGE (public bucket for mini photos; admins write)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

drop policy if exists dutty_storage_read   on storage.objects;
drop policy if exists dutty_storage_insert on storage.objects;
drop policy if exists dutty_storage_update on storage.objects;
drop policy if exists dutty_storage_delete on storage.objects;
create policy dutty_storage_read   on storage.objects
  for select using (bucket_id = 'project-images');
create policy dutty_storage_insert on storage.objects
  for insert with check (bucket_id = 'project-images' and public.is_admin());
create policy dutty_storage_update on storage.objects
  for update using (bucket_id = 'project-images' and public.is_admin());
create policy dutty_storage_delete on storage.objects
  for delete using (bucket_id = 'project-images' and public.is_admin());

-- ============================================================================
--  SEED — factions
-- ============================================================================
insert into public.factions (name) values
  ('Adeptus Astartes'), ('Chaos Space Marines'), ('Aeldari'), ('Necrons'),
  ('Orks'), ('Tyranids'), ('T''au Empire'), ('Leagues of Votann'),
  ('Astra Militarum'), ('Adepta Sororitas'), ('Adeptus Custodes'),
  ('Adeptus Mechanicus'), ('Grey Knights'), ('Death Guard'), ('World Eaters'),
  ('Thousand Sons'), ('Drukhari'), ('Genestealer Cults'),
  ('Imperial Knights'), ('Chaos Knights')
on conflict (name) do nothing;

-- ============================================================================
--  SEED — initial catalogue (migrated from data.json)
-- ============================================================================
insert into public.projects (slug, title, faction, category, progress, notes, cover_url, sort) values
  ('saturnine-praetor', 'Saturnine Praetor', 'Adeptus Astartes', 'Personal', 15,
   E'So Imperial Fist we are.\n\nI''ve created a recipe for a potential scheme.\n\nFor the upwards / light facing panels and nice blend from Golden Brown to Golden Yellow.\nFor the downwards / bounce reflections a Grey Blue and for the deep recesses and Purple / Magenta mix.',
   'https://res.cloudinary.com/detnqdxoz/image/upload/v1772587362/lpeppqxxdyo3kxwll586.png', 30),
  ('night-lord', 'Night Lord', 'Chaos Space Marines', 'Personal', 10,
   '', 'https://res.cloudinary.com/detnqdxoz/image/upload/v1772554708/aavsoxdehbwl6tjkxyi7.jpg', 20),
  ('dark-angel', 'Dark Angel', 'Adeptus Astartes', 'Personal', 100,
   'Dark Angel or Dark Salamangel?', 'https://res.cloudinary.com/detnqdxoz/image/upload/v1772549499/hpsbmiawe7xb28qle8ac.jpg', 10)
on conflict (slug) do nothing;

insert into public.project_images (project_id, url, sort)
select p.id, v.url, v.sort from public.projects p join (values
  ('saturnine-praetor', 'https://res.cloudinary.com/detnqdxoz/image/upload/v1772633270/ejql2vej10776s5uceqb.jpg', 0),
  ('dark-angel',        'https://res.cloudinary.com/detnqdxoz/image/upload/v1772571740/ika2x5dorlgh9mf6pk64.jpg', 0)
) as v(slug, url, sort) on v.slug = p.slug
on conflict do nothing;

insert into public.project_paints (project_id, stage, paints, sort)
select p.id, v.stage, v.paints, v.sort from public.projects p join (values
  ('saturnine-praetor', 'Primer', 'Vallejo Primers Black', 0),
  ('saturnine-praetor', 'Base',   'Purple',                1),
  ('saturnine-praetor', 'Layer',  'Magenta',               2),
  ('night-lord',        'Primer', 'Vallejo Primers Black', 0)
) as v(slug, stage, paints, sort) on v.slug = p.slug
on conflict do nothing;
