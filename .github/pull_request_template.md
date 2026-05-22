<!-- Keep this short. Aim: a reviewer can decide to LGTM without checking out the branch. -->

## What changed

<!-- 1–3 bullets describing the change. -->

## Why

<!-- One sentence. Link a course unit, issue, or instructor request if relevant. -->

## How to verify

- [ ] Affected lesson(s) render at `/lessons/<course>/<slug>`
- [ ] Affected quiz auto-grades correctly (try one correct, one wrong)
- [ ] If schema changed: `supabase/schema.sql` re-runs cleanly; types regenerated
- [ ] `npm run typecheck` passes locally
- [ ] `npm run build` passes locally

## Screenshots / GIFs

<!-- Required for any visual change (new lesson, new visualization, layout tweak). -->

## Out of scope

<!-- Anything explicitly NOT in this PR that a reviewer might wonder about. -->
