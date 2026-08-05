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
  category text not null check (category in ('executive-panel', 'sub-executive-panel', 'executive-members', 'sub-executive-members', 'general-members')),
  department text not null default '',
  photo_url text,
  linkedin_url text,
  facebook_url text,
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- If your table predates the social columns, this brings it up to date.
-- (create table ... if not exists above is a no-op on an existing table.)
alter table public.team_members add column if not exists linkedin_url text;
alter table public.team_members add column if not exists facebook_url text;

-- 1b. Category constraint — the roster is split by membership panel. On an
-- existing table the CHECK constraint above is a no-op, so drop it and put the
-- current one back.
-- ------------------------------------------------------------
alter table public.team_members drop constraint if exists team_members_category_check;

alter table public.team_members add constraint team_members_category_check
  check (category in ('executive-panel', 'sub-executive-panel', 'executive-members', 'sub-executive-members', 'general-members'));

-- 1c. Post / department migration — titles are now built from a fixed post
-- list plus a fixed department list ("Post - Department"), so the free-text
-- values the roster used to hold are remapped onto the closest new option.
-- ------------------------------------------------------------

-- Old department lines that were really panel labels, not departments.
update public.team_members set department = ''
where department in ('Executive Panel', 'Sub-Executive Panel', 'General Body');

update public.team_members set department = case department
  when 'Marketing & Brand Strategy' then 'Public Relations'
  when 'Corporate Relations'        then 'External Affairs'
  when 'Event Operations'           then 'Operations & Activations'
  when 'Event Management'           then 'Operations & Activations'
  when 'HR'                         then 'Human Resources'
  when 'Human Resource'             then 'Human Resources'
  when 'IT'                         then 'IT & Web Development'
  when 'Web Development'            then 'IT & Web Development'
  when 'Creative'                   then 'Creative & Visualization'
  when 'Content'                    then 'Content & Publication'
  when 'Logistics'                  then 'Logistics & Procurement'
  else department
end;

-- Anything still outside the fourteen departments is cleared rather than left
-- to render a value the admin dashboard can no longer select.
update public.team_members set department = ''
where department <> '' and department not in (
  'Internal Affairs', 'External Affairs', 'Human Resources', 'Policy Management',
  'IT & Web Development', 'Operations & Activations', 'Documentation',
  'Creative & Visualization', 'Content & Publication', 'Logistics & Procurement',
  'Academics', 'Public Relations', 'Partners', 'Membership'
);

-- Executive and general members hold no post and no department at all.
update public.team_members
set title = case category
      when 'executive-members' then 'Executive Member'
      else 'General Member'
    end,
    department = ''
where category in ('executive-members', 'general-members');

-- Panel rows: rebuild "Post - Department" from the remapped department, and
-- retire old post names that are no longer offered.
update public.team_members set title = case
  when split_part(title, ' - ', 1) in (
    'President', 'Senior Vice President', 'Vice President', 'General Secretary',
    'Organizing Secretary', 'Treasurer', 'Joint Secretary',
    'Junior Vice President', 'Head of Department',
    'Assistant Head of Department', 'Deputy Head of Department'
  ) then split_part(title, ' - ', 1)
  when category = 'executive-panel' then 'Vice President'
  else 'Head of Department'
end || case when department = '' then '' else ' - ' || department end
where category in ('executive-panel', 'sub-executive-panel');

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
  ('X', 'President', 'BBA Batch 10', 'executive-panel', '', 1),
  ('X', 'General Secretary', 'BBA Batch 10', 'executive-panel', 'Internal Affairs', 2),
  ('X', 'Treasurer', 'BBA Batch 10', 'executive-panel', 'Operations & Activations', 3),
  ('X', 'Head of Department - Creative & Visualization', 'BBA Batch 11', 'sub-executive-panel', 'Creative & Visualization', 4),
  ('X', 'Executive Member', 'BBA Batch 11', 'executive-members', '', 5),
  ('X', 'General Member', 'BBA Batch 12', 'general-members', '', 6)
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
  facebook_url text,
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Brings an alumni table created before the social columns up to date.
alter table public.alumni add column if not exists linkedin_url text;
alter table public.alumni add column if not exists facebook_url text;

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
  ('X', 'President', 2019, '', 1),
  ('X', 'General Secretary', 2020, '', 2),
  ('X', 'Senior Vice President', 2021, '', 3),
  ('X', 'Head of Department - Public Relations', 2022, '', 4),
  ('X', 'Junior Vice President', 2023, '', 5)
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

-- ============================================================
-- 9. Achievements — competition victories and honours
-- Its own table: an achievement belongs to a team rather than to one person,
-- so the participating clubmates are stored as a JSON array of
-- {"name": "...", "role": "..."} objects instead of as rows.
-- ------------------------------------------------------------
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  organizer text not null default '',
  year integer not null check (year between 1990 and 2100),
  rank text not null default '',
  team_name text not null default '',
  members jsonb not null default '[]'::jsonb,
  image_url text,
  description text not null default '',
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists achievements_set_updated_at on public.achievements;
create trigger achievements_set_updated_at
before update on public.achievements
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- Same rule as the roster and the Hall of Fame: anyone can read visible
-- achievements, only a signed-in Executive can read hidden ones or write.
alter table public.achievements enable row level security;

drop policy if exists "Public can view active achievements" on public.achievements;
create policy "Public can view active achievements"
on public.achievements for select
to anon
using (active = true);

drop policy if exists "Executives can view all achievements" on public.achievements;
create policy "Executives can view all achievements"
on public.achievements for select
to authenticated
using (true);

drop policy if exists "Executives can add achievements" on public.achievements;
create policy "Executives can add achievements"
on public.achievements for insert
to authenticated
with check (true);

drop policy if exists "Executives can edit achievements" on public.achievements;
create policy "Executives can edit achievements"
on public.achievements for update
to authenticated
using (true)
with check (true);

drop policy if exists "Executives can remove achievements" on public.achievements;
create policy "Executives can remove achievements"
on public.achievements for delete
to authenticated
using (true);

-- 10. Storage bucket for achievement cover images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('achievement-photos', 'achievement-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view achievement photos" on storage.objects;
create policy "Anyone can view achievement photos"
on storage.objects for select
to public
using (bucket_id = 'achievement-photos');

drop policy if exists "Executives can upload achievement photos" on storage.objects;
create policy "Executives can upload achievement photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'achievement-photos');

drop policy if exists "Executives can replace achievement photos" on storage.objects;
create policy "Executives can replace achievement photos"
on storage.objects for update
to authenticated
using (bucket_id = 'achievement-photos')
with check (bucket_id = 'achievement-photos');

drop policy if exists "Executives can delete achievement photos" on storage.objects;
create policy "Executives can delete achievement photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'achievement-photos');

-- 11. Seed data — placeholder achievements, so the Achievements page isn't empty
-- ------------------------------------------------------------
insert into public.achievements (title, organizer, year, rank, team_name, members, description, display_order)
select * from (values
  ('National Business Case Competition', 'XYZ University', 2024, '1st Place', 'Team Alpha', '[{"name":"X","role":"Team Lead"},{"name":"X","role":"Analyst"}]'::jsonb, '', 1),
  ('Inter-University Debate Championship', 'ABC Institute', 2023, '2nd Place', 'Team Beta', '[{"name":"X","role":"Speaker"},{"name":"X","role":"Speaker"}]'::jsonb, '', 2),
  ('Marketing Hackathon', 'DEF Business School', 2023, 'Champion', 'Team Gamma', '[{"name":"X","role":"Strategist"},{"name":"X","role":"Creative Lead"}]'::jsonb, '', 3),
  ('Entrepreneurship Summit Pitch', 'GHI Foundation', 2022, '3rd Place', 'Team Delta', '[{"name":"X","role":"Presenter"},{"name":"X","role":"Researcher"}]'::jsonb, '', 4),
  ('Finance Olympiad', 'JKL Commerce Club', 2022, 'Runner-up', 'Team Epsilon', '[{"name":"X","role":"Captain"},{"name":"X","role":"Analyst"}]'::jsonb, '', 5)
) as seed(title, organizer, year, rank, team_name, members, description, display_order)
where not exists (select 1 from public.achievements);
-- same "where not exists" guard: only seeds an EMPTY table.

-- DELETE THIS STATEMENT once you start entering real achievements,
-- otherwise re-running this file will wipe them again.
update public.achievements
set title = 'Achievement Title', organizer = 'Organizer', team_name = 'Team Name',
    members = '[{"name":"X","role":"Role"}]'::jsonb, description = ''
where true;
