# Session log: role audit (2026-10-07)

## Goal

Audit what students, instructors, and admins can see and do, judged as an
education site: access control, student-data privacy (FERPA), role views and
experience, and gaps against a typical LMS. Owner's choices: staging copy for
signed-in testing; deliverable is a report, owner picks the fixes.

## What was done

- Restored the paused audit project and applied the current `schema.sql` through
  the Supabase MCP in seven chunks, then proved the copy faithful with a catalog
  fingerprint (functions, policies, triggers, constraints, columns, grants)
  against a local replica. The same fingerprint, run read-only on production,
  doubles as a drift check.
- Seeded nine test personas and realistic data through the app's own RPCs.
- Ran a database access matrix (Data API, public key only), app-gate probes
  against a local server pointed at staging, role walkthroughs at desktop and
  phone widths, and an accessibility sweep of every lesson.
- Production was touched read-only (catalog queries, advisors, public auth
  settings).

## Outcome

- Report and evidence: `quality_reports/audits/2026-10-07-role-audit.md`, kept
  out of git (it describes unfixed issues; the repo is public).
- No Critical or High findings. Medium and Low items are listed in the report
  with fixes and effort.

## Cleanup

Staging paused; the staging env file, persona passwords, the temporary worktree,
and Playwright temp files deleted. Scripts to re-run the audit are archived next
to the report.

## Next

Owner picks which findings to fix; each becomes its own PR with a test that
fails first.

## Fixes shipped (same day)

The owner asked to fix every remaining finding. Decisions: an app-side
breached-password check (the Supabase org is on the Free plan), the at-risk
flag on first-try quiz scores, and merge + deploy + production database
changes through the MCP after local rehearsal.

- #130 `db:` explicit `role_requests` grants, an upgrade-safe TA block,
  `log_disclosure()` retired; `privilege_hygiene.sql` in CI. Applied to
  production through the MCP and verified with the hygiene suite.
- #131 `db:` signup domain allowlist enforced by a Supabase Auth hook;
  function created in production. The hook itself needs enabling in the
  dashboard (owner step).
- #132 accessibility: named chart controls, skip link, keyboard focus start
  on lessons, `/accessibility` statement; phone overflow on two lessons fixed.
- #133 accessibility: text alternatives and live value readouts for all
  interactive charts (`ChartFrame`).
- #134 `/privacy`: the AI study tutor, service providers, admin wording.
- #135 roster: at-risk on first-try scores; first/best and attempts on the
  roster and CSV; CSV export moved into a tested module and its formula
  escape hardened (flagged by a commit security review), shared with the
  workshop attendance export.
- #136 role-view wording, the student's section on the course card, a 403
  for denied archive access, the last TA mentions.
- #137 breached passwords refused at signup, password change, and reset.

## Owner steps left

- Enable the Before User Created hook (Supabase Dashboard, Authentication,
  Hooks).
- Decide whether the privacy update needs re-acceptance
  (`CURRENT_TERMS_VERSION`).
- Confirm ECO 1002's `defaultSemester` (spring-2027).
