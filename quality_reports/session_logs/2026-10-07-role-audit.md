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
