# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Baruch College undergraduates in FIN 3610 (Corporate Finance) come first. They read lessons, move the simulations, take practice quizzes, stamp in to in-class workshops, and ask the lesson tutor for help. They use phones in class (workshop stamp-in only works inside the room) and laptops at home for lessons and quizzes, about equally.

Instructors and admins are secondary users. Instructors manage rosters, open workshop windows, watch at-risk flags and attendance, and curate the course archive. Admins grant teaching assignments and approve staff-access requests.

## Product Purpose

The Studio teaches corporate finance by letting students change a model and watch the result. Each lesson leads with the equation, then the intuition, then a simulation. Success means a student can predict what a financing change does before the chart shows it, and an instructor can see who is falling behind early enough to help.

## Positioning

- **Simulations you move.** Sliders and draggable curves are tied to the lesson's equations and calibrated so students see the textbook result.
- **Built for this course.** Lessons, quizzes and workshops follow the FIN 3610 syllabus at Baruch and are written by the course instructor.
- **Free for students.** No publisher access code or textbook bundle.
- **A tutor that coaches.** The AI tutor guides students through the current lesson and never hands out quiz answers.

## Operating Context

- Lessons are public; progress, the tutor, workshops and the course archive need a sign-in with a CUNY address (`baruchmail.cuny.edu`, `baruch.cuny.edu`, `login.cuny.edu`) or `gmail.com` as a fallback.
- Workshops are timed windows that an instructor opens for one class in one room. Students stamp in on a phone within a geofence, and the roster shows week-by-week attendance.
- Practice quizzes are graded on the server and show answers after each attempt, so the roster's at-risk rule uses first-try scores.
- Course archive: enrolled students and staff browse prior-term notes, quizzes and papers.

## Capabilities and Constraints

- Astro 5 server-rendered pages with React islands for charts, quizzes and the tutor; Supabase for sign-in and progress; deployed on Vercel.
- Lessons and practice keep working when Supabase is not configured.
- Quiz answers never reach the browser; grading is server-side.
- The repository is public. Third-party copyrighted material (textbook scans, publisher figures, paid charts) is never used; empirical figures come from FRED, SEC filings, or Wikimedia Commons.
- Personal identifiers other than display names are stored only as keyed hashes.
- Terminology: "workshop" (in-class activity window), "stamp in" (attendance check-in), "teaching assignment" (an instructor's right to manage one course in one semester).

## Brand Commitments

- Baruch College visual identity: the site should read as Baruch at a glance. Official colors and names come from the Baruch Brand Identity Guidelines (2022) and the OCMPA design cheat sheet (2024); see `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md`.
- Each course has an identity color in `src/content/courses/<slug>.json`.
- Voice for content: direct, mathematical when useful, no padding. Lead with the equation, then the intuition, then the simulation. No em dashes.

## Evidence on Hand

- 28 FIN 3610 lessons in `src/content/lessons/`, 28 quizzes in `src/content/quizzes/`, 6 workshops in `src/content/workshops/`.
- 12 interactive chart components in `src/components/viz/`.
- Instructor headshots in `public/instructors/`; lesson figures in `public/figures/<course>/<lesson>/`.
- No testimonials, outcome data, enrollment numbers, or institutional endorsements exist. Do not invent them.

## Product Principles

1. The model is the lesson. Every interactive element changes a real parameter and shows the textbook consequence.
2. Students learn by working, not by being told. Answers stay server-side, and the tutor coaches instead of solving.
3. Course-specific beats generic. Content follows the Baruch syllabus and terminology.
4. Instructors see problems early. Roster signals favor honest first attempts over best scores.
5. Students' data stays minimal. Collect only what a feature needs, hash identifiers, and keep the public repo free of private or copyrighted material.

## Accessibility & Inclusion

WCAG 2.1 AA is the published commitment (`/accessibility`). Every text and chart color pair is checked by `src/lib/theme/theme-tokens.test.ts`; every form control needs an accessible name (`src/lib/a11y/control-labels.test.ts`); every chart carries a text description and a live summary of its current values (`ChartFrame`, enforced by `src/lib/a11y/chart-alternatives.test.ts`). Chart series colors stay distinguishable for colorblind readers.
