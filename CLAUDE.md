# Project memory for Claude Code

This is **Baruch Econ & Finance Studio**, an interactive Economics & Finance education site for
undergraduates. Lessons are MDX with embedded React-island simulations;
quizzes are JSON; progress + auth live in Supabase. Public repo at
<https://github.com/junbuluv/edu_webpage>.

## Stack at a glance

- **Astro 5** with `output: 'server'` and the **`@astrojs/vercel`** adapter
- **React 19** islands (Tailwind for styling, no shadcn-ui yet)
- **MDX** with `remark-math` + `rehype-katex` for inline/display math
- **Recharts** for most charts; Plotly available for heavier finance visualizations
- **Supabase** (Postgres + auth + RLS) — see `supabase/schema.sql`
- **Node 22+** required (Supabase realtime needs native WebSocket; enforced in `package.json#engines` and CI)

Path aliases in `tsconfig.json`: `@components/*`, `@layouts/*`, `@lib/*`, `@content/*`, `@/*`.

## Where things live

- Lessons: `src/content/lessons/<course>/<slug>.mdx`
- Quizzes: `src/content/quizzes/<slug>.json`
- Content schemas (frontmatter + quiz shape): `src/content/config.ts`
- Visualizations: `src/components/viz/`
- Quiz engine: `src/components/quiz/Quiz.tsx`
- Auth pages: `src/pages/auth/`, API routes under `src/pages/api/auth/`
- Proctored exams: content `src/content/exams/<slug>.json`, React island
  `src/components/exam/ExamRunner.tsx`, listing/runner pages
  `src/pages/exams/{index,[admin]}.astro`, server APIs
  `src/pages/api/exams/{start,submit}.ts`
- Middleware injects `Astro.locals.supabase` (nullable) and `Astro.locals.user`
- Supabase types: `src/lib/supabase/database.types.ts` — must include `Relationships: []` per table and `CompositeTypes: Record<string, never>` to match what `@supabase/supabase-js` 2.106+ expects (don't drop these fields when hand-editing)
- Workshops (ECO 1002 only): content `src/content/workshops/<slug>.json`,
  schema narrowed via `z.literal('eco-1002')`; React island
  `src/components/workshop/StampInButton.tsx`; student page
  `src/pages/workshops/[slug].astro`; per-course index
  `src/pages/eco-1002/workshops.astro`; stamp API `src/pages/api/workshops/stamp.ts`
- Instructor management hub: `src/pages/instructor/{index,workshops,exams}/...`;
  form-handler APIs `src/pages/api/instructor/{workshops,exams}/{open,close}.ts`
- Course primitives: `src/lib/courses.ts` (slug tuple),
  `src/content/courses/<slug>.json` (metadata), `src/lib/dashboard.ts`
  (active-course resolution + per-course data loader),
  `src/components/course/CourseSwitcher.tsx` (global header dropdown)
- Role helpers: `src/lib/roles.ts` — `isStaff`, `isAdmin`, `roleLabel`.
  Use these instead of inline equality checks
- Device cookie: `src/lib/device.ts` — middleware issues a `device_id`
  UUID cookie used by the workshop stamp uniqueness constraint
- Animation primitives: `src/lib/animation/useAnimatedValue.ts` (rAF
  tween honoring `prefers-reduced-motion`); MDX components
  `src/components/mdx/{ScenarioPlayer,CompareScenarios}.tsx`
- Per-chart presets + URL state: `src/lib/{islm,adas,bonds}/{presets,url-state}.ts`

## Repository workflow

Branch protection is **active** on `main` (Repository Rulesets, free-tier
public-repo path):

- All changes go through a PR. Direct `git push origin main` is rejected.
- CI's `verify` job (typecheck + build) must pass before merge.
- PR branch must be up-to-date with `main` before merge (`strict`).
- Conversation threads must be resolved.
- Force pushes and branch deletions are blocked.
- Required approvals: **0** today (solo dev can self-merge). Bump to 1 once
  a second person is in the repo — see "When teammates join" in
  `CONTRIBUTING.md`.

CI config: `.github/workflows/ci.yml`. Status check name to keep in sync with
the ruleset: `verify`. If the workflow job name ever changes, update the
ruleset via:
```bash
gh api -X PUT repos/junbuluv/edu_webpage/rulesets/16747620 --input <new-payload>
```

## Conventions

1. **Lessons are content, not code.** New topics go in MDX. Only build a new
   React island if there is genuine interactivity (sliders, animation, quiz).
2. **Quiz JSON must match the discriminated union in `config.ts`.** Adding a
   new question type means extending that union *and* the renderer in `Quiz.tsx`.
3. **Charts run client-side.** Mark islands with `client:load` (or `client:visible`
   for below-the-fold visualizations to defer hydration).
4. **Progress writes go through `src/lib/progress.ts`.** It transparently
   handles signed-in (Supabase) and anonymous (localStorage) cases. Don't
   sprinkle Supabase calls in components.
5. **Supabase is optional at runtime.** `createSupabaseServerClient` returns
   `null` when env vars are missing; middleware sets `locals.supabase = null`
   and redirects protected routes to `/auth/setup-required`. Public lessons +
   practice keep working without `.env`. Don't reintroduce a hard throw.
6. **RLS is the source of truth for access control.** When adding a table,
   add policies in `supabase/schema.sql` and regenerate types via
   `npm run supabase:types`. Tag the PR title with `db:` so reviewers check RLS.
7. **Keep lessons calibrated.** If a slider is added, pick parameter ranges
   where students see textbook intuitions (e.g. fiscal expansion raises both Y
   and r). Document the parameter choice in a small caption.
8. **No build artifacts in git.** `.vercel/`, `.astro/`, and `dist/` are
   gitignored. Don't `git add -A` from a fresh build without checking
   `git status` first.
9. **PII hashing.** Sensitive identifiers other than `display_name` are
   HMAC'd before storage (emails as `email_hmac` once dedupe lands; IP/UA
   in `audit_log`). Use `hmacPII(value)` / `hmacPIIHex(value)` from
   `src/lib/crypto/pii.ts`. Never store plaintext PII you don't need.
   The HMAC secret (`PII_HMAC_SECRET`) lives outside the DB; rotation
   procedure is documented in `CONTRIBUTING.md`.
10. **Audit log writes go through `src/lib/audit.ts`.** Don't insert into
    `audit_log` directly from a page — always call `logDisclosure(ctx)`
    so IP/UA are HMAC'd consistently and the service-role client is used.
11. **`createSupabaseServerClient(cookies, headers, request)` needs all three
    args.** `getAll()` reads the *incoming* Cookie header from `request` (not
    `cookies.headers()`, which is outgoing Set-Cookie). In `setAll`, local
    `COOKIE_OPTIONS` are spread *after* Supabase's defaults so `secure: false`
    sticks on http://localhost in dev — don't invert that merge order.
12. **Use `isStaff(role)` / `isAdmin(role)` from `@lib/roles`** for any
    staff/admin gate — never inline `role === 'instructor' || role === 'admin'`.
    The `user_role` enum now has four values: `student`, `instructor`,
    `ta`, `admin`. New TA-equivalent permissions land for free when checks
    go through `isStaff`.
13. **`<ClientRouter />` is mounted in `BaseLayout`.** Cross-page nav
    uses Astro View Transitions. If a React island appears unresponsive
    after navigation, suspect stale DOM references in test/debug code
    rather than a hydration failure — confirm by checking the island
    element directly (`document.querySelector('astro-island')` should
    not have an `ssr` attribute after hydration).

## Hosted Supabase gotchas

- **Paste `supabase/schema.sql` end-to-end**, not in chunks. Supabase SQL
  Editor wraps the script in a single transaction; partial runs abort with
  cryptic "relation X does not exist" cascade errors. The file is idempotent
  (safe to re-run on top of itself).
- **`pg_cron` must be enabled via Dashboard → Database → Extensions** before
  SQL `create extension` succeeds. The schema wraps the call in a do-block so
  absence doesn't abort the migration; retention jobs simply won't schedule
  until enabled.
- **`alter database postgres set app.pii_hmac_secret = ...` is rejected**
  (`42501: permission denied`). The trigger gracefully falls back to NULL
  `email_hmac`. Long-term fix is Supabase Vault or a per-call parameter;
  for now, email dedup-by-hash is a no-op on hosted projects.
- **Free-tier email is rate-limited and frequently blocked** by university
  spam filters (cuny.edu). For dev, manually confirm via SQL:
  `update auth.users set email_confirmed_at = now() where email = '...';`
  For prod, configure custom SMTP (Resend / Postmark / SES).
- **Adding values to `user_role`** uses `alter type user_role add value if
  not exists '<value>';`. This statement cannot run inside an explicit
  transaction block. Supabase SQL Editor runs statements outside one by
  default; if you ever see "ALTER TYPE … ADD cannot run inside a
  transaction block," run the ALTER TYPE on its own first.

## Common tasks

- **New macro lesson**: copy `src/content/lessons/eco-1002/is-lm-intro.mdx`
  as a template; pick a unique `order:` within the unit.
- **New quiz**: add JSON under `src/content/quizzes/`. The slug must match
  `quizSlug:` in the lesson frontmatter to link them.
- **New visualization**: drop a `.tsx` under `src/components/viz/`. Keep it
  self-contained, accept props for any tunable parameters, default to a
  calibrated baseline, include a "Reset" affordance for sliders.
- **Schema change**: edit `supabase/schema.sql` (idempotent, always re-runnable),
  apply in Supabase SQL editor, rerun `npm run supabase:types`, commit both
  the SQL and the regenerated `database.types.ts`.
- **Open a PR**: branch naming `feat/<slug>`, `fix/<slug>`, `lesson/<slug>`,
  `chore/<slug>`. The PR template is required reading — fill the verification
  checklist.
- **New workshop**: drop a JSON under `src/content/workshops/` matching
  the `workshops` collection schema in `config.ts` (5–7 questions, course
  must be `eco-1002`). Visible at `/workshops/<slug>` and
  `/eco-1002/workshops` to enrolled students (admin view-as also works).
- **Open a workshop window**: as a staff user, visit
  `/instructor/workshops/<slug>` and use the section/time/geofence form.
  For an exam window, `/instructor/exams/<slug>`. Both also support SQL
  inserts; see `CONTRIBUTING.md`.
- **Promote a user**: in Supabase SQL Editor,
  ```sql
  update public.profiles set role = '<student|instructor|ta|admin>'
   where id = (select id from auth.users where email = '<them>');
  ```
  No in-app promotion path by design — admins designated via SQL by the
  project owner.
- **Bootstrap a fresh Supabase project for dev/test**: run the full
  `supabase/schema.sql` once, sign up via `/auth/signup`, then in SQL Editor:
  `update auth.users set email_confirmed_at = now() where email = '<you>';`
  If signup pre-dated the schema, also:
  `insert into public.profiles (id, role) select id, 'student' from auth.users where email = '<you>' on conflict do nothing;`
  Then promote, enroll, and open an exam administration per the examples
  in `CONTRIBUTING.md`.

## Verifying before declaring done

1. `npm run typecheck` — must pass.
2. `npm run format` — auto-fixes whitespace/import order via Prettier.
3. `npm run build` — must compile cleanly. Build env needs at minimum:
   ```bash
   PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
   PUBLIC_SUPABASE_ANON_KEY=placeholder \
   PUBLIC_SITE_URL=http://localhost:4321 \
   npm run build
   ```
4. `npm run dev` and exercise the affected lesson/quiz in a browser.

If you touched anything Supabase-related, also re-run `supabase/schema.sql`
in a scratch project and confirm RLS still blocks cross-user reads.

## Tone for content

Direct, mathematical when useful, no AI-pitch padding. The audience is
undergrads in an econ/finance class. Lead with the equation, then the
intuition, then the simulation. Avoid em-dashes everywhere and rule-of-three
filler.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

A reference clone lives at `gstack_upstream/` (gitignored). It's the same
toolkit, useful for reading the script source — do not import from it into
the app.
