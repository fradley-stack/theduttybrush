# Supabase backend — The Dutty Brush

The site reads/writes its workbench data from a Supabase (Postgres) project.
The public site uses the **anon (publishable) key** — safe to commit — and all
access is enforced by Postgres **row-level security**. No repo token or secret
ever touches the browser.

## Project

| | |
| :-- | :-- |
| Project | `theduttybrush` |
| Ref | `pnbkyfqchtarlzdmyywl` |
| URL | `https://pnbkyfqchtarlzdmyywl.supabase.co` |
| Region | London (`eu-west-2`) |
| Org | Team Fradley |
| Dashboard | https://supabase.com/dashboard/project/pnbkyfqchtarlzdmyywl |

Connection values live in [`assets/js/config.js`](assets/js/config.js) (anon key only).

## Data model

`projects` ← `project_images` (gallery) and `project_paints` (recipe), plus
`factions` (lookup) and `commissions` (the public intake inbox). Full DDL,
RLS policies, the storage bucket and the seed are in
[`supabase/schema.sql`](supabase/schema.sql) — **idempotent, safe to re-run**.

## Auth

- **Email + password** (Supabase Auth, JWT sessions). Sign-ups are **disabled**.
- Admin user: the studio email you logged in with. Your password was generated
  during setup and provided to you separately — **store it in your password
  manager.** Change it anytime under Dashboard → Authentication → Users.
- Who can write is controlled by the `public.admins` table. To add another editor:
  create the user in the dashboard, then
  `insert into public.admins (user_id, email) select id, email from auth.users where email = '<their-email>';`

## Security model

| Role | projects/images/paints | commissions |
| :-- | :-- | :-- |
| Anonymous (public) | read **published** only | **insert** only (the form) |
| Admin (you) | full read/write incl. drafts | read / update / delete |
| Storage `project-images` | public read | admin write |

Verified: anon can read published work and submit a commission, but **cannot**
write projects or read the inbox.

## Editing (the Forge + Studio Desk)

On `gallery.html`, click **Studio Login** → email + password → **The Forge**:
- Add / edit / delete projects; toggle **Published** to stage drafts.
- Paste image URLs **or upload** straight to Supabase Storage (cover + gallery).

**Studio Desk** (button in The Forge) is a tabbed dashboard:
- **Commissions** — briefs with status workflow (`new → quoted → in_progress → done / declined`).
- **Requests** — public recipe requests (`new → planned → done / declined`).
- **Subscribers** — newsletter list + "copy all emails".
- **Testimonials** — add / edit / delete; published ones appear on the home page.
- **Reactions** — live counters with a reset.

## Community tables (`supabase/schema_community.sql`)

`subscribers`, `recipe_requests`, `testimonials`, and `reactions` (+ a
`bump_reaction(text)` SECURITY DEFINER RPC). RLS: anonymous can **submit** to
subscribers / recipe_requests / commissions and **increment** reactions via the
RPC, but only the admin can read or manage any of it. Testimonials are
world-readable when `is_published`.

## Resilience

The public pages read from Supabase live, and **fall back to the committed
`data.json` snapshot** if Supabase is ever unreachable (free-tier projects pause
after ~7 days of inactivity). To refresh the snapshot, export the `projects`
table to `data.json` (a scheduled GitHub Action can automate this later).

## Re-provisioning / admin via API

All setup was done through the Supabase Management API with a personal access
token. To re-apply the schema:

```bash
curl -X POST "https://api.supabase.com/v1/projects/pnbkyfqchtarlzdmyywl/database/query" \
  -H "Authorization: Bearer <YOUR_PAT>" -H "Content-Type: application/json" \
  --data-binary @<(python -c "import json;print(json.dumps({'query':open('supabase/schema.sql').read()}))")
```

> The setup PAT should be **revoked** once provisioning is confirmed
> (Dashboard → Account → Access Tokens).
