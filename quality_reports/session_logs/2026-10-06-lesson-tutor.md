# Session log — 2026-10-05/06 (ECO 1002 lesson tutor: research, spec, plan, implementation)

Continues [2026-09-27](2026-09-27-baruch-blue-theme.md). Branch
`feat/lesson-tutor` (off `main` babc9a5) holds the whole feature, committed
but **not pushed**. Task 10 (model eval) waits for the owner's AI Gateway key.

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
  its quota slot and the counter never moved, so an outage could use up a
  student's day. Now the slot is refunded only on no-output provider
  failures, the server's exact count rides on each finished reply, and
  reasoning is never streamed to the browser (`09b4ec0`).

## Open items for the owner

1. Create the AI Gateway key `edu-tutor` (team-attributed, $25 monthly
   budget, 50/75/100% alerts) and put it in `.env`; then run
   `node --env-file=.env scripts/tutor-eval.ts openai/gpt-6-luna:low openai/gpt-6-luna:medium openai/gpt-5-mini:low anthropic/claude-haiku-4.5:low`
   and read the coach transcripts (Task 10).
2. Push, open the PR titled `db: …`, add `AI_GATEWAY_API_KEY` to all three
   Vercel scopes, paste `supabase/schema.sql` in production, and confirm
   Fluid compute is on for `edu-webpage` (Task 11 steps 4–9).
3. Deferred minors from the review: GuidedReader check explanations enter
   the context; counter fails open on a read error; "Thinking…" disappears
   during the reasoning gap; aborted streams leave null token columns; RLS
   suite lacks a column-grant assertion; eval reports would land in a public
   tracked folder; panel accessibility nits.
