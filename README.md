# Baruch Econ & Finance Studio

Interactive lessons for **FIN 3610, Corporate Finance**, at Baruch College.
Each lesson states the equation, explains the intuition, then lets the student
move the inputs in a chart. Practice quizzes are graded on the server, and
signed-in students keep their progress.

**Live site**: <https://baruchfinance.com>
**Repo**: <https://github.com/junbuluv/edu_webpage>

## What the site does

- **Lessons**: MDX lessons with math (KaTeX) and interactive charts (bond
  pricing, the efficient frontier, WACC, credit spreads and others).
- **Practice quizzes**: answers never reach the browser; the server grades
  each attempt.
- **Workshops**: weekly small-group sessions. Students stamp in during an
  open window, and the instructor sees attendance week by week.
- **Instructor tools**: class rosters with progress and at-risk flags, CSV
  import and export, and an archive of prior-term exams and assignments.
- **Lesson tutor**: an optional chat that coaches a student through the
  lesson they are reading without handing out answers.
- **Accounts**: student, instructor and admin roles. Access rules live in the
  database (row-level security), not only in the app.

## Quick start

Requirements: **Node 22.x** (the version Vercel and CI use; see `.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:4321>. Lessons and practice quizzes work without any
setup. Signing in and saving progress need Supabase.

### Enabling accounts and progress (Supabase)

1. Create a project at <https://supabase.com>.
2. Copy the env template and fill in the project URL and keys:

   ```bash
   cp .env.example .env
   ```

3. Paste all of `supabase/schema.sql` into the Supabase SQL editor and run
   it. The file is safe to run again.
4. Restart `npm run dev`.

`CONTRIBUTING.md` covers the first admin account, opening a workshop window
and the auth email settings.

## What's in here

| Path                            | Purpose                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `src/content/lessons/fin-3610/` | Lessons (MDX). Frontmatter is typed in `src/content/config.ts`.              |
| `src/content/quizzes/`          | Quiz banks (JSON), checked against the same config file.                     |
| `src/content/workshops/`        | Workshop question sets (JSON).                                               |
| `src/components/viz/`           | Interactive charts (React islands, Recharts).                                |
| `src/components/quiz/Quiz.tsx`  | The quiz island; it posts answers to `/api/quiz/grade`.                      |
| `src/lib/`                      | Shared logic. Pure modules sit next to their `*.test.ts` unit tests.         |
| `src/pages/`                    | Pages and API routes (lessons, practice, dashboard, instructor, admin).      |
| `src/middleware.ts`             | Sets `Astro.locals.supabase` and `Astro.locals.user`; guards routes.         |
| `supabase/schema.sql`           | The whole database: tables, access rules, functions.                         |
| `supabase/tests/`               | SQL tests for the access rules; CI runs them on a scratch Postgres.          |
| `.github/workflows/ci.yml`      | CI: unit tests, typecheck, build, schema tests, copyright and design checks. |
| `CONTRIBUTING.md`               | How to add lessons, quizzes, charts and schema changes.                      |
| `CLAUDE.md`                     | Project conventions and the reasons behind them.                             |

## Adding a lesson

1. Copy `src/content/lessons/fin-3610/credit-risk-and-spreads.mdx` and rename
   it. Pick an `order:` no other lesson in the course uses.
2. Fill in the frontmatter. The build fails if a required field is missing.
3. Import a chart where the lesson needs one:

   ```mdx
   import CreditSpreadExplorer from '@components/viz/CreditSpreadExplorer';

   <CreditSpreadExplorer client:load />
   ```

4. To attach a quiz, add `src/content/quizzes/<slug>.json` and set `quizSlug:`
   in the lesson frontmatter.

Write math as `$inline$` or `$$display$$`. See `CONTRIBUTING.md` for the full
authoring guide, including the rules for figures and their sources.

## Stack

- **Astro 5** (`output: 'server'`) with the `@astrojs/vercel` adapter
- **React 19** islands, only where a page is interactive
- **Tailwind CSS** with the Baruch Blue theme tokens
- **MDX** and **KaTeX** for lessons and math
- **Recharts** for charts
- **Supabase** (Postgres, auth, row-level security)

## Checks before a pull request

```bash
npm run typecheck
```

```bash
npm run format
```

```bash
npm test
```

```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build
```

`main` is protected: every change goes through a pull request, and the
`verify` (tests, typecheck, build) and `design-detect` jobs must pass before
it can merge.

## Deploying

The site runs on Vercel. Set these under Settings → Environment Variables:

| Var                         | Scope                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`       | Production + Preview                                                 |
| `PUBLIC_SUPABASE_ANON_KEY`  | Production + Preview                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview; sensitive                                      |
| `PII_HMAC_SECRET`           | Production + Preview; sensitive                                      |
| `PUBLIC_SITE_URL`           | Production = the site URL; Preview may be empty                      |
| `CRON_SECRET`               | Production only; random 16+ character value; sensitive               |
| `RESEND_API_KEY`            | Optional: Production; admin alert email                              |
| `AI_GATEWAY_API_KEY`        | Optional: Production + Preview; sensitive; turns on the lesson tutor |

Redeploy after changing any of them. `vercel.json` registers a daily cleanup
of unfinished archive uploads; Vercel sends `CRON_SECRET` to that endpoint as
a bearer token. In Supabase Auth URL Configuration, keep the exact production
callback and add `https://*-<team-or-account-slug>.vercel.app/**` so
confirmation and recovery links can return to Vercel previews.

## License

MIT. See `LICENSE`.
