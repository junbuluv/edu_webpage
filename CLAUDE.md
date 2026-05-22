# Project memory for Claude Code

This is **Econ Studio**, an interactive Economics & Finance education site for
undergraduates. Lessons are MDX with embedded React-island simulations;
quizzes are JSON; progress + auth live in Supabase.

## Stack at a glance

- Astro 5 (`output: 'server'`) + React 19 islands
- Tailwind CSS (no shadcn-ui yet; primitive HTML + Tailwind is fine for now)
- MDX with `remark-math` + `rehype-katex` for inline/display math
- Recharts for most charts; Plotly available for heavier finance visualizations
- Supabase (Postgres + auth + RLS) — see `supabase/schema.sql`

Path aliases in `tsconfig.json`: `@components/*`, `@layouts/*`, `@lib/*`, `@content/*`, `@/*`.

## Where things live

- Lessons: `src/content/lessons/<course>/<slug>.mdx`
- Quizzes: `src/content/quizzes/<slug>.json`
- Content schemas (frontmatter + quiz shape): `src/content/config.ts`
- Visualizations: `src/components/viz/`
- Quiz engine: `src/components/quiz/Quiz.tsx`
- Auth pages: `src/pages/auth/`, API routes under `src/pages/api/auth/`
- Middleware injects `Astro.locals.supabase` and `Astro.locals.user`

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
5. **RLS is the source of truth for access control.** When adding a table,
   add policies in `supabase/schema.sql` and regenerate types via
   `npm run supabase:types`.
6. **Keep lessons calibrated.** If a slider is added, pick parameter ranges
   where students see textbook intuitions (e.g. fiscal expansion raises both Y
   and r). Document the parameter choice in a small caption.

## Common tasks

- New macro lesson: copy `src/content/lessons/macro/is-lm-intro.mdx` as a
  template; pick a unique `order:` within the unit.
- New quiz: add JSON under `src/content/quizzes/`. The slug must match
  `quizSlug:` in the lesson frontmatter to link them.
- New visualization: drop a `.tsx` under `src/components/viz/`. Keep it
  self-contained, accept props for any tunable parameters, default to a
  calibrated baseline.
- Schema change: edit `supabase/schema.sql`, run it in Supabase SQL editor,
  rerun `npm run supabase:types`.

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
