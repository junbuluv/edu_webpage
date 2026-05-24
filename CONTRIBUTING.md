# Contributing

Thanks for working on Econ Studio. This document is the short version of "how
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
