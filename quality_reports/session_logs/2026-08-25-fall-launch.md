# Session log — 2026-08-25 (Fall 2026 launch prep)

## Shipped (all merged to main + deployed to production)

- **#108** `login.cuny.edu` added to the signup email allowlist (roster
  emails are CUNY SSO addresses; import matches by email).
- **#109** `codex/workshop-integrity` merged: workshop/Supabase
  hardening incl. `teaching_assignments`; fixed its CI
  schema-roundtrip cleanup (deactivate assignment fixtures before
  delete — the new guard trigger forbids deleting active rows).
- **#110** FIN 3610 Foundations content fixes from a content-critic
  audit: recalibrated the NPV worked example (old Project B had IRR 0%,
  not ~12%), corrected the law-of-one-price arbitrage trade, plus
  calibration/tone fixes and a new IRR-vs-NPV numeric quiz question.
- **#111** Lesson sidebar: unit-grouped course map on every lesson page,
  current-lesson highlight, progress checkmarks (server RLS read merged
  with localStorage), fixed on desktop / drawer on mobile.
- **#112** Domain cutover: `site:` → `https://baruchfinance.com`.
- **#113** Weekly attendance: pure `src/lib/attendance-weekly.ts`
  matrix builder (unit-tested); instructor roster gains per-week ✓/✗
  columns + CSV `week_<monday>` columns; student dashboard gains a
  Workshop attendance card with an open-window stamp-in link.

## Infrastructure (outside git)

- Prod DB (`txkxyotqtoqrxjtqtpsq`): created `teaching_assignments`
  (verbatim from the branch schema, via MCP migration) + active
  fall-2026 FIN 3610 assignment for hyunjun.yoo@baruch.cuny.edu (admin).
- Domain **baruchfinance.com**: Cloudflare Registrar/DNS (DNS-only),
  apex + www on Vercel project `edu-webpage`, TLS live.
- Email: Resend custom SMTP in Supabase Auth
  (`noreply@baruchfinance.com`); domain verified; **end-to-end signup
  test delivered to a @baruch.cuny.edu inbox and the account
  confirmed** (SafeLinks consumes the confirm link first — cosmetic
  "missing code" on the student's own click; account still confirmed).
  Test account deleted. `PUBLIC_SITE_URL` env → new domain.
- Roster: Brightspace export reformatted to
  `materials/rosters/fin-3610-fall-2026.csv` (85 students, all
  @login.cuny.edu); original moved into gitignored `materials/`.

## Open items

1. Open the first Fall 2026 workshop window, then sanity-check the new
   attendance grid + dashboard card on live data.
2. Announce signup to students (baruchfinance.com/auth/signup, CUNY
   login email, "error after clicking confirm = already confirmed,
   just sign in"). Then run the roster import (`fall-2026`).
3. Rotate the Resend API key (passed through chat) at leisure.
4. Backlog: options payoff-diagram viz for lessons 25–26; friendlier
   auth-callback error page for the SafeLinks case; AI tutor panel
   (declined for now on cost).

## Evening addendum (attendance E2E + fixes)

- Full production E2E test with disposable accounts (instructor +
  student, both deleted after): window open → geofenced stamp →
  student dashboard card → roster grid → CSV. All pass.
- Bugs found by testing, both fixed:
  - Missing #109 DB objects in prod (accept_terms,
    record_workshop_stamp, …) — fixed by full schema.sql apply after
    deleting 4 unlabeled May test workshop rows (owner-confirmed).
  - **#114**: signed-in lesson progress never reached the server —
    browser Supabase client can't read httpOnly session cookies, so
    auth.getUser() was always null and writes stayed localStorage-only.
  - **#115**: /account/password change-password page (current-password
    re-auth, dashboard link); /auth/reset now recovery-sessions-only
    via JWT amr claim. Live-verified.
- Cleanup done: all test accounts/rows removed. Left in place
  (pre-existing, owner to decide): owner's spring-2027 self-enrollment
  + inactive spring-2027 teaching assignment.
