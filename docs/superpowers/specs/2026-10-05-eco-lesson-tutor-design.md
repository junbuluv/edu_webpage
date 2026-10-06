# ECO 1002 lesson tutor

**Date:** 2026-10-05
**Status:** Approved in brainstorming; implementation plan at
`docs/superpowers/plans/2026-10-05-eco-lesson-tutor.md`

## Goal

Give students a low-cost study chatbot inside the site: a coach that knows
the lesson they are reading, follows the course's integrity rules, and costs
a few dollars per semester.

## Decisions (from interview)

| Question | Decision |
|---|---|
| Where it lives | In the site, on lesson pages (not an external tool) |
| How much it gives away | Coach: explains concepts; on numeric problems asks for an attempt, hints step by step, gives the final number only after an attempt; never states answers to graded-looking items |
| Pilot course | ECO 1002 |
| Who turns it on | The site owner, once per course (`tutor: true` in course JSON) |
| Who can use it | Enrolled students and staff (`canViewCourse`) |
| Model | Cheapest configuration passing the eval; `openai/gpt-5-mini` at reasoning effort `low`, chosen 2026-10-06 (ECO 100%, FIN numeric 10/10, coaching 10/10; `gpt-6-luna` untested until paid credits), via Vercel AI Gateway |
| Eval pass bar | >= 90% of ECO quiz points, >= 8/10 FIN numeric, >= 8/10 coach transcripts |
| Limits | 40 messages per student per rolling 24 hours; $25/month gateway key budget |
| Stored data | Usage rows only (who, lesson, when, tokens); no message text |

## Timing

ECO 1002 has no production enrollments or teaching assignment yet and its
default semester is spring 2027, so this fall only staff can use the tutor.
Students get it once join codes or a roster import enroll them. ECO 1002 is
taught by Somekh, Kucheryavyy, and Joyce; the owner coordinates with them.

## Non-goals (v1)

Stored transcripts; instructor usage views; tutor on practice or workshop
pages; awareness of slider state; other lessons as context; per-instructor
opt-in.

## Design

1. **Components.** Course flag `tutor` in `src/content/config.ts`; island
   `TutorPanel` (floating button, side panel or bottom sheet, streamed
   markdown + KaTeX, messages-left counter, privacy note) mounted by
   `LessonLayout.astro` when the flag is on, `AI_GATEWAY_API_KEY` is set,
   and `canViewCourse` passes; endpoint `POST /api/tutor/chat`; pure helpers
   under `src/lib/tutor/`; server modules for the model, the flag check,
   and usage.
2. **Request flow.** The panel sends `{ lessonSlug, messages }` (last 10).
   The middleware applies its origin, 2 MB, and terms checks. The route
   answers 401 signed out, 503 without a key, 400 bad body, 404 unknown or
   draft lesson or flag off, 403 unless `canViewCourse`, 429 over the cap,
   then streams the reply. The server loads the lesson by slug; the prompt
   is coach rules plus lesson text only. Token counts are recorded after
   the stream. No identifiers go to the model; logs never hold message text.
3. **Data (`db:`).** `tutor_messages` (no text; RLS self-read; no client
   writes; column-level select grant), `consume_tutor_quota` (advisory lock,
   rolling 24-hour count, reserve-then-record, service role only), and a
   365-day `pg_cron` purge mirroring `purge_old_quiz_attempts`.
4. **Failure behavior.** No key: panel hidden, 503. Quota check error: 503
   (fail closed). Usage write error: logged, reply delivered. Budget hit
   (402, or a gateway error naming `quota_for_entity_exceeded`): "out of
   budget until next month". Cap hit: "try again tomorrow". Stream drop:
   partial reply kept, "Try again".
5. **Math in replies.** The model writes math as \( \) / \[ \] and money as
   $5; the panel converts delimiters and escapes money before remark-math
   (convention #22's trap).
6. **Testing.** Unit tests for every pure helper; schema applied twice plus
   RLS cases in CI; the eval script before launch; manual checks for gate,
   cap, failure copy, and mobile layout.
7. **Rollout.** Gateway key with a $25 monthly budget and alerts;
   `AI_GATEWAY_API_KEY` in all three Vercel scopes; schema pasted end-to-end
   in production before deploy; one PR titled `db: …`; CLAUDE.md subsystem
   entry and convention 23.
