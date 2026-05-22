# AGENTS

Conventions for AI agents (Claude Code, OpenClaw, etc.) collaborating on
**Econ Studio**.

## Identity

You are working on an interactive economics-and-finance courseware site for
undergraduate students. The audience is unforgiving about two things:

1. **Mathematical correctness.** Wrong formulas, mislabeled axes, or
   uncalibrated parameters destroy trust faster than a typo in prose.
2. **Page weight.** Students load this on phones and library Wi-Fi. Stay
   inside Astro's islands model. Don't accidentally ship megabytes of JS to a
   text-only lesson.

## House style

- Lessons: equation → intuition → simulation. Never bury the formula.
- Captions on every chart name the parameter values used.
- Prose is concise. No filler clauses like "in this lesson, we will explore."
- Math formatting: `$inline$` and `$$display$$` only. KaTeX is configured.
- Numbers: keep significant figures meaningful (3 sig figs is usually right).

## Code expectations

- **Type-safety**: prefer `astro:content` typed entries to raw imports.
- **Components**: each `viz` component owns its parameters and exposes them
  via sliders. Default to a calibrated baseline; provide a "Reset" affordance.
- **State**: per-component `useState` is fine. Reach for `zustand` only when
  three or more components share state in a single page.
- **Data writes**: go through `src/lib/progress.ts`. Don't hand-roll Supabase
  inserts in components.
- **No comments** explaining what the code already says. Reserve comments for
  non-obvious *why* (e.g. parameter calibration rationale, RLS subtleties).

## Tests / verification

There is no test suite yet. Before declaring a task done:

1. `npm run typecheck` — must pass.
2. `npm run build` — must compile cleanly.
3. Spin up `npm run dev` and exercise the affected lesson/quiz in a browser.

If you touched anything Supabase-related, re-run `supabase/schema.sql` in a
scratch project, confirm RLS policies still allow self-reads and block
cross-user reads.

## What not to do

- Don't add a heavy charting library (D3, ECharts, ag-grid) without a concrete
  need that Recharts/Plotly can't cover.
- Don't move lessons out of `src/content/`. The collections are typed there
  for a reason.
- Don't introduce shadcn-ui partially — either commit to it across the app or
  stay with Tailwind primitives.
- Don't import from `gstack_upstream/`. It's a reference toolkit, not a dep.

## Useful gstack commands while editing

- `/office-hours` — pressure-test feature scope before writing code
- `/plan-eng-review` — lock the implementation plan
- `/review` — diff review focused on correctness + perf
- `/qa` — drive the dev server in a real browser
- `/document-release` — refresh README + schema docs after a feature lands
