# Plan: weekly attendance visibility (instructor grid + student card)

Interview (2026-08-25): attendance = workshop stamp-ins only; instructor
sees a weekly grid on the roster page; students see a dashboard card with
week-by-week status + a link to the open workshop.

Weeks are the distinct `week_of` Mondays of non-cancelled
`workshop_administrations` for the course/semester/instructor. No
semester calendar exists or is needed.

## Pieces

1. `src/lib/attendance-weekly.ts` — pure, alias-free, unit-tested.
   - `buildWeeklyAttendance(administrations, stamps, sectionByUser, nowMs)`
     → `{ weeks: WeekColumn[], cellsByUser }`.
   - A user is _eligible_ for a week when some administration that week
     matches their section (or has `section = null`, the fin-3610 case).
   - Cell values: `attended` (stamp in a section-matching admin that
     week), `missed` (eligible + every matching window closed, no stamp),
     `pending` (eligible, window still open/upcoming), `ineligible`.
2. Instructor grid: `class-roster.ts` adds `week_of` to the
   administrations select, builds the matrix, exposes
   `weeks` on `ClassRoster` and `weeklyCells` per student; roster CSV
   gains one `week_<monday>` column per week (1 / 0 / blank).
   `RosterTable.astro` renders scrollable ✓/✗/– columns after the
   existing Attendance total.
3. Student dashboard card: `dashboard.ts` gains
   `loadWeeklyAttendance(supabase, userId, course)` using the student's
   own RLS reads (`workshop_administrations` column-limited select +
   own `workshop_attendance`), reusing the same pure builder; the
   dashboard page renders a card: per-week ✓/✗/upcoming plus a stamp-in
   link to `/workshops/<slug>` when a window for their section is open
   now.

## Verify

- `node --test` on the new pure module (section matching, fin-3610 null
  section, missed-vs-pending boundary at `closes_at`, multi-admin weeks).
- typecheck, build, Playwright: roster grid renders; dashboard card
  renders for an enrolled student.
