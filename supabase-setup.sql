-- ============================================================
-- BUP BCC — Supabase setup
-- Run this ONCE in your Supabase project: SQL Editor -> New query -> paste
-- this whole file -> Run. Safe to re-run (uses "if not exists" / "on conflict"
-- guards) if something fails partway through.
-- ============================================================

-- 1. The team roster table
-- ------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  title text not null check (char_length(title) between 1 and 120),
  batch text not null default '',
  category text not null check (category in ('board', 'marketing', 'corporate', 'events', 'hr')),
  department text not null default '',
  photo_url text,
  linkedin_url text,
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- If your table predates the linkedin_url column, this brings it up to date.
-- (create table ... if not exists above is a no-op on an existing table.)
alter table public.team_members add column if not exists linkedin_url text;

-- NOTE: the column is called "title" rather than "position" because POSITION
-- is a reserved word in Postgres. Adding a new department later? Add it to
-- the "category in (...)" list above (needs an ALTER TABLE — see README) AND
-- to the CATEGORIES list in assets/js/team.js and assets/js/admin.js.

-- Keep updated_at accurate automatically, no matter what updates a row.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
before update on public.team_members
for each row execute function public.set_updated_at();

-- 2. Row Level Security — this is the ONLY access control now that there's
--    no server in front of the database, so it matters a lot that this is
--    right. The rule: anyone can read active members; only a signed-in
--    Executive can read hidden members or write anything at all.
-- ------------------------------------------------------------
alter table public.team_members enable row level security;

drop policy if exists "Public can view active members" on public.team_members;
create policy "Public can view active members"
on public.team_members for select
to anon
using (active = true);

drop policy if exists "Executives can view everyone" on public.team_members;
create policy "Executives can view everyone"
on public.team_members for select
to authenticated
using (true);

drop policy if exists "Executives can add members" on public.team_members;
create policy "Executives can add members"
on public.team_members for insert
to authenticated
with check (true);

drop policy if exists "Executives can edit members" on public.team_members;
create policy "Executives can edit members"
on public.team_members for update
to authenticated
using (true)
with check (true);

drop policy if exists "Executives can remove members" on public.team_members;
create policy "Executives can remove members"
on public.team_members for delete
to authenticated
using (true);

-- 3. Storage bucket for member photos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view team photos" on storage.objects;
create policy "Anyone can view team photos"
on storage.objects for select
to public
using (bucket_id = 'team-photos');

drop policy if exists "Executives can upload team photos" on storage.objects;
create policy "Executives can upload team photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'team-photos');

drop policy if exists "Executives can replace team photos" on storage.objects;
create policy "Executives can replace team photos"
on storage.objects for update
to authenticated
using (bucket_id = 'team-photos')
with check (bucket_id = 'team-photos');

drop policy if exists "Executives can delete team photos" on storage.objects;
create policy "Executives can delete team photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'team-photos');

-- 4. Seed data — your existing six members, so the roster isn't empty
-- ------------------------------------------------------------
insert into public.team_members (name, title, batch, category, department, display_order)
select * from (values
  ('Tawhidur Rahman', 'President', 'BBA Batch 10', 'board', 'Executive Panel', 1),
  ('Mst. Saraf Anika', 'General Secretary', 'BBA Batch 10', 'board', 'Executive Panel', 2),
  ('Nafiul Hassan', 'Vice President - Operations', 'BBA Batch 10', 'board', 'Executive Panel', 3),
  ('Fariha Tasnim', 'Director - Marketing', 'BBA Batch 11', 'marketing', 'Marketing & Brand Strategy', 4),
  ('Kazi Nabil', 'Director - Corporate Relations', 'BBA Batch 11', 'corporate', 'Corporate Relations', 5),
  ('Shakib Al Mahmud', 'Director - Event Management', 'BBA Batch 11', 'events', 'Event Operations', 6)
) as seed(name, title, batch, category, department, display_order)
where not exists (select 1 from public.team_members);
-- the "where not exists" guard means this only seeds an EMPTY table, so
-- re-running this whole script later won't duplicate members.
