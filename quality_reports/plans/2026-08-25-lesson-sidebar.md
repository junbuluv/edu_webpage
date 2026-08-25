# Plan: lesson navigation sidebar

Interview answers (2026-08-25): lessons grouped by unit only; progress
checkmarks yes; fixed sidebar ≥1024px, slide-over drawer below.

## Design

- New React island `src/components/lesson/LessonSidebar.tsx`
  - Props: `units: {unit: string; lessons: {slug, title, order}[]}[]`,
    `currentSlug`, `courseCode`, `courseHref`, `serverCompleted: string[]`.
  - Checkmarks: completed = serverCompleted ∪ localStorage
    (`edu_web:lesson_progress`, same key `LessonProgressButton` writes),
    merged in a `useEffect` so anonymous users get their local progress
    and SSR/hydration stay consistent.
  - Desktop (lg+): sticky `<aside>` in a grid column, scrollable.
  - Mobile: "Lessons" button fixed bottom-left opens an overlay drawer;
    closes on overlay click / Escape / navigation.
  - Current lesson highlighted + `aria-current="page"`; its unit list
    scrolled into view on mount.
- `src/layouts/LessonLayout.astro`
  - Build unit groups from `getCollection('lessons')` (already fetched)
    filtered by course + `!draft`, sorted with `compareLessons`
    (exported by `@lib/lesson/sequence`), grouped by `unit` in order.
  - Server completions: when `locals.supabase` + `locals.user`, select
    `lesson_slug` from `lesson_progress` where `status = 'completed'`
    (RLS scopes to the user); pass slugs to the island. Convention #4
    concerns _writes_; this is a page-level read like dashboard.ts does.
  - Wrap article in `lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]`,
    widen container to `max-w-6xl`; article keeps `max-w-3xl` inner.

## Non-goals

- No quizzes/workshops/archive in the tree (interview: lessons only).
- No open/closed persistence beyond the browser session.

## Verify

typecheck, format, build, manual `npm run dev` on a fin-3610 lesson
(desktop + narrow viewport), checkmark reflects completing a lesson.
