---
name: edu-web-supabase
description: "Safely change Supabase-backed behavior in Baruch Econ & Finance Studio. Use when modifying authentication, profiles, roles, enrollments, progress, quiz attempts, workshops, archives, audit logging, PII handling, database types, API routes, service-role access, or row-level-security policies."
---

# Change Supabase-backed features safely

Treat authorization, privacy, and backward compatibility as part of the feature—not cleanup after it.

## Trace the complete boundary

1. Read `AGENTS.md` and the relevant Supabase, role, archive, workshop, or enrollment conventions in `CLAUDE.md`.
2. Trace the request from page/form through API route and library to `supabase/schema.sql`; also inspect the generated `src/lib/supabase/database.types.ts` when table shape is involved.
3. State which actor may read or mutate each affected record: guest, student, TA, instructor, or admin. Identify the course, semester, and instructor-ownership boundary before writing code; enrollment authorization must not infer control of one term from control of another.

## Apply the project's security rules

- Keep `supabase/schema.sql` idempotent and make RLS policy changes explicit. RLS remains the source of truth for ordinary client data access.
- Use `isStaff`, `isAdmin`, and `isContentManager` from `src/lib/roles.ts`; never reproduce role comparisons inline.
- Use the service-role admin client only for the documented instructor-facing exception, after an application-side role and course-ownership check. Never expose a service-role credential or client behavior to the browser.
- Keep Supabase optional for public lessons and practice. Do not turn missing environment variables into a failure for public pages.
- Send progress through `src/lib/progress.ts`; use `hmacPII`/`hmacPIIHex` for sensitive identifiers and `logDisclosure` or `logDisclosureSafe` for audit events.
- Preserve the server-side quiz-grading boundary, validate request inputs, and redirect form-handler errors to the originating page rather than the API route.
- Keep the server-client constructor's cookie, headers, and request inputs intact. Do not weaken local cookie behavior while changing authentication.

## Verify the authorization model

1. Regenerate or reconcile database types after a schema change.
2. Apply the complete schema twice in a scratch Supabase/Postgres project and verify the new policies are idempotent.
3. Test both the permitted action and a representative forbidden cross-user or cross-course action. Confirm staff access remains limited to legitimate course scope.
4. Run focused tests, `npm run typecheck`, and `npm run build`; then exercise the browser flow while signed out and in the relevant role(s).
5. When project agents are available, delegate an independent read-only review to the `astro-supabase-reviewer` agent before handoff; otherwise complete the same review directly. Report any verification blocked by unavailable Supabase credentials rather than claiming it passed.
