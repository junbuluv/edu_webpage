# Architecture

Why Econ Studio is built the way it is. For setup and commands, see
`README.md`. For collaboration conventions, see `AGENTS.md`.

## The core idea

An econ/finance learning site lives or dies on two axes:

1. **Mathematical fidelity.** The lessons must show the same equations a
   professor would write on a board, with simulations calibrated to textbook
   intuitions.
2. **Cognitive bandwidth.** Students are reading on a laptop while doing
   problem sets. Pages that hesitate, or hammer their fan with JS, lose them.

So the architecture is "static lessons with surgical interactivity":

```
Browser                       Astro 5 (server output, edge-deployable)
─────────                    ─────────────────────────────────────────
                              ┌────────────────────────────────────┐
  GET /lessons/macro/is-lm    │ src/pages/lessons/[...slug].astro   │
  ──────────────────────────→ │ prerender=true → static HTML        │
                              │  + KaTeX-rendered math (server-side) │
                              │  + React island bundles (deferred)   │
                              └─────────────┬──────────────────────┘
                                            │
  GET /api/auth/signin                      │
  ──────────────────────────→  ┌────────────▼──────────────────────┐
                               │ Astro middleware                    │
                               │  • createSupabaseServerClient       │
                               │  • Astro.locals.user                │
                               └────────────┬──────────────────────┘
                                            │
                               ┌────────────▼──────────────────────┐
                               │ Supabase (Postgres + Auth + RLS)    │
                               │  • profiles                         │
                               │  • lesson_progress                  │
                               │  • quiz_attempts                    │
                               └─────────────────────────────────────┘
```

## Why Astro

- **Zero JS by default.** A pure-prose lesson ships HTML + CSS. Only the
  visualizations and quiz on that page hydrate as React islands. The student
  paying for cellular data downloads exactly the bytes their lesson needs.
- **Content collections.** Lessons and quizzes are typed via Zod — a missing
  `learningObjectives` field is a build error, not a runtime 500.
- **MDX-native.** Math, prose, and interactive islands compose in one file.
  Authoring a new lesson is opening a `.mdx` in any editor.
- **Server output.** We still get SSR for the dashboard, auth callbacks, and
  any future per-student personalization. The same codebase prerenders
  lessons and dynamically renders the dashboard.

## Why React (and only as islands)

React is the easiest place to find chart components and quiz patterns. But
shipping a full React app per page is wasteful when 80% of the page is text.
Islands give us "React where it earns its weight."

## Why Supabase

- Postgres + auth + row-level security in one place, free tier covers a class.
- RLS lets us encode policy *in the database*: "students only see their own
  attempts; instructors see the whole class." That's much harder to get
  wrong than per-route auth checks.
- The TypeScript codegen (`supabase gen types`) keeps `database.types.ts` in
  sync with the schema so the IDE catches table/column drift.

## Why Recharts (with Plotly on standby)

- Recharts handles ~95% of econ visualizations (IS-LM, Phillips, Solow,
  AD-AS) with a small bundle and SSR-safe rendering.
- Plotly is wired into `astro.config.mjs` for the heavier 5% — yield curves,
  Monte Carlo waterfalls, 3D surfaces. Pulled in only on lessons that need it.
- We deliberately avoid D3 directly: writing d3 selections inside React is
  more pain than it's worth for this scope. If a future lesson genuinely
  needs a custom visualization, drop the D3 in a Plotly `Plot` or a small
  custom canvas component.

## Why no LMS (yet)

This is courseware, not a learning-management system. The progress and quiz
tables are deliberately thin: per-user `lesson_progress` and append-only
`quiz_attempts`. If instructors later need rosters, due dates, or grades,
those become new tables — they don't reshape what's here.

## File layout (annotated)

```
src/
├── content/
│   ├── config.ts        # Zod schemas for lessons + quizzes
│   ├── lessons/macro/   # MDX lessons grouped by course
│   └── quizzes/         # JSON quiz banks
├── components/
│   ├── viz/             # Visualization islands (Recharts)
│   ├── quiz/            # Quiz engine
│   └── lesson/          # Lesson-page UI bits (progress button etc.)
├── layouts/             # BaseLayout, LessonLayout
├── lib/
│   ├── supabase/        # Server + browser clients, generated types
│   └── progress.ts      # Single entry point for progress writes
├── pages/
│   ├── index.astro
│   ├── macro/
│   ├── lessons/[...slug].astro
│   ├── practice/
│   ├── auth/
│   ├── api/auth/
│   └── dashboard/
└── middleware.ts        # Attach Supabase + gate /dashboard
```

## What's deliberately missing

- **No state library.** Add Zustand only when three+ components share state.
- **No client-side router.** Astro's MPA model is fine.
- **No GraphQL.** Supabase's PostgREST is enough; we type the responses.
- **No service worker / PWA.** Not needed for the current scope.
- **No mocking framework.** Until the test suite exists, integration testing
  is "drive the dev server."

The point of each "no" is to keep the surface area small enough that one
person can hold the whole repo in their head while authoring a lesson.
