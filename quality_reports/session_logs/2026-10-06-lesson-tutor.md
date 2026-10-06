# Session log — 2026-10-05/06 (ECO 1002 lesson tutor: research, spec, plan, implementation)

Continues [2026-09-27](2026-09-27-baruch-blue-theme.md). Branch
`feat/lesson-tutor` (off `main` babc9a5) holds the whole feature; PR #126 is
open with CI green.

## Decided

- The owner asked for the lowest-cost study chatbot. Compared: free CUNY
  options (CUNY AI Lab pilot class, Microsoft Copilot Chat agents),
  NotebookLM, and an in-site tutor. Chosen: **in-site tutor on the cheapest
  current model through Vercel AI Gateway** (`openai/gpt-6-luna`, about
  $4–10 per 100 students per semester). There is no "GPT-6.1 Luna".
- Interview: coach mode (explain concepts; on numeric problems ask for an
  attempt and hint step by step), **ECO 1002 pilot**, one course-wide flag the
  owner controls, model pass bar 90% ECO / 8 of 10 FIN numeric / 8 of 10
  coach transcripts.
- ECO 1002 has no production enrollments or teaching assignment and defaults
  to spring 2027, so this fall only staff can use the tutor. ECO 1002 is
  taught by Somekh, Kucheryavyy, and Joyce; the owner tells them.
- Spec `docs/superpowers/specs/2026-10-05-eco-lesson-tutor-design.md`, plan
  `docs/superpowers/plans/2026-10-05-eco-lesson-tutor.md` (12 tasks),
  executed inline with one fresh whole-branch review.

## Shipped (on the branch)

- Pure, unit-tested helpers in `src/lib/tutor/`: request sanitizing, lesson
  MDX to text, coach prompt, provider options, money-vs-math rendering, error
  codes, eval scoring, the messages-left counter, and the UI stream wrapper.
- `POST /api/tutor/chat` (AI SDK 7.0.128 via AI Gateway), `TutorPanel` on
  ECO lessons, the `tutor` course flag, env typing.
- `db:` `tutor_messages` (no message text), `consume_tutor_quota` (40 per
  rolling 24 hours), a 365-day purge, lockdown grants, RLS tests.
- `scripts/tutor-eval.ts` (not yet run). CLAUDE.md: subsystem entry,
  convention 23, env note.
- Verification: 218/218 unit tests, `astro check` 0/0, build OK; schema
  applied twice plus the RLS suite on an embedded Postgres 15 (no Docker
  here); signed-out endpoint 401, cross-origin 403; panel checked in
  Playwright against a mocked endpoint fed real AI SDK streams.
  **Not verified:** any real model call, any signed-in flow, the schema on a
  hosted project.

## Found and fixed along the way

- Background security review: older messages were capped per text part, so
  one forged request could carry about 1.8M characters. Parts now merge per
  message before any cap (`91ce6de`).
- AI SDK 7 renames vs. the plan: `onEnd` (onFinish deprecated),
  `usage.outputTokenDetails.reasoningTokens`, and
  `createUIMessageStreamResponse` (`toUIMessageStreamResponse` deprecated).
- Final review ("with fixes"): a model call that failed before any text kept
  its quota slot while the counter never moved, so an outage could quietly
  use up a student's day. The fix (`09b4ec0`) refunded such slots, sent the
  server's exact count with each reply, and stopped streaming reasoning to
  the browser. A follow-up background security review showed the refund
  reopened the cap (a client could force failures, for example by aborting,
  and retry for free), so the refund is gone: every attempt counts, and the
  server's count now rides on each reply as it starts, so the counter drops
  visibly even when an attempt fails.

## Model eval (Task 10, 2026-10-06)

- The free AI Gateway tier refuses `gpt-6-luna` and the Claude models; only
  `gpt-5-mini` runs, at 5 requests a minute across the team.
- First two `gpt-5-mini` runs were void: the eval prompt showed a sample
  line ("ANSWER: 12.5"), and the model copied it after reasoning to the right
  answer in 14 of 17 "misses". The runner now describes the answer line,
  waits out rate limits, and lists every miss.
- Clean run: `gpt-5-mini` at effort low scored ECO 60/60 and FIN numeric
  10/10, and coached in all 10 "just give me the answer" transcripts (three
  concept answers ran about 200 words). The owner chose it; it is now the
  default. `gpt-6-luna` (about 3x cheaper per token) waits for paid credits.

## Rollout (2026-10-06)

- Production schema applied by the owner; checked read-only (both functions,
  the empty table, client grants, the purge cron job).
- Rollout steps 4 to 6 run by the agent through the Vercel CLI, because the
  Vercel MCP grant came back with no team access:
  - `AI_GATEWAY_API_KEY` is a sensitive var on Production and Preview. CLI 54
    in agent mode loops on `git_branch_required` for Preview, so Production
    was added first and its targets patched to include Preview.
  - Fluid compute is on (300 s default function timeout).
  - The PR preview was rebuilt with the key (`edu-webpage-di97wol9e-…`,
    Ready, clean build log). Previews sit behind Vercel Authentication, so the
    signed-in check is the owner's.
- Found, not part of this PR: the project has no `CRON_SECRET`, so the daily
  `/api/cron/archive-upload-cleanup` run is rejected with 401.

## Open items for the owner

1. Sign in on the rebuilt preview as admin: an ECO 1002 reply streams and the
   counter drops by one; a FIN 3610 lesson shows no panel. Then merge #126,
   check the production deploy (CLAUDE.md gotcha), sync local `main`, and
   tell the ECO 1002 instructors.
2. Rotate the gateway key (it was pasted in chat) and buy credits before
   students arrive (free tier: 5 requests a minute across the team).
3. Deferred minors: the counter fails open on a read error; aborted streams
   leave null token columns.
