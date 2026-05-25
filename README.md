# Baruch Econ & Finance Studio

Interactive Economics & Finance lessons for undergraduate courses. Built with
Astro + React islands + Supabase. Lessons are MDX with embedded simulations
(IS-LM, AD-AS, Solow, Phillips); quizzes are JSON with auto-grading and
per-student progress tracking.

**Repo**: <https://github.com/junbuluv/edu_webpage>
**Status**: scaffolded; macroeconomics course seeded.

## Quick start

Requirements: **Node 22+** (Supabase realtime needs native WebSocket).

```bash
# 1. Install deps
npm install

# 2. Run the dev server (lessons + practice work without Supabase)
npm run dev
```

Open <http://localhost:4321>. The macro lessons and practice quizzes render
immediately. Signing in and saving progress require Supabase — set that up next.

### Enabling auth + progress (Supabase)

```bash
# 1. Create a free project at https://supabase.com
# 2. Copy env template and paste your project URL + anon key
cp .env.example .env

# 3. In the Supabase SQL editor, run supabase/schema.sql

# 4. (Optional but recommended) Regenerate typed DB client
npm run supabase:types

# 5. Restart the dev server
npm run dev
```

Now `/dashboard` shows per-user lesson progress and quiz attempt history.

## What's in here

| Path | Purpose |
|---|---|
| `src/content/lessons/` | MDX lessons grouped by course (`macro/`, etc.). Frontmatter is typed in `src/content/config.ts`. |
| `src/content/quizzes/` | JSON quiz banks. Schema enforced by Zod via the same config file. |
| `src/components/viz/` | React islands for charts and simulations (Recharts). |
| `src/components/quiz/` | The auto-grading `<Quiz/>` island. |
| `src/lib/supabase/` | Server + browser Supabase clients, hand-written `database.types.ts` placeholder until you run `npm run supabase:types`. |
| `src/lib/progress.ts` | Writes progress to Supabase when signed in, localStorage otherwise. |
| `src/middleware.ts` | Attaches `Astro.locals.supabase` (nullable) and `Astro.locals.user`; gates `/dashboard`. |
| `supabase/schema.sql` | DB schema (profiles, lesson_progress, quiz_attempts) with RLS. |
| `.github/workflows/ci.yml` | CI on every PR: typecheck + build, Node 22. |
| `.github/CODEOWNERS`, `.github/pull_request_template.md` | Review routing + PR checklist. |
| `CONTRIBUTING.md` | How to add lessons, quizzes, visualizations, schema changes. |
| `gstack_upstream/` | Reference clone of Garry Tan's gstack toolkit (gitignored). Not a dependency. |

## Adding a lesson

1. Drop an `.mdx` file under `src/content/lessons/<course>/`.
2. Fill frontmatter (`title`, `course`, `unit`, `order`, `summary`,
   `learningObjectives`, `estimatedMinutes`). The Zod schema in
   `src/content/config.ts` will yell if anything is missing.
3. Import visualizations or interactive components inline:
   ```mdx
   import ISLMChart from '@components/viz/ISLMChart';
   <ISLMChart client:load />
   ```
4. (Optional) Add a quiz JSON under `src/content/quizzes/<slug>.json` and
   reference it via `quizSlug:` in the lesson frontmatter.

Math is rendered with KaTeX via `remark-math` + `rehype-katex`. Use `$inline$`
or `$$display$$` syntax inside MDX.

See **CONTRIBUTING.md** for branch-naming, PR conventions, and the full
authoring guide.

## Stack

- **Astro 5** with `output: 'server'` + **`@astrojs/vercel`** adapter
- **React 19** islands for interactivity only
- **Tailwind CSS** for styling (no shadcn-ui yet)
- **MDX** + **KaTeX** for lessons and math
- **Recharts** for charts (Plotly is wired in `astro.config.mjs` for heavier
  financial visualizations like yield curves and Monte Carlo waterfalls)
- **Supabase** (Postgres + auth + RLS) for accounts and progress
- **Node 22+** required

## Deploying

Designed for Vercel preview deploys: import the repo at <https://vercel.com>,
add the three env vars under Settings → Environment Variables for both
Production and Preview:

| Var | Scope |
|---|---|
| `PUBLIC_SUPABASE_URL` | Production + Preview + Development |
| `PUBLIC_SUPABASE_ANON_KEY` | Production + Preview + Development |
| `PUBLIC_SITE_URL` | Production = your prod URL; Preview = leave empty (Vercel auto-injects) |

Every PR then gets its own preview URL.

## Repository workflow

`main` is protected by a GitHub ruleset. To change anything:

```bash
git checkout -b feat/<short-slug>
# ... edits ...
git push -u origin feat/<short-slug>
gh pr create --fill
```

CI (`verify` job) runs typecheck + build. PRs cannot merge until it passes.
Direct pushes to `main` are rejected. See `CONTRIBUTING.md` for full details.

## Working with gstack

[gstack](https://github.com/garrytan/gstack) is a Claude Code skill toolkit
this project uses for AI-assisted workflows. Install once per developer:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

After install, useful commands while building:

- `/office-hours` — interrogate a feature idea before coding
- `/plan-eng-review` — lock implementation strategy
- `/review` — review your branch diff
- `/qa` — drive the dev server in a real browser
- `/ship` — bundle a PR with checks

See the full list with `/help` once installed, or read `gstack_upstream/README.md`.

## License

MIT — see `LICENSE`.
