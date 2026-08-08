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
  category text not null check (category in ('executive-panel', 'sub-executive-panel', 'sub-executive-members', 'general-members')),
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
  check (category in ('executive-panel', 'sub-executive-panel', 'sub-executive-members', 'general-members'));

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
  ('X', 'Sub-Executive Member', 'BBA Batch 11', 'sub-executive-members', '', 5),
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
  accomplishment text not null default '',
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
insert into public.alumni (name, title, class_year, accomplishment, display_order)
select * from (values
  ('X', 'President', 2019, '', 1),
  ('X', 'General Secretary', 2020, '', 2),
  ('X', 'Senior Vice President', 2021, '', 3),
  ('X', 'Head of Department - Public Relations', 2022, '', 4),
  ('X', 'Junior Vice President', 2023, '', 5)
) as seed(name, title, class_year, accomplishment, display_order)
where not exists (select 1 from public.alumni);
-- same "where not exists" guard as the roster: this only seeds an EMPTY table.

-- ============================================================
-- 9. Achievements — competition victories and honours
-- Its own table: an accomplishment belongs to a team rather than to one person,
-- so the participating clubmates are stored as a JSON array of
-- {"name": "...", "role": "..."} objects instead of as rows.
-- ------------------------------------------------------------
create table if not exists public.accomplishments (
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

drop trigger if exists accomplishments_set_updated_at on public.accomplishments;
create trigger accomplishments_set_updated_at
before update on public.accomplishments
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- Same rule as the roster and the Hall of Fame: anyone can read visible
-- accomplishments, only a signed-in Executive can read hidden ones or write.
alter table public.accomplishments enable row level security;

drop policy if exists "Public can view active accomplishments" on public.accomplishments;
create policy "Public can view active accomplishments"
on public.accomplishments for select
to anon
using (active = true);

drop policy if exists "Executives can view all accomplishments" on public.accomplishments;
create policy "Executives can view all accomplishments"
on public.accomplishments for select
to authenticated
using (true);

drop policy if exists "Executives can add accomplishments" on public.accomplishments;
create policy "Executives can add accomplishments"
on public.accomplishments for insert
to authenticated
with check (true);

drop policy if exists "Executives can edit accomplishments" on public.accomplishments;
create policy "Executives can edit accomplishments"
on public.accomplishments for update
to authenticated
using (true)
with check (true);

drop policy if exists "Executives can remove accomplishments" on public.accomplishments;
create policy "Executives can remove accomplishments"
on public.accomplishments for delete
to authenticated
using (true);

-- 10. Storage bucket for accomplishment cover images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('accomplishment-photos', 'accomplishment-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view accomplishment photos" on storage.objects;
create policy "Anyone can view accomplishment photos"
on storage.objects for select
to public
using (bucket_id = 'accomplishment-photos');

drop policy if exists "Executives can upload accomplishment photos" on storage.objects;
create policy "Executives can upload accomplishment photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'accomplishment-photos');

drop policy if exists "Executives can replace accomplishment photos" on storage.objects;
create policy "Executives can replace accomplishment photos"
on storage.objects for update
to authenticated
using (bucket_id = 'accomplishment-photos')
with check (bucket_id = 'accomplishment-photos');

drop policy if exists "Executives can delete accomplishment photos" on storage.objects;
create policy "Executives can delete accomplishment photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'accomplishment-photos');

-- 11. Seed data — placeholder accomplishments, so the Accomplishments page isn't empty
-- ------------------------------------------------------------
insert into public.accomplishments (title, organizer, year, rank, team_name, members, description, display_order)
select * from (values
  ('National Business Case Competition', 'XYZ University', 2024, '1st Place', 'Team Alpha', '[{"name":"X","role":"Team Lead"},{"name":"X","role":"Analyst"}]'::jsonb, '', 1),
  ('Inter-University Debate Championship', 'ABC Institute', 2023, '2nd Place', 'Team Beta', '[{"name":"X","role":"Speaker"},{"name":"X","role":"Speaker"}]'::jsonb, '', 2),
  ('Marketing Hackathon', 'DEF Business School', 2023, 'Champion', 'Team Gamma', '[{"name":"X","role":"Strategist"},{"name":"X","role":"Creative Lead"}]'::jsonb, '', 3),
  ('Entrepreneurship Summit Pitch', 'GHI Foundation', 2022, '3rd Place', 'Team Delta', '[{"name":"X","role":"Presenter"},{"name":"X","role":"Researcher"}]'::jsonb, '', 4),
  ('Finance Olympiad', 'JKL Commerce Club', 2022, 'Runner-up', 'Team Epsilon', '[{"name":"X","role":"Captain"},{"name":"X","role":"Analyst"}]'::jsonb, '', 5)
) as seed(title, organizer, year, rank, team_name, members, description, display_order)
where not exists (select 1 from public.accomplishments);
-- same "where not exists" guard: only seeds an EMPTY table.

-- ============================================================
-- 12. Graduation — move panel members into the Hall of Fame
-- One batch graduates per cycle, so there's no graduating-year column to keep
-- in sync: the new class year is simply (highest class year already in the
-- Hall of Fame) + 1, falling back to the current year on an empty table.
-- Every graduate's post is prefixed with "Former", the department (if any) is
-- kept, and display_order is assigned by post seniority so the new class sorts
-- to the front of the Hall of Fame (which orders by class_year desc,
-- display_order asc).
-- ------------------------------------------------------------

-- Seniority rank of a post, used for ordering inside a class.
create or replace function public.post_rank(p_title text)
returns integer
language sql immutable as $$
  select case split_part(p_title, ' - ', 1)
    when 'President'                    then 1
    when 'Senior Vice President'        then 2
    when 'Vice President'               then 3
    when 'General Secretary'            then 4
    when 'Organizing Secretary'         then 5
    when 'Treasurer'                    then 6
    when 'Joint Secretary'              then 7
    when 'Junior Vice President'        then 8
    when 'Head of Department'           then 9
    when 'Deputy Head of Department'    then 10
    when 'Assistant Head of Department' then 11
    else 50
  end;
$$;

-- The class year the next graduating batch belongs to.
create or replace function public.next_class_year()
returns integer
language sql stable as $$
  select coalesce(
    (select max(class_year) + 1 from public.alumni),
    extract(year from now())::integer
  );
$$;

-- Moves the given roster rows into public.alumni and deletes them from the
-- roster, in a single transaction so nobody can land in both tables or neither.
-- Returns the class year the batch was filed under, or null if nothing moved.
create or replace function public.graduate_members(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := public.next_class_year();
  v_moved integer;
begin
  -- security definer bypasses RLS, so the admin check has to be explicit here.
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return null;
  end if;

  with grads as (
    delete from public.team_members m
    where m.id = any(p_ids)
    returning m.name, m.title, m.photo_url, m.linkedin_url, m.facebook_url
  )
  insert into public.alumni (name, title, class_year, photo_url, linkedin_url, facebook_url, display_order)
  select g.name,
         -- "Vice President - Public Relations" -> "Former Vice President - Public Relations"
         case when g.title like 'Former %' then g.title else 'Former ' || g.title end,
         v_year,
         g.photo_url, g.linkedin_url, g.facebook_url,
         row_number() over (order by public.post_rank(g.title), g.name)
  from grads g;

  get diagnostics v_moved = row_count;
  if v_moved = 0 then
    return null;
  end if;
  return v_year;
end $$;

-- Only signed-in Executives may graduate anyone.
revoke execute on function public.graduate_members(uuid[]) from anon, public;
grant execute on function public.graduate_members(uuid[]) to authenticated;
grant execute on function public.next_class_year() to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 13. Who counts as an Executive (admin allow-list)
-- IMPORTANT: everything above granted full read/write to the "authenticated"
-- role, which means ANY Supabase account could edit the club's data. This
-- section narrows that to an explicit allow-list. Run it, then add yourself.
-- Also go to Supabase -> Authentication -> Sign In / Providers and turn OFF
-- "Allow new users to sign up", so nobody can self-register an account.
-- ------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Admins may see the allow-list; nobody can change it from the browser at all
-- (no insert/update/delete policy exists), only from the SQL editor.
drop policy if exists "Admins can view the allow-list" on public.admins;
create policy "Admins can view the allow-list"
on public.admins for select
to authenticated
using (user_id = auth.uid());

-- security definer so it can read public.admins regardless of RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- ADD YOUR EXECUTIVES HERE. Create the account first (Supabase ->
-- Authentication -> Users -> Add user), then run this with their email:
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'president@bupbcc.org'
--   on conflict (user_id) do nothing;
--
-- To revoke someone:  delete from public.admins where email = '...';

-- 13b. Re-issue every write policy against is_admin() instead of merely
-- "is signed in". Same names as above, so these replace them.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['team_members', 'alumni', 'accomplishments'] loop
    execute format('drop policy if exists %I on public.%I',
      'Executives can view ' || case t when 'team_members' then 'everyone' else 'all ' || t end, t);
    execute format('drop policy if exists %I on public.%I', 'Executives full access', t);
    execute format($f$
      create policy "Executives full access" on public.%I
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin())
    $f$, t);
  end loop;
end $$;

-- The old per-action policies are now redundant and, because RLS policies are
-- OR-ed together, they would still let any signed-in user write. Drop them.
drop policy if exists "Executives can add members" on public.team_members;
drop policy if exists "Executives can edit members" on public.team_members;
drop policy if exists "Executives can remove members" on public.team_members;
drop policy if exists "Executives can add alumni" on public.alumni;
drop policy if exists "Executives can edit alumni" on public.alumni;
drop policy if exists "Executives can remove alumni" on public.alumni;
drop policy if exists "Executives can add accomplishments" on public.accomplishments;
drop policy if exists "Executives can edit accomplishments" on public.accomplishments;
drop policy if exists "Executives can remove accomplishments" on public.accomplishments;

-- Hidden (active = false) rows must stay invisible to everyone but admins, so
-- the public read policies apply to any non-admin, signed in or not.
drop policy if exists "Public can view active members" on public.team_members;
create policy "Public can view active members"
on public.team_members for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can view active alumni" on public.alumni;
create policy "Public can view active alumni"
on public.alumni for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can view active accomplishments" on public.accomplishments;
create policy "Public can view active accomplishments"
on public.accomplishments for select
to anon, authenticated
using (active = true);

-- 13c. Storage: same treatment. Reading photos stays public (the buckets are
-- public and the URLs are on the live site anyway); writing is admins only.
-- ------------------------------------------------------------
do $$
declare
  b text;
  act text;
begin
  foreach b in array array['team-photos', 'alumni-photos', 'accomplishment-photos'] loop
    foreach act in array array['upload', 'replace', 'delete'] loop
      execute format('drop policy if exists %I on storage.objects',
        'Executives can ' || act || ' ' || replace(b, '-photos', '') || ' photos');
    end loop;
    execute format('drop policy if exists %I on storage.objects', 'Executives manage ' || b);
    execute format($f$
      create policy %I on storage.objects
      for all to authenticated
      using (bucket_id = %L and public.is_admin())
      with check (bucket_id = %L and public.is_admin())
    $f$, 'Executives manage ' || b, b, b);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 14. Events — the competitions, workshops, seminars and networking events
-- shown on events.html. Self-contained and written in its final form (public
-- read of visible rows, admins-only writes via is_admin()), so it needs no
-- edits to the arrays in sections 13b/13c above. Safe to re-run.
-- ------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('competition', 'workshop', 'seminar', 'networking')),
  event_date date not null,
  location text not null default '',
  description text not null default '',
  detail_url text,
  image_url text,
  featured boolean not null default false, -- flagship: solid-gold highlight on the calendar
  display_order integer not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- Same access rule as every other table: anyone reads visible rows, only a
-- signed-in Executive (is_admin()) reads hidden rows or writes anything.
alter table public.events enable row level security;

drop policy if exists "Public can view active events" on public.events;
create policy "Public can view active events"
on public.events for select
to anon, authenticated
using (active = true);

drop policy if exists "Executives full access" on public.events;
create policy "Executives full access"
on public.events for all
to authenticated
using (public.is_admin()) with check (public.is_admin());

-- 14b. Storage bucket for event cover images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view event photos" on storage.objects;
create policy "Anyone can view event photos"
on storage.objects for select
to public
using (bucket_id = 'event-photos');

drop policy if exists "Executives manage event-photos" on storage.objects;
create policy "Executives manage event-photos"
on storage.objects for all
to authenticated
using (bucket_id = 'event-photos' and public.is_admin())
with check (bucket_id = 'event-photos' and public.is_admin());

-- 14c. Seed data — the events already on the page, so the grid and calendar
-- aren't empty on first load. "where not exists" guard = only seeds an EMPTY
-- table, so re-running the whole file never duplicates them.
-- ------------------------------------------------------------
insert into public.events (title, category, event_date, location, description, detail_url, image_url, featured, display_order)
select * from (values
  ('CreADive 2026', 'competition', date '2026-08-01', 'InterContinental Dhaka', 'A nationwide 360° marketing competition challenging teams to build complete ad campaigns for real brand briefs.', 'creadive-2026.html', 'assets/creadive-2026.png', true, 1),
  ('GATEWAY 2026', 'networking', date '2026-06-18', 'BUP Auditorium', 'Gateway 2026 is the ultimate platform for undergraduates to showcase their talent, creativity, and leadership potential.', 'gateway-2026.html', 'assets/gateway-2026.png', false, 2),
  ('Learn to Lead 2026', 'seminar', date '2026-05-06', 'Bijoy Auditorium', 'BUP BCC, in collaboration with Unilever Bangladesh, successfully hosted Learn to Lead at BUP, creating a space for industry insights and real world learning.', null, 'assets/learn-to-lead-2026.png', false, 3),
  ('Corporiddlerz 2025', 'competition', date '2025-09-20', 'Shadhinota Auditorium, BUP', 'A national business strategy competition where inter-university teams solve real case challenges across multiple rounds.', null, 'assets/corporiddlerz-2025-1.png', false, 4),
  ('Biz Quest 2024', 'workshop', date '2024-05-18', 'BUP Auditorium', 'An inter-university business seminar sharing practical strategies from industry leaders to help students get ahead.', null, 'assets/bizquest-2024.jpg', false, 5),
  ('CreADive 2023', 'competition', date '2023-03-20', 'Bijoy Auditorium, BUP', 'CreADive is an annual flagship event of BUP BCC that challenges students to ideate 360 marketing campaigns to overcome challenges faced by businesses.', null, 'assets/creadive-2023.png', false, 6)
) as seed(title, category, event_date, location, description, detail_url, image_url, featured, display_order)
where not exists (select 1 from public.events);

notify pgrst, 'reload schema';
