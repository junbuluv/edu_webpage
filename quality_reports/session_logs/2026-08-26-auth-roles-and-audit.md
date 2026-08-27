# Session log — 2026-08-26 (FIN 3610 audit, auth hardening, signup roles)

Continues [2026-08-25](2026-08-25-fall-launch.md). Everything below is
merged to `main` and deployed to production.

## Shipped

- **#117** FIN 3610 content blockers from the copyright/content audit:
  NPV at 15% (+0.19, not +0.38); convexity direction reversed; credit-spread
  decomposition double-counted expected loss; the multiples worked example
  was internally impossible (EPS × shares exceeded EBITDA) and blamed a 5×
  gap on leverage; unit-4 workshop notes doubled a covariance cross-term, so
  TAs would have graded the correct answer (σ = 20.4%) wrong.
- **#118** Cross-device email confirmation. `/auth/confirm` validates
  `?token_hash=&type=` with `verifyOtp` server-side. The PKCE `?code=` flow
  only completes in the browser that started signup, so clicking a
  confirmation link on a phone failed with a raw "PKCE code verifier not
  found in storage" error.
- **#119** Password minimum 12 → 8 (owner's call; 8 is the NIST SP 800-63B
  floor). App-side choice, not a platform limit — the backend accepts 8.
- **#115** `/account/password`: signed-in change with current-password
  re-authentication, linked from the dashboard. `/auth/reset` is now
  restricted to recovery-link sessions via the JWT `amr` claim.
- **#120** Signup role selection (student / lecturer / TA) + student ID.
  Staff roles are **requests** in the new `role_requests` table, approved
  from a queue on `/admin` with an email alert. Student IDs are HMAC'd,
  uniquely indexed, and excluded from the authenticated column grant.
- **#121** Two CI breakages that had `schema-roundtrip` red on `main` since
  Wednesday morning. See "Lessons" below.
- **#122** Post-signup writes never ran. See "Lessons" below.
- **#116** `defaultSemester` → `fall-2026`; session logs committed.

## Lessons worth remembering

1. **`signUp()` returns `data.user === null` on this project**, with no
   error, because GoTrue returns a bare user object for
   confirmation-required signups and supabase-js maps that to null. Every
   `if (data.user)` branch was dead code, so **terms acceptance had never
   been recorded at signup** — the `/account/terms` gate silently covered
   for it. Now convention #20.
2. **Don't pin CI to a commit on a feature branch.** The upgrade test used
   `git show <sha>`; rebasing that branch before merge orphaned the SHA.
   It still resolved locally (pre-rebase objects), which is exactly why it
   looked fine here and failed in CI. The pre-upgrade schema is now vendored
   as a fixture.
3. **Don't write date-dependent test fixtures.** A workshop fixture paired
   section `CTL` with `opens_at = now()`, so the RLS suite passed only on
   Tuesdays.
4. **Repointing a "before" schema needs a diff, not an assumption.** Main's
   pre-#109 schema was _older_ than the orphaned branch commit (no
   `lesson_progress.course_slug`), so the first repoint failed differently.
5. **Live end-to-end testing earned its keep three times**: it found the
   missing production DB functions (yesterday), the httpOnly-session
   progress bug (#114), and the null-user signup bug (#122). None were
   visible to typecheck, unit tests, or CI.

## Audit results (FIN 3610)

- **Copyright: safe to post, 0 blockers.** All 22 figures credit sanctioned
  sources; no `materials/` references or hotlinks; Berk-DeMarzo derivation
  risk explicitly refuted. Left open by owner's instruction: 1 low warning
  (uncited industry-beta table) + 4 notes.
- **Content: 5 blockers fixed (#117), ~11 warnings + ~7 notes left.**
  Notable open ones: Apple called "minimal debt" while the MM chart shows it
  most levered; "$1.5T ≈ 6% of US market cap" (~3%); Microsoft FY18 dividend
  $1.68 not $1.72; an impossible tornado row; three worked examples reused
  verbatim across lesson → quiz → workshop; two all-correct multi-selects;
  119 em-dashes across 17 lessons.

## Open items

1. Announce signup; import the roster once students register.
2. **Weak passwords accepted**: minimum 8 with leaked-password protection
   off means `password` and `12345678` are valid. Enable Supabase's toggle
   or add an app-side blocklist.
3. Rotate the Resend API key (exposed in chat; now also in Vercel env).
4. Owner couldn't reach baruchfinance.com mid-afternoon; cause never
   identified (suspected new-domain filtering). Appeared to resolve.
5. Owner's own account has no student ID (registered during the #122 bug
   window).
6. `eco-1002.json` still `defaultSemester: spring-2027`.
7. Deferred: roster matching by student ID; options payoff visualizer for
   the four interactivity-free FIN lessons; AI tutor panel (cost).
