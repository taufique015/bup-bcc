# BUP BCC — Supabase Integration Guide

## What changed

You no longer need a server at all. `team.html` and `admin.html` now talk
**directly** to Supabase from the browser — Supabase's database, login
system, and file storage together replace the entire Node.js backend from
before. That means:

- **No hosting to figure out for compute.** `team.html`, `admin.html`, and
  your other pages are all just static files — host them anywhere that
  serves static files for free (GitHub Pages, Netlify, Cloudflare Pages,
  Vercel, or wherever your site already lives).
- **The `bupbcc-backend.zip` from before is no longer needed.** You can
  ignore or delete it. `DATA_DIR`, `ALLOWED_ORIGINS`, all of that — gone,
  nothing to configure on a server because there isn't one.
- Security is now enforced entirely by Supabase's **Row Level Security**
  (the policies in `supabase-setup.sql`) instead of my custom login system.
  This is a different security model, explained below — read it before you
  go live, since there's no server-side code left to double-check anything.

## Setup, in order

**1. Create a Supabase project** at [supabase.com](https://supabase.com) if
you haven't already (free, no credit card).

**2. Run the SQL script.** Open your project → **SQL Editor** → New query →
paste in the entire contents of `supabase-setup.sql` → Run. This creates the
`team_members` table, all the security policies, the photo storage bucket,
and loads your existing six members.

**3. Turn off public sign-ups.** Go to **Authentication → Providers → Email**
and turn off "Allow new users to sign up." This matters — without it,
*anyone* who finds your login page could create an account and get full
write access to your roster, since any signed-in user is treated as an
Executive Member. With it off, only accounts you personally create can log
in at all.

**4. Add your first Executive account.** **Authentication → Users → Add
user** → enter an email and password directly (or use "Invite" to email them
a signup link instead). Repeat for each Executive Member. This replaces the
in-app "Executive Accounts" screen from before — account creation now lives
in the Supabase dashboard, one click away, for whoever has access to it.

**5. Get your project's API keys.** **Settings → API** → copy the **Project
URL** and the **anon / public key** (some newer dashboards call this the
"publishable key" — same thing). Paste both into
`assets/js/supabase-config.js`, replacing the placeholder values.

**6. Publish the files.** Add `admin.html`, `team.html`, and the
`assets/js/` folder to your site the same way you publish your other pages.
Fix the **Team** nav links the same way described earlier (point them at
`team.html`), and note `admin.html` isn't linked from any public nav —
Executives just go there directly.

**7. (Recommended) Set up the keep-alive workflow.** See below.

## The security model, and why it's safe

Supabase's client library ships with an "anon" API key baked right into
`assets/js/supabase-config.js` — visible to anyone who views your page
source. That's normal and intentional for this kind of app, **not a leak**:
that key can't do anything by itself. Every request it makes still passes
through the Row Level Security policies in `supabase-setup.sql`, which are
the actual gatekeepers:

- Anyone can read team members marked visible — that's what makes the public
  page work without logging in.
- Only a request carrying a valid signed-in session (i.e., someone who
  passed Supabase's own login check) can add, edit, or delete anything.

The one key that must **never** appear in any file that reaches a browser is
the **service role / secret key** shown alongside the anon key in your
Supabase settings. Nothing in this project uses it, and it shouldn't need
to — if you ever see instructions asking you to put it in frontend code,
that's a red flag.

## The free tier's one real catch — and how this handles it

Free Supabase projects pause after 7 days with no API activity (your data
stays intact, but the project has to be manually resumed from the dashboard
— and if left paused too long, can eventually be deleted outright). Your
public team page pings Supabase every time someone visits, so this mostly
takes care of itself during a normal semester — but during a quiet stretch
like a school break, it's a real risk.

`.github/workflows/keep-supabase-awake.yml` heads this off: it's a scheduled
job that quietly pings your database every 3 days, comfortably inside the
7-day window, at zero cost. To turn it on:

1. Push this project to a GitHub repo (you'll likely want one anyway, to
   publish your static files).
2. In that repo: **Settings → Secrets and variables → Actions → New
   repository secret**. Add two secrets: `SUPABASE_URL` and
   `SUPABASE_ANON_KEY`, using the same two values you put in
   `supabase-config.js`.
3. That's it — GitHub runs it automatically from then on. You can trigger it
   manually anytime from the repo's **Actions** tab to confirm it works.

## Adding a new department/category later

Two places need updating: the `category in (...)` list inside
`supabase-setup.sql`'s table definition (this needs an `alter table
team_members drop constraint ..., add check (...)` against your live
database — ask me when you're ready and I'll write the exact statement), and
the `CATEGORIES` array at the top of both `assets/js/team.js` and
`assets/js/admin.js`.
