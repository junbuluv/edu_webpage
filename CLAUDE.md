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
- **Node 22.x** required (matches Vercel and CI; enforced in `package.json#engines` and `.nvmrc`)

Path aliases in `tsconfig.json`: `@components/*`, `@layouts/*`, `@lib/*`, `@content/*`, `@/*`.

## Where things live

- Lessons: `src/content/lessons/<course>/<slug>.mdx`
- Quizzes: `src/content/quizzes/<slug>.json`
- Content schemas (frontmatter + quiz shape): `src/content/config.ts`
- Visualizations: `src/components/viz/`
- Quiz engine: `src/components/quiz/Quiz.tsx`. Grading is server-side:
  the island POSTs answers to `/api/quiz/grade` (pure `gradeQuiz()` in
  `src/lib/quiz/grade.ts`); pages render `toPublicQuestions()`
  (`src/lib/quiz/public.ts`), which strips answers before SSR. See
  convention #17
- Auth pages: `src/pages/auth/`, API routes under `src/pages/api/auth/`
- Middleware injects `Astro.locals.supabase` (nullable) and `Astro.locals.user`
- Supabase types: `src/lib/supabase/database.types.ts` — must include `Relationships: []` per table and `CompositeTypes: Record<string, never>` to match what `@supabase/supabase-js` 2.106+ expects (don't drop these fields when hand-editing)
- Workshops (both courses): content `src/content/workshops/<slug>.json`,
  schema gated by `courseEnum`; React island
  `src/components/workshop/StampInButton.tsx`; student page
  `src/pages/workshops/[slug].astro`; per-course indexes
  `src/pages/{eco-1002,fin-3610}/workshops.astro`; stamp API `src/pages/api/workshops/stamp.ts`
- Workshop visibility tiers (set by PR #69): course pages + per-course
  workshop list (`/{course}/workshops`) are public — titles, summaries,
  lesson links, question counts visible to guests. Open-window status
  (section / week / open|upcoming|closed) renders only for enrolled
  students + admins. Per-workshop detail (`/workshops/<slug>`) is still
  gated to signed-in users; stamp-in additionally requires enrolled +
  within geofence.
- Instructor management hub: `src/pages/instructor/{index,workshops}/...`;
  form-handler APIs `src/pages/api/instructor/workshops/{open,close}.ts`
- Instructor class management (PR #72): routes
  `src/pages/instructor/classes/{index,[course],import}.astro`; loaders
  `src/lib/instructor/class-roster.ts` (roster + per-student monitoring +
  at-risk flags + CSV export) and `roster-import.ts` (bulk CSV enrollment
  import with ownership gate); pure alias-free helpers
  `src/lib/progress-aggregate.ts` + `src/lib/instructor/roster-csv.ts`
  (unit-tested — see "Verifying"); read-only audit-log viewer on
  `src/pages/admin/index.astro`
- Enrollment CRUD (PR #101): instructors/admins add/drop/edit individual
  students from the roster page (`/instructor/classes/<course>`). Gated
  POST handlers `src/pages/api/instructor/classes/{enroll,drop,update}.ts`
  (gate order: `!user` → `!isStaff` → `isCourseSlug`+required fields →
  `instructorOwnsCourse`); pure unit-tested classifier
  `src/lib/instructor/enroll-classify.ts`. Add matches by email; drop/update
  take a hidden `user_id`. Existing rows keep their `instructor_id` (only new
  inserts set it). Sections `{CML,CTL,CWL,CRL}` validated, eco-1002 only.
  RosterTable has a staff-only "Manage" column
- Course archive (PRs #90–100): per-course `/{course}/archive` of prior-term
  materials (faceted browse + keyword search), gated to enrolled students +
  staff. Pure alias-free core `src/lib/archive/{types,build}.ts`
  (unit-tested); git+DB loader `load.ts`; access gates `access.ts`;
  service-role reads `db.ts`. Content is hybrid: git (lesson notes, quiz
  JSON) + DB tables `archive_videos`/`archive_papers`/`archive_quizzes`
  (RLS-locked, convention #6 service-role pattern). Instructor management UI
  under `src/pages/instructor/archive/{index,video,paper,quiz}`; file uploads
  land in the private `archive-papers` Supabase Storage bucket via gated
  signed URLs. Authored quizzes are server-graded through the git-or-DB
  resolver `src/lib/quiz/resolve.ts` (`loadGradableQuiz`). **Videos are
  ECO-1002 only.** Lessons render a "Lecture videos" section to
  enrolled+staff
- Course primitives: `src/lib/courses.ts` (slug tuple),
  `src/content/courses/<slug>.json` (metadata), `src/lib/dashboard.ts`
  (active-course resolution + per-course data loader),
  `src/components/course/CourseSwitcher.tsx` (global header dropdown)
- Role helpers: `src/lib/roles.ts` — `isStaff`, `isAdmin`,
  `isContentManager`, `roleLabel`. Use these instead of inline equality
  checks. `isContentManager` (instructor|admin, **TA read-only**) gates
  content mutation and is deliberately narrower than `isStaff` (which
  includes `ta`)
- Device cookie: `src/lib/device.ts` — middleware issues a short-lived
  `workshop_device_id` UUID cookie; workshop attendance stores only its HMAC
  for uniqueness, never the raw cookie or submitted coordinates
- Animation primitives: `src/lib/animation/useAnimatedValue.ts` (rAF
  tween honoring `prefers-reduced-motion`)
- MDX components in `src/components/mdx/`: `ScenarioPlayer`,
  `CompareScenarios`, `Figure` (static images with caption + source
  credit), `BarFigure` (Recharts wrapper for hand-curated tabular data)
- Lesson figures: `public/figures/<course>/<lesson-slug>/<name>.png`
  for committed images; `BarFigure` data lives inline in MDX
- Per-chart presets + URL state: `src/lib/{islm,adas,bonds}/{presets,url-state}.ts`
- Weekly attendance (PR #113): pure alias-free `src/lib/attendance-weekly.ts`
  builds a week-by-week matrix (`attended` / `missed` / `pending` /
  `ineligible`) from the distinct `week_of` Mondays of non-cancelled
  `workshop_administrations`. There is no semester calendar; weeks exist only
  as those Mondays. Instructor side: per-week ✓/✗ columns in
  `RosterTable.astro` plus `week_<monday>` CSV columns. Student side: a
  "Workshop attendance" card on `/dashboard` (weekly chips + a stamp-in link
  when a window for their section is open now), loaded in `dashboard.ts` via
  the student's own RLS reads
- Signup roles + student ID (PR #120): the signup form asks student /
  lecturer / TA and collects an 8-digit EMPLID from students. Choosing a
  staff role writes a **request** to `role_requests`, never a role — see
  convention #19. Pure logic: `src/lib/auth/signup-role.ts` (role +
  student-ID validation) and `src/lib/admin/role-decision.ts` (approve/deny
  classifier), both unit-tested. Admin queue on `/admin` with handler
  `src/pages/api/admin/role-request.ts`; pending users see a banner on
  `/dashboard`. Student IDs are stored only as `profiles.student_id_hmac`
  (convention #9), excluded from the `authenticated` column grant, and
  uniquely indexed
- Account password change (PR #115): `/account/password` (linked from the
  dashboard Account section) requires the current password, verified by
  re-authenticating before `updateUser`. `/auth/reset` is reserved for
  recovery-link sessions, detected via the JWT `amr` claim in
  `src/lib/auth/session-amr.ts` (fails open when the claim is unreadable so
  a genuine recovery user is never stranded)
- Cross-device email confirmation (PR #118): `src/pages/auth/confirm.ts`
  validates `?token_hash=&type=` with `verifyOtp`, entirely server-side, so
  confirmation and reset links work from any device. `/auth/callback` (PKCE
  `?code=`) remains for legacy links but only completes in the browser that
  started the flow — see the Supabase gotchas section for the email
  templates this requires
- Operational email: `src/lib/email/notify.ts` posts to the Resend REST API
  (`RESEND_API_KEY`) and is fail-open — used to alert admins of a staff
  access request. Auth email (confirmation, reset) does **not** go through
  this; Supabase sends it via its own SMTP settings

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

CI config: `.github/workflows/ci.yml`. Three jobs:

- **`verify`** (typecheck + build) — **required** by branch protection.
  Status check name in sync with the ruleset.
- **`schema-roundtrip`** — applies `supabase/schema.sql` twice against a
  stock Postgres 15 service container with a minimal `auth` stub (roles,
  `auth.users`, and `auth.uid()`). Catches idempotency regressions
  (drop/create policy name mismatches, ALTER TYPE + use-in-same-txn).
  It also exercises the upgrade path and the RLS suite
  (`supabase/tests/security_hardening_rls.sql`). Currently **advisory**, not
  blocking — flip to required in the ruleset when ready by adding
  `schema-roundtrip` to `required_status_checks`. Two traps this job has
  already sprung (both fixed 2026-08-26, PR #121):
  - **Don't pin a commit SHA that lives on a feature branch.** The
    upgrade test used to `git show <sha>:supabase/schema.sql`; rebasing
    that branch before merge orphaned the commit and CI died with exit
    128, while clones predating the rebase still resolved it. The
    pre-upgrade schema is now vendored at
    `supabase/tests/fixtures/pre_workshop_integrity_schema.sql` — a
    historical snapshot, so never "update" it to match the current schema.
  - **Don't write date-dependent fixtures.** A workshop fixture paired
    section `CTL` with `opens_at = now()`, but the section/day CHECK
    requires an ECO window to open on its section's weekday, so the suite
    passed only on Tuesdays. Use fixed weekday-correct dates (the other
    fixtures use `2026-07-13`, a Monday, with `CML`) or
    `schedule_version = 1`, which is exempt from that check.
- **`copyright-gate`** — runs `node scripts/check-copyright.mjs` over
  lesson MDX + quiz JSON (flags missing `credit`, external/hotlinked
  images, `materials/` references). Also **advisory**; the deeper,
  on-demand AI review is the `/copyright-check` skill (see "New lesson
  figure" under Common tasks).

If a job name changes, update the ruleset via:

```bash
gh api -X PUT repos/junbuluv/edu_webpage/rulesets/16747620 --input <new-payload>
```

## Conventions

1. **Lessons are content, not code.** New topics go in MDX. Only build a new
   React island if there is genuine interactivity (sliders, animation, quiz).
2. **Quiz JSON must match the discriminated union in `config.ts`.** Adding a
   new question type means extending that union _and_ the renderer in `Quiz.tsx`.
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
   **Sanctioned exception:** instructor-facing data access (reads _and_ writes)
   goes through the service-role admin client (`@lib/supabase/admin`) + an
   app-side ownership / `isStaff` check, NOT RLS — see
   `api/instructor/workshops/*.ts` and
   `src/lib/instructor/{class-roster,roster-import}.ts`. Required because
   student email lives in `auth.users` (profiles holds only `email_hmac`),
   unreadable by any instructor RLS policy. Keep new instructor data access on
   this pattern; enforce ownership in app code (don't reassign another
   instructor's rows).
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
    Use `logDisclosureSafe(ctx)` (fail-open: logs a console error instead
    of throwing) on mutation paths where an audit-write failure shouldn't
    break the user action. Valid actions are the `DisclosureAction` union
    in `audit.ts` (e.g. `manage_archive`, `manage_enrollment`); add new
    ones there. Keep `actorRole` as the real role so TA actions stay `'ta'`.
11. **`createSupabaseServerClient(cookies, headers, request)` needs all three
    args.** `getAll()` reads the _incoming_ Cookie header from `request` (not
    `cookies.headers()`, which is outgoing Set-Cookie). In `setAll`, local
    `COOKIE_OPTIONS` are spread _after_ Supabase's defaults so `secure: false`
    sticks on http://localhost in dev — don't invert that merge order.
12. **Use `isStaff(role)` / `isAdmin(role)` from `@lib/roles`** for any
    staff/admin gate — never inline `role === 'instructor' || role === 'admin'`.
    The `user_role` enum now has four values: `student`, `instructor`,
    `ta`, `admin`. New TA-equivalent permissions land for free when checks
    go through `isStaff`. For content _mutation_ gates (archive
    videos/papers/quizzes) use `isContentManager` instead — it excludes
    `ta` (TAs are read-only on content).
13. **`<ClientRouter />` is mounted in `BaseLayout`.** Cross-page nav
    uses Astro View Transitions. If a React island appears unresponsive
    after navigation, suspect stale DOM references in test/debug code
    rather than a hydration failure — confirm by checking the island
    element directly (`document.querySelector('astro-island')` should
    not have an `ssr` attribute after hydration).
14. **Don't add `materials/` to git.** That folder is in `.gitignore`
    and contains instructor-only artifacts (textbook chapter drafts,
    publisher `.docx` files, instructor headshot originals). The repo
    is public; the contents include third-party copyrighted material.
    If you find yourself considering `git add materials/` or removing
    the `.gitignore` entry, stop and ask the project owner. Lesson
    figures sourced from there are off-limits — see "New lesson figure"
    under Common tasks for the sanctioned sources.
15. **Auth URL convention: `/auth/signin` is canonical.** The page
    lives at `src/pages/auth/signin.astro` and matches the API handler
    at `/api/auth/signin` for naming consistency.
    `src/pages/auth/login.astro` is a 3-line frontmatter file that
    issues a 301 to `/auth/signin` preserving the query string —
    purely for old bookmarks and external references. **All internal
    links should point at `/auth/signin`**, not `/auth/login`. Don't
    add new code (links, redirect destinations, Supabase config) that
    references `/auth/login` — the redirect exists to catch external
    URLs, not internal ones.
16. **Form-handler error redirects target the page, not the API.**
    When a POST handler under `src/pages/api/...` needs to redirect on
    error (e.g., 23505 unique violation), the `Location:` header must
    point at the page that originated the form (e.g.,
    `/instructor/workshops/<slug>?error=already_opened`), **not** the
    API URL itself. The API route has no GET handler; if you redirect
    to `url.pathname` the browser follows via GET and lands on a
    Vercel 404. Pair this with the page reading `?error=` and `?ok=`
    from the query string and rendering a banner — the established
    pattern lives in `src/pages/instructor/workshops/[slug].astro`
    (after PR #68). Workshop slug or other form-derived ID can be
    pulled from `formData()` to build the right target.
17. **Quiz answers never reach the client.** Grading is server-side:
    the `Quiz.tsx` island POSTs responses to `/api/quiz/grade`, which
    calls the pure `gradeQuiz()` in `src/lib/quiz/grade.ts`. Pages
    render `toPublicQuestions()` (`src/lib/quiz/public.ts`), which
    strips `answer` / `correctIndex` / `correctIndices` / `explanation`
    before SSR, so correct answers are never in the page source or
    client bundle (this stops students pasting a quiz into an LLM for
    the key). Don't pass full answer data into client props or add a
    client-side grader. `grade.ts` is alias-free and unit-tested (see
    "Verifying"). Quizzes resolve through `loadGradableQuiz`
    (`src/lib/quiz/resolve.ts`), which loads either a git-authored quiz or
    a DB-authored archive quiz; the standalone Zod `question-schema.ts`
    re-validates DB-authored questions. Both are alias-free + tested.
18. **Never `.maybeSingle()` an `enrollments` query keyed only by
    `instructor_id`/`user_id` + `course_slug`.** Those filters can match
    multiple rows (an instructor with ≥2 students; a student enrolled
    across ≥2 semesters), and `.maybeSingle()` throws PGRST116 on >1 row —
    silently denying a legitimate instructor/student. Use `.limit(1)` + an
    array-length check instead. This bit ownership/visibility gates
    repeatedly (#93/#94); `instructorOwnsCourse` + `canViewCourse` in
    `src/lib/archive/access.ts` are the corrected pattern. (A `.maybeSingle()`
    keyed on the full enrollments PK — `user_id`+`course_slug`+`semester` —
    is safe, since that matches at most one row.)
19. **A role chosen at signup is a request, never an assignment.**
    `profiles.role` is written only by an admin (the `/admin` queue or
    `assign-role`) or by SQL. Signup inserts into `role_requests`, whose
    CHECK limits `requested_role` to `instructor|ta` so a forged form value
    cannot request `admin`; the account keeps student-level access until
    approved. Don't add any path that sets `profiles.role` from user input.
20. **Never trust `data.user` from `supabase.auth.signUp()`.** On this
    project it resolves to `null` with **no error**: GoTrue returns a bare
    user object for confirmation-required signups and the installed
    supabase-js maps that shape to null. Code guarded on `if (data.user)`
    is dead code — this silently skipped terms acceptance at signup for
    months (the `/account/terms` gate masked it) and then dropped student
    IDs and role requests too (#122). Resolve the account through the
    service role by email instead, and guard writes on
    `profiles.created_at` being seconds old, so signing up with an
    already-registered email can never write to that account.

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
- **Auth email is custom SMTP via Resend, and it works to Baruch
  addresses** (shipped 2026-08-26). Supabase Auth → SMTP Settings points at
  `smtp.resend.com:465`, sender `noreply@baruchfinance.com`, domain verified
  in Resend with SPF/DKIM in Cloudflare DNS. This replaced Supabase's
  built-in sender, which cuny.edu (Microsoft 365 / EOP) dropped server-side
  with no bounce. `gmail.com` stays in the signup allowlist as a fallback.
  For dev you can still confirm by hand:
  `update auth.users set email_confirmed_at = now() where email = '...';`
- **The auth email templates must link to `/auth/confirm`, not the default
  PKCE URL.** Supabase Auth → Email Templates:
  - Confirm signup:
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
  - Reset password:
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset`

  The default `{{ .ConfirmationURL }}` runs the PKCE `?code=` flow, whose
  verifier lives in the browser that started signup, so opening the link on
  a phone or in a mail client fails with "PKCE code verifier not found in
  storage" even though the email was already verified. `/auth/confirm` uses
  `verifyOtp` server-side and works from any device. Templates live only in
  the dashboard — they are not in this repo, so re-check them after any
  project restore.

- **Outlook/Gmail link scanners consume one-time links.** A pre-fetched
  confirmation link is spent before the student clicks it; the account is
  confirmed anyway, so `/auth/confirm` answers with "already used — try
  signing in" rather than a dead end. Expect students to report this.
- **Adding values to `user_role`** uses `alter type user_role add value if
not exists '<value>';`. Postgres enforces two related restrictions
  around enum value additions, and Supabase SQL Editor (which wraps the
  whole paste in one transaction) can trip either:
  - `25001: ALTER TYPE … ADD cannot run inside a transaction block` —
    the `ALTER TYPE` statement itself is rejected. Run it alone in its
    own query, then re-paste the rest of `schema.sql`.
  - `55P04: unsafe use of new value "X" of enum type … New enum values
must be committed before they can be used` — the `ALTER TYPE`
    succeeded but a later statement in the same transaction (a
    `CHECK`, RLS policy, or `WHERE … in (...)` literal) referenced the
    new value before the implicit commit. Same fix: run the `ALTER
TYPE` standalone first; on the re-paste it becomes a no-op (since
    the value now exists) and the rest runs cleanly.

## Vercel deployment gotchas

- **Env vars must be set manually in Vercel UI.** The Supabase-Vercel
  Integration is a separate install from the Supabase-GitHub Integration
  and most setups have only the latter. Five vars need **all three environment
  scopes** (Production, Preview, Development): `PUBLIC_SUPABASE_URL`,
  `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PII_HMAC_SECRET`,
  and `CRON_SECRET`. Set `PUBLIC_SITE_URL` to the canonical URL in Production;
  Preview may leave it unset because auth callbacks fall back to Vercel's
  deployment URL. If Production scope is unchecked on any required runtime
  secret, the
  prod runtime gets `undefined` and middleware redirects every authenticated
  request to `/auth/setup-required`.
- **Production auto-deploy from `main` is not reliable.** Several merges to
  `main` have failed to trigger production deploys (only preview-on-PR fires
  reliably). After merging an important change, verify a Vercel check-run
  appears for that SHA via
  `gh api repos/junbuluv/edu_webpage/commits/<sha>/check-runs --jq '.check_runs[] | select(.name | startswith("Vercel"))'`;
  if empty, force-redeploy via Vercel UI: Deployments → `⋯` on latest →
  Redeploy → uncheck "Use existing Build Cache".
- **Deploying via CLI works and is the reliable path.** The repo is linked
  (gitignored `.vercel/`) to the canonical project **`edu-webpage`** (prod
  alias `edu-webpage-fawn.vercel.app`); `vercel deploy --prod --yes` ships the
  current `main` from your machine. A duplicate auto-created project
  (`edu-webpage-m3av`) was deleted — if a second project reappears wired to
  this same repo it double-deploys every push; remove it.
- **Astro 5's built-in `security.checkOrigin` is disabled** in
  `astro.config.mjs`; `src/middleware.ts` performs the replacement check. It
  accepts the request/forwarded/configured Vercel origins and rejects
  cross-site browser mutations before auth or body parsing. Keep this guard in
  place if proxy header behavior changes.
- **`site:` in `astro.config.mjs` must match the deployed origin.** Currently
  set to `https://baruchfinance.com` (custom domain, Cloudflare Registrar +
  Cloudflare DNS in DNS-only mode, cut over 2026-08-25; the old
  `edu-webpage-fawn.vercel.app` alias still serves). Affects sitemap.xml
  URLs, `<link rel="canonical">` tags, and `Astro.site`. If the origin ever
  changes again: single-line PR here, plus updating Supabase Auth URL
  Configuration + `PUBLIC_SITE_URL` env var. Auth email is custom SMTP via
  Resend (`noreply@baruchfinance.com`, domain verified in Resend;
  SPF/DKIM records live in Cloudflare DNS).
  Supabase's Redirect URLs must also include the exact production callback and
  `https://*-<team-or-account-slug>.vercel.app/**` for preview auth links.

## Common tasks

- **New macro lesson**: copy `src/content/lessons/eco-1002/is-lm-intro.mdx`
  as a template; pick a unique `order:` within the unit.
- **New quiz**: add JSON under `src/content/quizzes/`. The slug must match
  `quizSlug:` in the lesson frontmatter to link them.
- **New visualization**: drop a `.tsx` under `src/components/viz/`. Keep it
  self-contained, accept props for any tunable parameters, default to a
  calibrated baseline, include a "Reset" affordance for sliders.
- **New lesson figure**: pick a source — for empirical charts default to
  FRED (`fredgraph.png?id=SERIES`, US public-domain), download under
  `public/figures/<course>/<slug>/`, embed via the `Figure` MDX component
  with `src`, `alt`, `caption`, and `credit`. For company-specific data,
  hand-curate from SEC EDGAR filings into a `BarFigure` with inline
  `data={[...]}`. **Avoid textbook scans, Bloomberg screenshots, or
  third-party paid charts** — the repo is public and copyright risk is
  real. Use Wikimedia Commons as a backup for diagrams; never use the
  `materials/` folder. Before posting, run the `/copyright-check` skill:
  it runs the deterministic `scripts/check-copyright.mjs` gate (same as
  CI) plus the `copyright-critic` and `content-critic` agents. The
  cleared-sources allowlist (owner-confirmed LSEG/Refinitiv, Moody's,
  S&P) lives in `.claude/skills/copyright-check/accepted-sources.md`.
- **Schema change**: edit `supabase/schema.sql` (idempotent, always re-runnable),
  apply in Supabase SQL editor, rerun `npm run supabase:types`, commit both
  the SQL and the regenerated `database.types.ts`.
- **Open a PR**: branch naming `feat/<slug>`, `fix/<slug>`, `lesson/<slug>`,
  `chore/<slug>`. The PR template is required reading — fill the verification
  checklist.
- **New workshop**: drop a JSON under `src/content/workshops/` matching
  the `workshops` collection schema in `config.ts` (5–7 questions, course
  must be one of `eco-1002` / `fin-3610`). Visible at `/workshops/<slug>`
  and the per-course index `/{course}/workshops` to enrolled students
  (admin view-as also works).
- **Open a workshop window**: as a staff user, visit
  `/instructor/workshops/<slug>` and use the section/time/geofence form.
  Also supports SQL inserts; see `CONTRIBUTING.md`.
- **Promote a user**: in Supabase SQL Editor,
  ```sql
  update public.profiles set role = '<student|instructor|ta|admin>'
   where id = (select id from auth.users where email = '<them>');
  ```
  **Granting `admin` stays SQL-only by design.** `student|instructor|ta`
  can also be set from `/admin` (by email, or by approving a signup
  request). **Pending promotion** (account not yet created):
  `konstantin.kucheryavyy@baruch.cuny.edu` → `admin` after first signup.
- **Approve a staff-access request**: someone who picked lecturer or TA at
  signup appears in "Staff access requests" at the top of `/admin`
  (you also get an email). Approve sets the role immediately; deny leaves
  them a student. Both are audit-logged as `promote_role` with
  `metadata.via = 'signup_request'`, and neither can touch an admin
  account or re-decide a settled request.
- **Bootstrap a fresh Supabase project for dev/test**: run the full
  `supabase/schema.sql` once, sign up via `/auth/signup`, then in SQL Editor:
  `update auth.users set email_confirmed_at = now() where email = '<you>';`
  If signup pre-dated the schema, also:
  `insert into public.profiles (id, role) select id, 'student' from auth.users where email = '<you>' on conflict do nothing;`
  Then promote, enroll, and open a workshop administration per the examples
  in `CONTRIBUTING.md`.

## Verifying before declaring done

1. `npm run typecheck` — must pass.
2. `npm run format` — Prettier, configured in `.prettierrc.json` (single-quote,
   semi, `trailingComma: all`, `printWidth: 80`, `proseWrap: preserve`, plus
   `prettier-plugin-astro`). Safe and idempotent — the whole tree was
   normalized when the config landed, so a run only touches what you changed.
   `proseWrap: preserve` means lesson prose is never reflowed, and Prettier
   leaves `$…$` math untouched. Run it before committing.
3. `node --test 'src/lib/**/*.test.ts'` — unit tests for pure logic
   (aggregation, at-risk rules, CSV parsing, quiz grading). `node --test`
   strips TS types but does NOT resolve `@lib/*` path aliases, so anything
   it tests must be alias-free — that's why pure logic is split into
   `progress-aggregate.ts` / `roster-csv.ts` / `quiz/grade.ts` /
   `attendance-weekly.ts` / `auth/signup-role.ts` / `admin/role-decision.ts`,
   separate from the `@lib`-importing service-role modules. Keep that split
   when adding testable logic. 133 tests as of 2026-08-26.
4. `npm run build` — must compile cleanly. Build env needs at minimum:
   ```bash
   PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
   PUBLIC_SUPABASE_ANON_KEY=placeholder \
   PUBLIC_SITE_URL=http://localhost:4321 \
   npm run build
   ```
5. `npm run dev` and exercise the affected lesson/quiz in a browser.

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
