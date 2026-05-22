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
