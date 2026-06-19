-- ============================================================================
--  THE DUTTY BRUSH — community features (newsletter, requests, reactions,
--  testimonials). Idempotent; depends on public.is_admin() from schema.sql.
-- ============================================================================

-- -------------------------------------------------------- subscribers ------
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists subscribers_insert on public.subscribers;
create policy subscribers_insert on public.subscribers for insert with check (true);
drop policy if exists subscribers_read on public.subscribers;
create policy subscribers_read on public.subscribers for select using (public.is_admin());
drop policy if exists subscribers_delete on public.subscribers;
create policy subscribers_delete on public.subscribers for delete using (public.is_admin());

-- ------------------------------------------------------ recipe_requests ----
create table if not exists public.recipe_requests (
  id         uuid primary key default gen_random_uuid(),
  request    text not null,
  email      text,
  status     text not null default 'new' check (status in ('new','planned','done','declined')),
  created_at timestamptz not null default now()
);
alter table public.recipe_requests enable row level security;
drop policy if exists rr_insert on public.recipe_requests;
create policy rr_insert on public.recipe_requests for insert with check (true);
drop policy if exists rr_read on public.recipe_requests;
create policy rr_read on public.recipe_requests for select using (public.is_admin());
drop policy if exists rr_manage on public.recipe_requests;
create policy rr_manage on public.recipe_requests for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists rr_delete on public.recipe_requests;
create policy rr_delete on public.recipe_requests for delete using (public.is_admin());

-- -------------------------------------------------------- testimonials -----
create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  quote        text not null,
  author       text not null,
  handle       text,
  is_published boolean not null default true,
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.testimonials enable row level security;
drop policy if exists testi_read on public.testimonials;
create policy testi_read on public.testimonials for select using (is_published or public.is_admin());
drop policy if exists testi_write on public.testimonials;
create policy testi_write on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- reactions ------
-- Global counters; bumped through a SECURITY DEFINER RPC so the public can
-- increment but not arbitrarily write.
create table if not exists public.reactions (
  kind  text primary key,
  label text not null,
  count int  not null default 0
);
alter table public.reactions enable row level security;
drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select using (true);

create or replace function public.bump_reaction(k text)
returns int language plpgsql security definer set search_path = public as $$
declare new_count int;
begin
  insert into public.reactions (kind, label, count) values (k, k, 1)
  on conflict (kind) do update set count = public.reactions.count + 1
  returning count into new_count;
  return new_count;
end $$;
grant execute on function public.bump_reaction(text) to anon, authenticated;

insert into public.reactions (kind, label, count) values
  ('nailed-it', '🔥 Nailed it', 0),
  ('steal-worthy', '🎨 Steal-worthy', 0),
  ('grimdark', '💀 Grimdark af', 0)
on conflict (kind) do nothing;
