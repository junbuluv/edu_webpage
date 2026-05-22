# Econ Studio

Interactive Economics & Finance lessons for undergraduate courses. Built with
Astro + React islands + Supabase. Lessons are MDX with embedded simulations
(IS-LM, AD-AS, Solow, Phillips); quizzes are JSON with auto-grading and
per-student progress tracking.

## Quick start

```bash
# 1. Install deps
npm install

# 2. Configure Supabase (free tier is fine)
cp .env.example .env
#   -> create a project at https://supabase.com
#   -> paste PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY
#   -> run supabase/schema.sql in the SQL editor

# 3. Generate typed DB client (optional but recommended)
npm run supabase:types

# 4. Run the dev server
npm run dev
```

Then open <http://localhost:4321>.

## What's in here

| Path | Purpose |
|---|---|
| `src/content/lessons/` | MDX lessons grouped by course (`macro/`, etc.). Frontmatter is typed in `src/content/config.ts`. |
| `src/content/quizzes/` | JSON quiz banks. Schema enforced by Zod via the same config file. |
| `src/components/viz/` | React islands for charts and simulations (Recharts). |
| `src/components/quiz/` | The auto-grading `<Quiz/>` island. |
| `src/lib/supabase/` | Server + browser Supabase clients, generated `database.types.ts`. |
| `src/lib/progress.ts` | Writes progress to Supabase if logged in, localStorage otherwise. |
| `src/middleware.ts` | Attaches `locals.supabase` and gates `/dashboard`. |
| `supabase/schema.sql` | DB schema (profiles, lesson_progress, quiz_attempts) with RLS. |
| `gstack_upstream/` | Reference clone of Garry Tan's gstack toolkit (gitignored). Use its slash commands while building. |

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

## Stack

- **Astro 5** with `output: 'server'` (Vercel/Cloudflare-friendly)
- **React 19** islands for interactivity only
- **Tailwind CSS** for styling
- **MDX** + **KaTeX** for lessons and math
- **Recharts** for charts (Plotly is wired in `astro.config.mjs` for heavier
  financial visualizations like yield curves and Monte Carlo waterfalls)
- **Supabase** (Postgres + auth + RLS) for accounts and progress

## Working with gstack

[gstack](https://github.com/garrytan/gstack) is a Claude Code skill toolkit
cloned into `gstack_upstream/` for reference. While building features here,
useful commands from gstack include:

- `/office-hours` — interrogate a feature idea before coding
- `/plan-eng-review` — lock implementation strategy
- `/review` — review your branch diff
- `/qa` — drive the dev server in a real browser

See `gstack_upstream/README.md` for the full list.

## License

MIT — see `LICENSE`.
