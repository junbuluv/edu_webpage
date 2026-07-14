---
name: edu-web-maintenance
description: "Maintain and extend Baruch Econ & Finance Studio, its Astro pages, React visualization islands, MDX lessons, JSON quizzes, course workflows, and supporting TypeScript. Use when fixing a bug, improving an existing feature, adding a courseware feature, creating a visualization, or changing lesson/quiz content in this repository."
---

# Maintain Baruch Econ & Finance Studio

Preserve the site as a lightweight, mathematically reliable undergraduate learning product. Make the smallest compatible change that completely serves the request.

## Orient before editing

1. Read `AGENTS.md`, then the relevant sections of `CLAUDE.md`.
2. Check `git status --short`; preserve unrelated work in the tree.
3. Find and inspect the closest existing implementation before designing a new pattern. Trace a user-visible flow across its page, component, API route, library, and schema as applicable.

## Choose the right path

- **Lesson or quiz content:** Keep lessons in `src/content/lessons/` and quizzes in `src/content/quizzes/`. Match the collection schema in `src/content/config.ts`; use `$copyright-check` before handoff whenever MDX, quiz JSON, figures, or images change.
- **Visualization:** Use a React island only for genuine interaction. Put the equation before the intuition and simulation, use calibrated defaults and useful slider ranges, expose a reset, and name baseline parameters in the chart caption. Avoid new heavy charting dependencies.
- **Quiz behavior:** Keep answer keys out of the rendered client payload. Reuse server grading and the public-question transformation rather than inventing a second grading path.
- **Progress or access:** Route progress writes through `src/lib/progress.ts`. Invoke `$edu-web-supabase` for any auth, role, enrollment, archive, workshop, database, or API access-control change.

## Implement

- Prefer typed content entries, existing aliases, and existing shared helpers over raw imports or duplicate logic.
- Preserve guest, browse-mode, enrolled-student, staff, and admin behavior unless the request explicitly changes an access tier.
- Keep Astro pages mostly server-rendered and ship React only to the island that needs it. Prefer local component state; introduce shared state only when three or more islands genuinely need it.
- Do not move content out of `src/content/`, import from `gstack_upstream/`, or introduce a partial design system.
- Add focused tests for new pure business logic when its neighbors use that pattern.

## Verify and hand off

1. Run relevant focused tests, then `npm run typecheck` and `npm run build`.
2. Run `npm run dev` and exercise the affected route in a browser, including the changed interaction or access state.
3. When project agents are available, delegate a read-only review to `econ-finance-reviewer` for changed formulas, calibrated visualizations, or assessment logic, and to `astro-supabase-reviewer` for auth, data, route, island, or performance-sensitive changes. Otherwise perform the corresponding review directly.
4. Report the changed behavior, verification actually completed, and any unrun check or external prerequisite. Do not stage, commit, deploy, or change unrelated files without authorization.
