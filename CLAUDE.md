# Project memory for Claude Code

This is **Econ Studio**, an interactive Economics & Finance education site for
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
- Middleware injects `Astro.locals.supabase` (nullable) and `Astro.locals.user`
- Supabase types: `src/lib/supabase/database.types.ts` — must include `Relationships: []` per table and `CompositeTypes: Record<string, never>` to match what `@supabase/supabase-js` 2.106+ expects (don't drop these fields when hand-editing)

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

## Common tasks

- **New macro lesson**: copy `src/content/lessons/macro/is-lm-intro.mdx` as
  a template; pick a unique `order:` within the unit.
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

## Verifying before declaring done

1. `npm run typecheck` — must pass.
2. `npm run build` — must compile cleanly. Build env needs at minimum:
   ```bash
   PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
   PUBLIC_SUPABASE_ANON_KEY=placeholder \
   PUBLIC_SITE_URL=http://localhost:4321 \
   npm run build
   ```
3. `npm run dev` and exercise the affected lesson/quiz in a browser.

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
