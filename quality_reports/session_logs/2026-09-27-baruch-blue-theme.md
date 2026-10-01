# Session log — 2026-09-27 (Baruch Blue theme: design, spec, plan, PRs 1–2)

Continues [2026-08-26](2026-08-26-auth-roles-and-audit.md). PR 1 (#124) is
merged (dd9cc7b) and live on baruchfinance.com. PR 2 (#125, charts,
`feat/baruch-blue-charts`) is open with CI green and waits for the owner's
merge. Wrapped up 2026-09-29.

## Decided

- The owner asked for alternative designs. Interview: goals were Baruch
  identity, easier long reading, a distinctive look, and a range to react to;
  scope **colors and fonts only, layout unchanged**; dark mode deferred.
- Four directions were compared on a private page (Baruch Blue, Blue Book,
  Midtown, Trading Floor), all built from Baruch's published palette
  (OCMPA 2024 cheat sheet). Blue Book was recommended; **the owner chose
  Baruch Blue**.
- Spec: `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md`.
  Plan: `docs/superpowers/plans/2026-09-27-baruch-blue-theme.md` (12 tasks,
  two PRs). Executed inline (native), with one fresh whole-branch review per
  PR.

## Shipped

- **#124** (merged dd9cc7b, live) `feat/baruch-blue-theme`, Tasks 1–7:
  contrast helpers and a guard test that parses `global.css`; colors routed
  through RGB-channel CSS variables (pixel-identical refactor); self-hosted
  Figtree and JetBrains Mono; Baruch palette, heading rule, 17px lessons;
  Baruch Blue header and home hero with Sky focus outlines; lesson table
  styles and `accent-color`; CLAUDE.md conventions 21–22. Reviewer verdict
  "ready to merge"; two findings fixed (real italic faces; workshop panel
  heading color).
- **#125** (open, CI green) `feat/baruch-blue-charts`, Tasks 8–12: chart colors moved
  to `--chart-*` tokens (pixel-identical across all 19 chart lessons); a
  guard test rejects hex literals in `src/components`; BarFigure takes theme
  slots through a tested resolver (11 FIN 3610 lessons switched from
  Highcharts hex); chart text is ink; new palette Midtown Blue, Tangerine,
  Okabe-Ito green and purple. Reviewer verdict "with fixes"; both fixed:
  six hints still said "the red dot/line" for marks that are now orange, and
  Recharts drew axis titles, reference labels, and bar values in its default
  `#808080` (3.95:1), now ink through one stylesheet rule.

## Lessons worth remembering

1. **Validate chart palettes with `--pairs all`.** Baruch's Grape and Ochre
   passed the adjacent-pairs check but collide with Midtown Blue and
   Tangerine for colorblind readers once lines cross or bars stack. The
   chart palette uses Okabe-Ito for slots 3–4. The old palette also failed:
   red next to orange in the cash-flow waterfall.
2. **A palette swap breaks color words in copy.** Lessons and viz hints name
   marks by color ("the red dot"). After changing a slot's hue, grep lesson
   MDX and `src/components/viz` for the old color name.
3. **Recharts text defaults are not ink.** `<Label>`/`LabelList` fall back
   to `#808080` (fails AA at 10–11px); axis ticks use `#666` (passes). A
   stylesheet `fill` beats the SVG attribute, so one CSS rule fixes every
   label without `!important`.
4. **`\$` inside `$…$` breaks lesson math.** remark-math does not honor the
   escape, so the math ends early and a sentence renders as garbled italic
   math. It affects 9 FIN 3610 lessons; one sentence was fixed here because
   the 17px size pushed it off 390px phones. Convention 22.
5. **`npm run format` is not a no-op on this tree**: it rewrites 7
   unrelated files. Format only the files you change until a one-off
   `chore: format` lands on `main`.
6. **The dev server's Tailwind CSS can go stale after edits** (a new class
   was missing until restart). Restart before any visual or color check.
7. **Pixel-diff checks need determinism first**: clear `localStorage`
   before each load (anonymous lesson progress changes page height), take
   chart shots in a tall viewport rather than full-page (a resize re-runs
   Recharts animations), park the mouse at (0,0), and allow ~4/255 for SVG
   anti-aliasing.
8. **The Vercel CLI appends `.vercel` to `.gitignore`** when it links the
   project unless that exact line exists; the old `.vercel/` entry did not
   count, so the appended line sat uncommitted for days. It is committed in
   #125, so the tree stays clean after `vercel link` or `vercel deploy`.

## Open

- Owner: review #125's preview (behind Vercel login) on the chart lessons (IS-LM, AD-AS,
  capital budgeting waterfall, MM Proposition II, valuing stocks), then
  merge (squash) and confirm the production deploy.
- Owner: the signed-in pages from PR 1 were not eyeballed before its merge;
  check `/dashboard` (course card colors), `/instructor/classes/eco-1002`,
  `/admin`, and one workshop page (revealed questions panel) on production.
- Follow-ups found, not fixed: garbled currency in 8 more FIN 3610 lessons
  (plus 4 lines of `financial-options`); AD-AS preset `<select>` overflows
  390px on two lessons; the cash-flow waterfall's 6-item legend wraps into
  the plot (fixed `height={24}`); CourseSwitcher focus ring on the blue
  header; three duplicated `DragHandle` components; a one-off
  `chore: format` for the 7 drift files.
