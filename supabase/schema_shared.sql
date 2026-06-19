-- ============================================================================
--  THE DUTTY BRUSH — schema for the SHARED Supabase project
--  (project also runs www.fradley.org.uk + meridiandesk.co.uk)
--  Everything is namespaced with a tdb_ prefix in the public schema so it is
--  fully isolated from the family-site / Meridian tables. Idempotent.
-- ============================================================================

create extension if not exists pgcrypto;

-- admins (email allow-list) -------------------------------------------------
create table if not exists public.tdb_admin_emails (email text primary key);
insert into public.tdb_admin_emails (email) values
  ('dom@theduttybrush.com'), ('dominic@fradley.org.uk'), ('dominic.fradley@gmail.com')
on conflict (email) do nothing;

create or replace function public.tdb_is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.tdb_admin_emails
                 where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;
grant execute on function public.tdb_is_admin() to anon, authenticated;

-- factions ------------------------------------------------------------------
create table if not exists public.tdb_factions (name text primary key, grouping text);
insert into public.tdb_factions (name) values
  ('Adeptus Astartes'),('Chaos Space Marines'),('Aeldari'),('Necrons'),('Orks'),
  ('Tyranids'),('T''au Empire'),('Leagues of Votann'),('Astra Militarum'),
  ('Adepta Sororitas'),('Adeptus Custodes'),('Adeptus Mechanicus'),('Grey Knights'),
  ('Death Guard'),('World Eaters'),('Thousand Sons'),('Drukhari'),
  ('Genestealer Cults'),('Imperial Knights'),('Chaos Knights')
on conflict (name) do nothing;

-- projects ------------------------------------------------------------------
create table if not exists public.tdb_projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null,
  faction text references public.tdb_factions(name),
  category text not null default 'Personal' check (category in ('Commission','Personal')),
  progress int not null default 0 check (progress between 0 and 100),
  notes text not null default '', cover_url text,
  is_published boolean not null default true, sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tdb_projects_sort_idx on public.tdb_projects (sort, created_at);

create table if not exists public.tdb_project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tdb_projects(id) on delete cascade,
  url text not null, alt text not null default '', sort int not null default 0
);
create index if not exists tdb_images_idx on public.tdb_project_images (project_id, sort);

create table if not exists public.tdb_project_paints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tdb_projects(id) on delete cascade,
  stage text not null, paints text not null default '', sort int not null default 0
);
create index if not exists tdb_paints_idx on public.tdb_project_paints (project_id, sort);

create table if not exists public.tdb_commissions (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, faction text, model_count text, tier text,
  brief text not null default '', status text not null default 'new'
    check (status in ('new','quoted','in_progress','done','declined')),
  created_at timestamptz not null default now()
);
create table if not exists public.tdb_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.tdb_recipe_requests (
  id uuid primary key default gen_random_uuid(), request text not null, email text,
  status text not null default 'new' check (status in ('new','planned','done','declined')),
  created_at timestamptz not null default now()
);
create table if not exists public.tdb_testimonials (
  id uuid primary key default gen_random_uuid(), quote text not null, author text not null,
  handle text, is_published boolean not null default true, sort int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.tdb_reactions (kind text primary key, label text not null, count int not null default 0);

create or replace function public.tdb_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tdb_projects_touch on public.tdb_projects;
create trigger tdb_projects_touch before update on public.tdb_projects for each row execute function public.tdb_touch();

create or replace function public.tdb_bump_reaction(k text) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.tdb_reactions (kind,label,count) values (k,k,1)
  on conflict (kind) do update set count = public.tdb_reactions.count + 1 returning count into c;
  return c;
end $$;
grant execute on function public.tdb_bump_reaction(text) to anon, authenticated;

-- RLS -----------------------------------------------------------------------
alter table public.tdb_admin_emails  enable row level security;
alter table public.tdb_factions       enable row level security;
alter table public.tdb_projects       enable row level security;
alter table public.tdb_project_images enable row level security;
alter table public.tdb_project_paints enable row level security;
alter table public.tdb_commissions    enable row level security;
alter table public.tdb_subscribers    enable row level security;
alter table public.tdb_recipe_requests enable row level security;
alter table public.tdb_testimonials   enable row level security;
alter table public.tdb_reactions      enable row level security;

drop policy if exists tdb_factions_read on public.tdb_factions;
create policy tdb_factions_read on public.tdb_factions for select using (true);
drop policy if exists tdb_factions_write on public.tdb_factions;
create policy tdb_factions_write on public.tdb_factions for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_projects_read on public.tdb_projects;
create policy tdb_projects_read on public.tdb_projects for select using (is_published or public.tdb_is_admin());
drop policy if exists tdb_projects_write on public.tdb_projects;
create policy tdb_projects_write on public.tdb_projects for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_images_read on public.tdb_project_images;
create policy tdb_images_read on public.tdb_project_images for select using (exists (select 1 from public.tdb_projects p where p.id=project_id and (p.is_published or public.tdb_is_admin())));
drop policy if exists tdb_images_write on public.tdb_project_images;
create policy tdb_images_write on public.tdb_project_images for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_paints_read on public.tdb_project_paints;
create policy tdb_paints_read on public.tdb_project_paints for select using (exists (select 1 from public.tdb_projects p where p.id=project_id and (p.is_published or public.tdb_is_admin())));
drop policy if exists tdb_paints_write on public.tdb_project_paints;
create policy tdb_paints_write on public.tdb_project_paints for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_comm_insert on public.tdb_commissions;
create policy tdb_comm_insert on public.tdb_commissions for insert with check (true);
drop policy if exists tdb_comm_read on public.tdb_commissions;
create policy tdb_comm_read on public.tdb_commissions for select using (public.tdb_is_admin());
drop policy if exists tdb_comm_manage on public.tdb_commissions;
create policy tdb_comm_manage on public.tdb_commissions for update using (public.tdb_is_admin()) with check (public.tdb_is_admin());
drop policy if exists tdb_comm_del on public.tdb_commissions;
create policy tdb_comm_del on public.tdb_commissions for delete using (public.tdb_is_admin());

drop policy if exists tdb_subs_insert on public.tdb_subscribers;
create policy tdb_subs_insert on public.tdb_subscribers for insert with check (true);
drop policy if exists tdb_subs_read on public.tdb_subscribers;
create policy tdb_subs_read on public.tdb_subscribers for select using (public.tdb_is_admin());
drop policy if exists tdb_subs_del on public.tdb_subscribers;
create policy tdb_subs_del on public.tdb_subscribers for delete using (public.tdb_is_admin());

drop policy if exists tdb_rr_insert on public.tdb_recipe_requests;
create policy tdb_rr_insert on public.tdb_recipe_requests for insert with check (true);
drop policy if exists tdb_rr_read on public.tdb_recipe_requests;
create policy tdb_rr_read on public.tdb_recipe_requests for select using (public.tdb_is_admin());
drop policy if exists tdb_rr_manage on public.tdb_recipe_requests;
create policy tdb_rr_manage on public.tdb_recipe_requests for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_testi_read on public.tdb_testimonials;
create policy tdb_testi_read on public.tdb_testimonials for select using (is_published or public.tdb_is_admin());
drop policy if exists tdb_testi_write on public.tdb_testimonials;
create policy tdb_testi_write on public.tdb_testimonials for all using (public.tdb_is_admin()) with check (public.tdb_is_admin());

drop policy if exists tdb_react_read on public.tdb_reactions;
create policy tdb_react_read on public.tdb_reactions for select using (true);

drop policy if exists tdb_admins_self on public.tdb_admin_emails;
create policy tdb_admins_self on public.tdb_admin_emails for select using (lower(email)=lower(coalesce(auth.jwt() ->> 'email','')));

-- storage bucket (isolated id) ----------------------------------------------
insert into storage.buckets (id,name,public) values ('tdb-project-images','tdb-project-images',true) on conflict (id) do nothing;
drop policy if exists tdb_storage_read on storage.objects;
create policy tdb_storage_read on storage.objects for select using (bucket_id='tdb-project-images');
drop policy if exists tdb_storage_write on storage.objects;
create policy tdb_storage_write on storage.objects for insert with check (bucket_id='tdb-project-images' and public.tdb_is_admin());
drop policy if exists tdb_storage_update on storage.objects;
create policy tdb_storage_update on storage.objects for update using (bucket_id='tdb-project-images' and public.tdb_is_admin());
drop policy if exists tdb_storage_delete on storage.objects;
create policy tdb_storage_delete on storage.objects for delete using (bucket_id='tdb-project-images' and public.tdb_is_admin());

-- reactions seed ------------------------------------------------------------
insert into public.tdb_reactions (kind,label,count) values
  ('nailed-it','🔥 Nailed it',0),('steal-worthy','🎨 Steal-worthy',0),('grimdark','💀 Grimdark af',0)
on conflict (kind) do nothing;

-- catalogue seed: 3 original (with recipes) ---------------------------------
insert into public.tdb_projects (slug,title,faction,category,progress,notes,cover_url,sort) values
  ('saturnine-praetor','Saturnine Praetor','Adeptus Astartes','Personal',15,
   E'So Imperial Fist we are.\n\nA recipe for a potential scheme: light panels blend golden brown to golden yellow; bounce reflections grey-blue; deep recesses a purple / magenta mix.',
   'https://res.cloudinary.com/detnqdxoz/image/upload/v1772587362/lpeppqxxdyo3kxwll586.png',30),
  ('night-lord','Night Lord','Chaos Space Marines','Personal',10,'',
   'https://res.cloudinary.com/detnqdxoz/image/upload/v1772554708/aavsoxdehbwl6tjkxyi7.jpg',20),
  ('dark-angel','Dark Angel','Adeptus Astartes','Personal',100,'Dark Angel or Dark Salamangel?',
   'https://res.cloudinary.com/detnqdxoz/image/upload/v1772549499/hpsbmiawe7xb28qle8ac.jpg',10)
on conflict (slug) do nothing;

insert into public.tdb_project_images (project_id,url,sort)
select p.id,v.url,v.sort from public.tdb_projects p join (values
  ('saturnine-praetor','https://res.cloudinary.com/detnqdxoz/image/upload/v1772633270/ejql2vej10776s5uceqb.jpg',0),
  ('dark-angel','https://res.cloudinary.com/detnqdxoz/image/upload/v1772571740/ika2x5dorlgh9mf6pk64.jpg',0)
) as v(slug,url,sort) on v.slug=p.slug on conflict do nothing;

insert into public.tdb_project_paints (project_id,stage,paints,sort)
select p.id,v.stage,v.paints,v.sort from public.tdb_projects p join (values
  ('saturnine-praetor','Primer','Vallejo Primers Black',0),
  ('saturnine-praetor','Base','Purple',1),
  ('saturnine-praetor','Layer','Magenta',2),
  ('night-lord','Primer','Vallejo Primers Black',0)
) as v(slug,stage,paints,sort) on v.slug=p.slug on conflict do nothing;

-- catalogue seed: 12 Instagram shots (placeholder titles to rename) ---------
insert into public.tdb_projects (slug,title,faction,category,progress,cover_url,is_published,sort)
select 'space-marine-'||lpad(g::text,2,'0'), 'Space Marine · '||lpad(g::text,2,'0'),
       'Adeptus Astartes','Commission',100,'assets/img/work/work-'||lpad(g::text,2,'0')||'.jpg',true,113-g
from generate_series(1,12) g
on conflict (slug) do nothing;
