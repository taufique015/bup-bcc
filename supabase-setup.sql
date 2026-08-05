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
  category text not null check (category in ('executive-panel', 'sub-executive-panel', 'executive-members', 'general-members')),
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

-- 1b. Category migration — the roster used to be split by department
-- ('board', 'marketing', 'corporate', 'events', 'hr') and is now split by
-- membership panel. On an existing table the CHECK constraint above is a
-- no-op, so drop it, remap the old rows, then put the new one back.
-- ------------------------------------------------------------
alter table public.team_members drop constraint if exists team_members_category_check;

update public.team_members set category = case category
  when 'board'     then 'executive-panel'
  when 'marketing' then 'executive-members'
  when 'corporate' then 'executive-members'
  when 'events'    then 'executive-members'
  when 'hr'        then 'executive-members'
  else category
end
where category in ('board', 'marketing', 'corporate', 'events', 'hr');

alter table public.team_members add constraint team_members_category_check
  check (category in ('executive-panel', 'sub-executive-panel', 'executive-members', 'general-members'));

-- PostgREST caches the schema, so nudge it after any change above.
notify pgrst, 'reload schema';

-- NOTE: the column is called "title" rather than "position" because POSITION
-- is a reserved word in Postgres. Adding a new category later? Add it to the
-- "category in (...)" lists above AND to the CATEGORIES list in
-- assets/js/team.js and assets/js/admin.js.

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
  ('X', 'President', 'BBA Batch 10', 'executive-panel', 'Executive Panel', 1),
  ('X', 'General Secretary', 'BBA Batch 10', 'executive-panel', 'Executive Panel', 2),
  ('X', 'Vice President - Operations', 'BBA Batch 10', 'executive-panel', 'Executive Panel', 3),
  ('X', 'Director - Marketing', 'BBA Batch 11', 'executive-members', 'Marketing & Brand Strategy', 4),
  ('X', 'Director - Corporate Relations', 'BBA Batch 11', 'executive-members', 'Corporate Relations', 5),
  ('X', 'Director - Event Management', 'BBA Batch 11', 'executive-members', 'Event Operations', 6)
) as seed(name, title, batch, category, department, display_order)
where not exists (select 1 from public.team_members);
-- the "where not exists" guard means this only seeds an EMPTY table, so
-- re-running this whole script later won't duplicate members.

-- ============================================================
-- 5. Hall of Fame — distinguished alumni
-- Separate table from team_members: alumni are grouped by graduating class
-- rather than by panel, and they outlive the current roster.
-- ------------------------------------------------------------
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  title text not null check (char_length(title) between 1 and 120),
  class_year integer not null check (class_year between 1990 and 2100),
  achievement text not null default '',
  photo_url text,
  linkedin_url text,
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists alumni_set_updated_at on public.alumni;
create trigger alumni_set_updated_at
before update on public.alumni
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- Same rule as the roster: anyone can read visible alumni, only a signed-in
-- Executive can read hidden ones or write anything.
alter table public.alumni enable row level security;

drop policy if exists "Public can view active alumni" on public.alumni;
create policy "Public can view active alumni"
on public.alumni for select
to anon
using (active = true);

drop policy if exists "Executives can view all alumni" on public.alumni;
create policy "Executives can view all alumni"
on public.alumni for select
to authenticated
using (true);

drop policy if exists "Executives can add alumni" on public.alumni;
create policy "Executives can add alumni"
on public.alumni for insert
to authenticated
with check (true);

drop policy if exists "Executives can edit alumni" on public.alumni;
create policy "Executives can edit alumni"
on public.alumni for update
to authenticated
using (true)
with check (true);

drop policy if exists "Executives can remove alumni" on public.alumni;
create policy "Executives can remove alumni"
on public.alumni for delete
to authenticated
using (true);

-- 6. Storage bucket for alumni photos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('alumni-photos', 'alumni-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view alumni photos" on storage.objects;
create policy "Anyone can view alumni photos"
on storage.objects for select
to public
using (bucket_id = 'alumni-photos');

drop policy if exists "Executives can upload alumni photos" on storage.objects;
create policy "Executives can upload alumni photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'alumni-photos');

drop policy if exists "Executives can replace alumni photos" on storage.objects;
create policy "Executives can replace alumni photos"
on storage.objects for update
to authenticated
using (bucket_id = 'alumni-photos')
with check (bucket_id = 'alumni-photos');

drop policy if exists "Executives can delete alumni photos" on storage.objects;
create policy "Executives can delete alumni photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'alumni-photos');

-- 7. Seed data — placeholder alumni, so the Hall of Fame isn't empty
-- ------------------------------------------------------------
insert into public.alumni (name, title, class_year, achievement, display_order)
select * from (values
  ('X', 'Founding President', 2019, '', 1),
  ('X', 'General Secretary', 2020, '', 2),
  ('X', 'Vice President - Operations', 2021, '', 3),
  ('X', 'Director - Corporate Relations', 2022, '', 4),
  ('X', 'Director - Marketing', 2023, '', 5)
) as seed(name, title, class_year, achievement, display_order)
where not exists (select 1 from public.alumni);
-- same "where not exists" guard as the roster: this only seeds an EMPTY table.

-- 8. Reset existing names to the "X" placeholder
-- ------------------------------------------------------------
-- The two seed blocks above only fire on an EMPTY table, so rows that are
-- already in the database keep their old names. These two statements blank them
-- out to "X". DELETE THESE TWO STATEMENTS once you start entering real names,
-- otherwise re-running this file will wipe them again.
update public.team_members set name = 'X' where name <> 'X';
update public.alumni set name = 'X', achievement = '' where name <> 'X' or achievement <> '';
