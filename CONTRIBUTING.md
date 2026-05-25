# Contributing

Thanks for working on Baruch Econ & Finance Studio. This document is the short version of "how
to add things without breaking other things." For the *why*, see
`ARCHITECTURE.md`. For agent collaborators, see `AGENTS.md`.

## Local setup

```bash
git clone https://github.com/junbuluv/edu_webpage.git
cd edu_webpage
npm install
cp .env.example .env
#   -> paste your Supabase URL + anon key
#   -> run supabase/schema.sql in the SQL editor
npm run dev
```

Open <http://localhost:4321>.

## Branch & PR conventions

- One topic per PR. If two things land in the same diff, split them.
- Branch names: `feat/<short-slug>`, `fix/<short-slug>`, `lesson/<slug>`,
  `chore/<short-slug>`.
- All changes via PR; `main` is protected.
- The PR template asks for **how to verify** — fill it in. A reviewer who
  can't reproduce the change won't merge it.

## When teammates join

Onboarding playbook for the project owner adding a developer collaborator. Order matters; the collaborator can't complete their checklist until the owner has finished their part.

### Owner steps (~15 min)

1. **GitHub repo access.** Settings → Collaborators → **Add people** → username/email → role **Write**. The invite expires in 7 days; remind them to accept.
2. **Bump branch protection to require 1 review.** Settings → Rules → Rulesets → click the `main` ruleset → **Required approvals = 1**. Save. (Until now you've been self-merging; you stop being able to as soon as this lands. Open a draft PR and they approve when ready — same now applies to them.)
3. **Decide on database access.** Two paths:
   - **Recommended:** they create their own free Supabase project at <https://supabase.com>, run `supabase/schema.sql` in their SQL Editor. They never touch prod data.
   - **Co-maintainer only:** Supabase Dashboard → Project Settings → **Team** → invite by email → role **Developer**. They can read all user data, mutate with service-role. Only do this for someone you'd give a server password to.
4. **Vercel access.** Skip unless they need to deploy themselves. You can still merge their PRs and your existing deploys keep working.
5. **Send them the collaborator checklist (next section) verbatim.**
6. **Save the recovery items.** If they ever stop being a collaborator: rotate `PII_HMAC_SECRET` (see "Security primitives → PII HMAC → Rotation"), rotate the Supabase service-role key (Project Settings → API → Generate new), remove them from GitHub collaborators and Supabase Team. Their old PRs and history stay.

### Collaborator's first day (~20 min)

Email this verbatim to a new collaborator:

```text
1.  Accept the GitHub invite (email link, or visit github.com/junbuluv/edu_webpage).
2.  git clone https://github.com/junbuluv/edu_webpage.git
3.  cd edu_webpage && npm install
4.  Node 22+ required. Check with `node -v`.
5.  Create your own free Supabase project at supabase.com.
6.  In your Supabase SQL Editor, paste the entire supabase/schema.sql and Run.
7.  cp .env.example .env, then fill in:
      - PUBLIC_SUPABASE_URL          your Supabase project URL
      - PUBLIC_SUPABASE_ANON_KEY     your project's anon key
      - SUPABASE_SERVICE_ROLE_KEY    your project's service-role key
      - PII_HMAC_SECRET              generate with: openssl rand -hex 32
      - PUBLIC_SITE_URL              http://localhost:4321
8.  In your Supabase SQL Editor, run:
      alter database postgres set app.pii_hmac_secret = '<same as PII_HMAC_SECRET>';
    (If Supabase rejects this with 42501 permission denied, it's the
    hosted-Postgres restriction — the trigger gracefully falls back to NULL
    email_hmac. Proceed without it.)
9.  In Supabase Dashboard, configure Authentication URLs so signup emails
    redirect back to your localhost:
      - Authentication → URL Configuration → Site URL: http://localhost:4321
      - Authentication → URL Configuration → Redirect URLs → Add URL:
          http://localhost:4321/auth/callback
    Without this, the email link in the confirmation message returns
    "redirect_url not allowed."
10. npm run dev
11. http://localhost:4321 should load. Hero typing effect should run.
12. Sign up at /auth/signup; if Supabase's email goes to spam (common on
    free tier with university addresses), confirm via SQL:
      update auth.users set email_confirmed_at = now() where email = 'you@example.com';
13. Read CLAUDE.md (especially the numbered Conventions list and "Hosted
    Supabase gotchas") and the rest of this CONTRIBUTING.md.
14. Pick a starter task. Branch names: feat/<slug>, fix/<slug>, lesson/<slug>,
    chore/<slug>. One topic per PR. Branch protection requires 1 review and
    passing CI before merge.
```

### Norms once you have a collaborator

- **PRs require a review.** Both parties need an approver. Draft PRs for early signal; mark ready when CI is green.
- **Style nits go in real-time chat, not PR threads.** Reserve review comments for substantive issues.
- **One topic per PR**, including this one. Schema changes get the `db:` title prefix so reviewers check RLS.
- **Secrets never appear in commits, PR descriptions, or chat.** 1Password shared vault or Signal disappearing messages for transit.

## Adding a lesson

1. Pick the course folder under `src/content/lessons/`.
2. Copy an existing lesson (e.g. `macro/is-lm-intro.mdx`) and rename.
3. Edit the frontmatter:
   - Unique `slug` (the filename without `.mdx`).
   - `order:` should be unique within its `unit`.
   - `learningObjectives:` — at least one. Reviewers will push back on
     filler objectives.
4. Body conventions:
   - Equation first, intuition second, simulation last.
   - Use `$inline$` and `$$display$$` for math.
   - Import visualizations: `import ISLMChart from '@components/viz/ISLMChart';`
   - Mark interactive components `client:load` (or `client:visible` if below
     the fold).
5. If the lesson has a quiz, add the JSON under `src/content/quizzes/` and
   reference its slug as `quizSlug:` in the lesson frontmatter.

The Zod schema in `src/content/config.ts` will fail the build if any
required field is missing. That's the point.

## Adding a quiz

Drop a JSON file under `src/content/quizzes/`. The shape is enforced by
the discriminated union in `src/content/config.ts`. Three question types are
supported today:

- `multiple_choice` — one correct answer
- `multi_select` — set of correct answers (must match exactly)
- `numeric` — answer within a tolerance band

If you need a new question type, **extend the union and the renderer in
`Quiz.tsx` in the same PR**. Don't ship a half-implemented type.

## Adding a visualization

1. New file under `src/components/viz/`.
2. Component accepts tunable parameters as props; defaults are a calibrated
   baseline.
3. Include a "Reset" affordance if there are sliders.
4. Caption parameters used (so a reader can reproduce the chart by hand).
5. Avoid pulling in a new charting library. Recharts handles most cases;
   Plotly is already wired for the heavy ones.

## Opening a workshop section

Workshops are weekly small-group sessions tied to a lesson. Content lives in `src/content/workshops/<slug>.json` (5–7 discussion questions per workshop). Attendance is tracked via stamp-in with three barriers: open/close window, geofence, and one-stamp-per-device.

**Two course models:**
- **ECO 1002** runs four per-day sections — `CML` (Mon), `CTL` (Tue), `CWL` (Wed), `CRL` (Thu). The instructor opens one administration per section per week (four per workshop per week).
- **FIN 3610** runs one workshop window per week, no per-day sections. The `section` column is `NULL` for FIN administrations.

**From the instructor UI** (recommended):
`/instructor/workshops/<slug>` — fill the form, set the open/close window, click the open button. The form shows a section picker only for ECO.

**Or via SQL (ECO 1002 with section):**
```sql
insert into public.workshop_administrations (
  workshop_slug, course_slug, section, week_of, instructor_id,
  opens_at, closes_at,
  required_lat, required_lng, required_radius_meters,
  notes
) values (
  'eco-1002-is-lm-intro', 'eco-1002', 'CML', '2027-03-15',
  (select id from auth.users where email = 'you@baruch.cuny.edu'),
  '2027-03-15 22:00:00+00', '2027-03-15 23:30:00+00',
  40.7411, -73.9837, 200,
  'Bring laptops. Form groups of 3-4.'
);
```

**Or via SQL (FIN 3610, no section):**
```sql
insert into public.workshop_administrations (
  workshop_slug, course_slug, section, week_of, instructor_id,
  opens_at, closes_at,
  required_lat, required_lng, required_radius_meters,
  notes
) values (
  'fin-3610-unit-2-time-money', 'fin-3610', null, '2027-03-15',
  (select id from auth.users where email = 'you@baruch.cuny.edu'),
  '2027-03-15 22:00:00+00', '2027-03-15 23:30:00+00',
  40.7411, -73.9837, 200,
  'Bring laptops. Form groups of 3-4.'
);
```

Two partial unique indexes enforce no-duplicates per mode:
- `(workshop_slug, section, week_of) where section is not null` — ECO can't double-open the same section in the same week.
- `(workshop_slug, week_of) where section is null` — FIN can't double-open the same workshop in the same week.

### Querying who stamped in

```sql
select u.email, a.stamped_at, a.client_lat, a.client_lng
from public.workshop_attendance a
join auth.users u on u.id = a.user_id
where a.administration_id = '<uuid>'
order by a.stamped_at;
```

Or export the whole workshop as CSV: `/instructor/workshops/<slug>?format=csv`.

### Honest caveat on the device check

The `(administration_id, device_id)` unique constraint catches the common "Bob hands phone to Alice" or "Alice opens Bob's account on her own phone" pattern, because the device cookie predates the login. It does NOT catch students who clear cookies between sessions, use private browsing, or own two devices. Pair with an in-room headcount.

## Bootstrapping the first admin

Admins are designated by the project owner via SQL. There is **no
self-serve and no in-app promotion path**, by design. An attacker who
phished an admin account cannot grant themselves further admins through
the app, because the app has no surface that does so.

To promote a user to `admin` or `instructor`:

1. Have the candidate sign up normally at `/auth/signup` so their
   `auth.users` row and `public.profiles` row exist.
2. In the Supabase SQL editor (logged in as the project owner), look up
   the user by their email in `auth.users` and update `public.profiles`:
   ```sql
   update public.profiles
      set role = 'admin'   -- or 'instructor'
    where id = (
      select id from auth.users where email = 'them@school.edu'
    );
   ```
   (If a future change ever introduces `profiles.email_hmac` for lookup
   without storing email, the join above still works because
   `auth.users.email` remains the source of truth.)
3. The user signs out and back in; `/admin` (or `/instructor`) is now
   reachable for them.

Demotion uses the same flow with `role = 'student'`.

There is no admin UI. Anything that would otherwise need one — bulk
role changes, instructor invites, account deletions — runs as SQL by
the project owner, and is recorded by Postgres's own logs.

### Pending admin promotions

People approved for `admin` but whose accounts don't exist yet. Promote
them immediately after they sign up at `/auth/signup`, using the SQL
above. Until they sign up, the row in `auth.users` doesn't exist, so the
`update` would be a silent no-op — re-run it once their account is
created. The canonical roster of *current* admins lives in the
`public.profiles` table (`select id from public.profiles where role =
'admin'`).

- `konstantin.kucheryavyy@baruch.cuny.edu` — Konstantin Kucheryavyy.

## Security primitives

### PII HMAC

Any value that is (a) personally identifying and (b) **not** a display name
is HMAC'd with `PII_HMAC_SECRET` before storage. The helper lives at
`src/lib/crypto/pii.ts`:

```ts
import { hmacPII, hmacPIIHex } from '@lib/crypto/pii';

const e_hmac = hmacPIIHex('alice@school.edu');
```

What we HMAC today:

- `profiles.email_hmac` — written by the `handle_new_user()` trigger
- `audit_log.client_ip_hmac`, `audit_log.user_agent_hmac` — written by `logDisclosure()`

**Two places need the secret in sync:**

1. **Application side (`PII_HMAC_SECRET` env var)** — used by
   `src/lib/crypto/pii.ts` for HMAC'ing IP/UA in `logDisclosure` and
   for looking up users by email via `findProfileIdByEmail`.
2. **Database side (`app.pii_hmac_secret` session var)** — used by the
   `handle_new_user()` trigger when stamping `email_hmac` on signup.
   Set it once per Supabase project:
   ```sql
   alter database postgres set app.pii_hmac_secret = '<same value as PII_HMAC_SECRET>';
   ```
   New connections pick up the value automatically.

If either side has a mismatched (or missing) secret, signups still
succeed but `email_hmac` lookups will miss. Run `select
public.backfill_email_hmac();` after configuring the secret to fill in
any rows that signed up before the secret was set.

**Rotation.** Rotate `PII_HMAC_SECRET` annually or on suspected exposure:

1. Generate new secret: `openssl rand -hex 32`.
2. Update Vercel env (`PII_HMAC_SECRET`) and Supabase
   (`alter database postgres set app.pii_hmac_secret = '<new>';`).
3. Re-HMAC existing email rows (plaintext lives in `auth.users`):
   ```sql
   update public.profiles p
      set email_hmac = encode(
        hmac(lower(trim(u.email)),
             current_setting('app.pii_hmac_secret'),
             'sha256'),
        'hex')
     from auth.users u
    where p.id = u.id and u.email is not null;
   ```
4. IP/UA in `audit_log` **cannot** be re-HMAC'd (no plaintext stored).
   Rotation invalidates historical equality lookups on those columns —
   acceptable since we use them for forensic review, not joins.

### Retention jobs

Two `pg_cron`-scheduled functions enforce the retention policy stated in
the Privacy Policy:

- `public.purge_inactive_accounts(p_months integer default 24)` —
  deletes `auth.users` rows whose `last_sign_in_at` is older than the
  cutoff. Cascades through `public.profiles` and the rest of the
  per-user tables.
- `public.purge_old_quiz_attempts(p_days integer default 730)` —
  deletes `quiz_attempts` older than the cutoff.

Each run writes an `audit_log` row with the count purged in
`metadata.count`. `actor_id` is `null` (system action).

Schedules (UTC):

- `retention_purge_inactive_accounts` — `0 4 1 * *` (1st of each month at 04:00)
- `retention_purge_old_quiz_attempts` — `15 4 * * 0` (Sundays at 04:15)

`pg_cron` is preinstalled on Supabase but the extension must be
**enabled by the project owner** (Database → Extensions → "pg_cron" →
Enable). Until then, the function definitions still install and can be
invoked manually:
```sql
select public.purge_inactive_accounts();
select public.purge_old_quiz_attempts();
```

To change the cutoff window, pass the argument:
`select public.purge_inactive_accounts(36);` (36 months instead of 24).

To inspect what cron will run next:
```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

### Audit log

`src/lib/audit.ts` exposes `logDisclosure(ctx)`. Every staff read of an
individual student's record should call it. The helper:

- writes through the service-role client (RLS denies regular inserts),
- HMACs `client_ip` and `user-agent`,
- captures `actor_id`, `actor_role`, `action`, `target_user_id`, `metadata`.

Do **not** insert into `audit_log` from a page or component. The single
chokepoint is enforced by RLS denying all writes from anon/student clients.

## Database changes

The Supabase schema is high-blast-radius. To change it:

1. Edit `supabase/schema.sql`. Keep it idempotent — every change should be
   safe to re-run.
2. Run it against a scratch Supabase project; confirm RLS policies still
   block cross-user reads.
3. Regenerate types: `npm run supabase:types`.
4. Commit both the SQL and the regenerated `database.types.ts`.
5. Tag the schema PR with `db:` in the title so reviewers know to check RLS.

When we adopt the Supabase CLI workflow, schema changes move to
`supabase/migrations/<timestamp>_<name>.sql`. Until then, the single
`schema.sql` is the source of truth.

## Before requesting review

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] You exercised the affected lesson/quiz in `npm run dev`.
- [ ] No `console.log` left over.
- [ ] No new dependency added without justification (see below).

## Adding dependencies

Open a PR with **just** the `package.json` + `package-lock.json` change first
when you add a non-trivial dep. The bar:

- Does Recharts / Tailwind / Astro / Supabase already cover this?
- Does the dep ship more than 50KB to the browser?
- Is it actively maintained?

If yes-no-yes, it's probably fine. Otherwise expect pushback.

## Code style

- TypeScript, strict mode.
- Path aliases: `@components/*`, `@layouts/*`, `@lib/*`, `@content/*`, `@/*`.
- No comments explaining what the code says. Reserve comments for non-obvious
  *why* (parameter calibration rationale, RLS subtleties).
- React: per-component `useState` is fine; reach for Zustand only when 3+
  components share state on a page.
- Tailwind utility classes; no shadcn-ui unless we commit to it across the
  app.

## CI

GitHub Actions runs on every PR (see `.github/workflows/ci.yml`):

- `npm ci`
- `npm run typecheck`
- `npm run build`

A red CI blocks merge. If CI is broken in `main`, fix forward immediately —
do not stack new PRs on a broken `main`.
