---
name: copyright-check
description: Proofread lesson/quiz materials for copyright issues before posting. Use when adding or editing a lesson figure, image, lesson MDX, or quiz; before opening a content PR; or when asked to check/verify copyright, licensing, attribution, or provenance of site materials. Runs the deterministic gate then dispatches the copyright-critic and content-critic agents.
---

# Copyright check (proofread materials before posting)

Layered review of lesson figures + lesson/quiz text against this project's
copyright conventions (CLAUDE.md #14 and "New lesson figure"):

- **Sanctioned figure sources:** FRED (US public-domain), SEC EDGAR (hand-curated
  into `BarFigure`), Wikimedia Commons (diagrams), or the author's own work.
- **Never:** textbook scans, Bloomberg/Getty/paid charts, external hotlinks, or
  anything from the gitignored `materials/` folder (third-party copyrighted).
- **Always:** every `<Figure>` / `<BarFigure>` carries a `credit` (and ideally
  `creditHref`); committed images live under `public/figures/<course>/<slug>/`.

## When invoked

1. **Determine targets.**
   - If the user passed paths, use those.
   - Otherwise scope to changed content in the working tree:
     `git diff --name-only HEAD` (and `--cached`) filtered to
     `src/content/lessons/**/*.mdx` and `src/content/quizzes/**/*.json`.
     If there is no diff, fall back to all lesson MDX + quiz JSON.
   - Note whether the user passed `--deep` (enables web verification).

2. **Run the deterministic gate** (mechanical blockers, fast, offline):
   `node scripts/check-copyright.mjs <targets...>`
   Capture its findings. This is the same check CI runs.

3. **Dispatch the critics in parallel** (one message, two Agent calls):
   - `copyright-critic` — verify each gate finding against the real file and
     project conventions, and hunt for issues the mechanical gate cannot see
     (uncredited data tables, paraphrased-but-copied prose, a `credit` that
     names a non-sanctioned source). In `--deep` mode it may use WebSearch /
     WebFetch to confirm a claimed source exists or detect copied text.
   - `content-critic` — only for lesson/quiz text targets: pedagogy,
     factual/econ accuracy, and tone (the project tone guide).
   Pass the target list, the gate findings, and the `--deep` flag in the
   prompt.

4. **Synthesize and report.** Merge the gate output + both critics into one
   list grouped by severity:
   - **blocker** — must fix before posting (missing credit, external/hotlinked
     image, `materials/` reference, non-sanctioned source).
   - **warning** — verify before posting (suspect source, missing committed
     file, uncited data).
   - **note** — content-quality / tone suggestions from the content-critic.
   Each item: `file:line`, the rule/issue, and a concrete fix.

## Output rules

- Report only; do **not** auto-edit content. Copyright and pedagogy are
  judgment calls — surface findings and let the author decide.
- If a critic and the gate disagree, trust the critic's reasoning (it read the
  actual file) but show both.
- End with a one-line verdict: "Safe to post" (no blockers) or "N blocker(s) —
  fix before posting."

## Notes

- The deterministic gate (`scripts/check-copyright.mjs`) also runs in CI
  (`copyright-gate` job, advisory). This skill is the deeper, on-demand layer.
- `--deep` web verification is slower and sends content excerpts to external
  services — only use it when provenance is genuinely in doubt.
