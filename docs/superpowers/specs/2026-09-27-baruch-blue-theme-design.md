# Baruch Blue theme: design spec

- **Date:** 2026-09-27
- **Status:** Draft, awaiting owner review
- **Branches:** `feat/baruch-blue-theme` (PR 1: palette, fonts, chrome), `feat/baruch-blue-charts` (PR 2: charts)
- **Visual reference:** the "Baruch Blue" option in the Baruch Studio Themes comparison page (private): https://claude.ai/artifact/Lvw65K3tmDwa7HR3j8w23V#baruch
- **Brand sources:** [Baruch OCMPA, Brand Guidelines Summary and Design Tips (2024)](https://toolkit.baruch.cuny.edu/wp-content/uploads/sites/11/2024/09/OCMPA-Design-cheatsheet.pdf) and [Baruch Brand Identity Guidelines (2022)](https://toolkit.baruch.cuny.edu/wp-content/uploads/sites/11/2022/08/Final-BrandIdentityGuidelines.pdf)

## 1. Summary

Re-skin the site in Baruch College's primary blues without touching layout. The header and home hero become Baruch Blue, every action becomes CUNY Blue, panels and borders move to Baruch's Pearl and Dove neutrals, body text becomes Charcoal, headings become Baruch Blue, and Figtree (self-hosted) becomes the one face for interface and reading.

Colors move into CSS custom properties, so the theme lives in `src/styles/global.css` and `tailwind.config.mjs` instead of hundreds of class strings, and charts read the same variables. Chart lines switch to a colorblind-safe palette led by Midtown Blue and Tangerine.

## 2. Goals and non-goals

**Goals**

- The site reads as Baruch at a glance (owner goal).
- Every text pair passes WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and chart marks.
- Chart colors stay distinguishable for colorblind students whenever any two of them touch.
- Colors change in one place from now on, which also leaves room for a dark mode later.
- The declared font actually loads on every device (today Inter renders only where it is installed).

**Non-goals**

- Layout, spacing, radii, component structure, copy.
- Dark mode. The tokens make it possible later; it is not built here.
- Status colors keep their Tailwind values: emerald (correct, success), amber (warnings), rose and red (errors, destructive actions), sky (workshop "open window" states).
- Renaming `slate-*` classes to semantic names (see §9).

## 3. Decisions already made

| Decision                                                                     | Source                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Direction: Baruch Blue                                                       | Owner, 2026-09-27                                                   |
| Scope: colors and fonts only, layout unchanged                               | Owner interview                                                     |
| No dark mode now                                                             | Owner interview, then owner picked a light direction                |
| Chrome uses three official colors plus neutrals: Baruch Blue, CUNY Blue, Sky | Baruch 2024 cheat sheet: at most three official colors per document |
| Figtree stands in for Avenir; Fort and Field Gothic are not used             | Both are Adobe Fonts and need a Creative Cloud web project to serve |

## 4. Approach

**Recommended: CSS variables behind Tailwind's existing color names.**

Define each theme color once as a CSS custom property in `src/styles/global.css`, stored as RGB channels (`--accent: 0 51 161`). Point Tailwind's `ink`, `accent`, a new `brand` group, and the light end of `slate` (50 to 400) at those variables with `rgb(var(--x) / <alpha-value>)`, so the opacity modifiers already in use (`accent/40`, `ink/90`, `bg-accent/10`) keep working. Charts reference `var(--chart-n)` directly in SVG attributes, which Recharts passes through.

Remapping `slate` works because of how the codebase uses it: of 332 `slate` classes, 320 are borders, backgrounds, or dividers and only 12 are text, and 323 use shades 50 to 400. Remapping those shades to Baruch neutrals **at the same lightness** retints the site while keeping every existing contrast relationship. The remap goes under `theme.extend.colors.slate`, which Tailwind deep-merges with its default palette, so shades 500 to 950 stay Tailwind's.

**Alternatives considered**

- **Semantic codemod.** Replace every `slate-*` and `blue-*` class with names such as `bg-panel` and `border-line`. The naming is cleaner, but it is a diff of roughly 350 classes across about 60 files and conflicts with any work in flight. Deferred to a follow-up.
- **New hex values directly in `tailwind.config.mjs`.** The smallest change, but charts cannot read Tailwind config at runtime (they would need a duplicated TypeScript constants file), and a later dark mode would mean redoing the work.

## 5. Design

### 5.1 Color tokens

| Token              | Hex       | Baruch name                                   | Role                                                         | Replaces            |
| ------------------ | --------- | --------------------------------------------- | ------------------------------------------------------------ | ------------------- |
| `--ink`            | `#383838` | Charcoal (Black 7)                            | Body text                                                    | `#0F172A`           |
| `--ink-muted`      | `#56657A` | Derived from Slate `#688197`, darkened for AA | Secondary text                                               | `#475569`           |
| `--heading`        | `#05336B` | Baruch Blue (PMS 288C)                        | h1 to h3                                                     | inherited ink       |
| `--accent`         | `#0033A1` | CUNY Blue (PMS 286C)                          | Links, buttons, labels, active states, focus rings           | `#2563EB`           |
| `--accent-strong`  | `#05336B` | Baruch Blue                                   | Hover on accent buttons                                      | `hover:bg-blue-700` |
| `--accent-soft`    | `#E8F0FC` | Derived from Sky                              | Soft accent fill (defined today, currently unused)           | `#DBEAFE`           |
| `--brand`          | `#05336B` | Baruch Blue                                   | Header and home hero background                              | white               |
| `--brand-sky`      | `#A3C9FF` | Sky (PMS 658C)                                | Sign-in button, hero verb, focus outline on blue, quote rule | none                |
| `--brand-sky-soft` | `#C9DCF7` | Derived from Sky                              | Header navigation text                                       | none                |
| `--brand-mist`     | `#D3E2F6` | Derived from Sky                              | Hero subtitle                                                | none                |

**Neutrals** (`slate` 50 to 400, same lightness as today, warmer hue):

| Class       | Today     | New       | Source              |
| ----------- | --------- | --------- | ------------------- |
| `slate-50`  | `#F8FAFC` | `#F7F4EB` | Pearl (PMS 9060C)   |
| `slate-100` | `#F1F5F9` | `#EFECE5` | Derived             |
| `slate-200` | `#E2E8F0` | `#E6E4DF` | Derived             |
| `slate-300` | `#CBD5E1` | `#D8D7D6` | Dove (Cool Gray 1C) |
| `slate-400` | `#94A3B8` | `#A19E98` | Derived             |

**Course identity** (`accentColor` in `src/content/courses/*.json`, rendered as text in `CourseHeaderCard.astro` and as chip fills on `/practice`):

| Course   | Today     | New                                  |
| -------- | --------- | ------------------------------------ |
| ECO 1002 | `#1D4ED8` | `#0033A1` CUNY Blue                  |
| FIN 3610 | `#047857` | `#510C76` Grape (PMS 2607C), see §10 |

### 5.2 Typography

- **Faces.** Figtree for everything, from `@fontsource-variable/figtree` (5.3.0). JetBrains Mono for `font-mono`, from `@fontsource-variable/jetbrains-mono` (5.3.0). Both are imported at the top of `global.css` next to the existing KaTeX import, bundled by Vite, and served with `font-display: swap`. No request leaves the site.
- **Config.** `sans: ['"Figtree Variable"', '"Avenir Next"', 'Avenir', 'ui-sans-serif', 'system-ui', 'sans-serif']` and `mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace']`. Remove `serif` (declared, never loaded, zero uses) and the `typography` block (inert, because `@tailwindcss/typography` is not installed).
- **Weights.** The home hero h1 and the lesson h1 in `LessonLayout.astro` go from `font-semibold` to `font-extrabold` (Figtree 800, as in the mockup). `.prose h1` and `.prose h2` go to `font-bold`. The other 34 page-level h1s keep `font-semibold`, so app pages stay quieter than content pages.
- **Lesson prose.** 17px (`1.0625rem`) with line-height 1.7, up from 16px on a 28px line.
- **Heading color.** One rule inside `@layer base`, `h1, h2, h3 { color: rgb(var(--heading)); }`. About 100 of the 109 h1 to h3 tags carry no color class and pick it up; any tag with an explicit `text-*` class keeps it, because utilities outrank the base layer.

### 5.3 Chrome

**Header** (`src/layouts/BaseLayout.astro`)

| Element                        | Today                              | New                                                                                      |
| ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `<header>`                     | `border-slate-200 bg-white`        | `border-brand-sky/25 bg-brand`                                                           |
| Site name                      | inherits ink                       | `text-white`                                                                             |
| Desktop nav links and Sign out | `text-ink-muted hover:text-ink`    | `text-brand-sky-soft hover:text-white`                                                   |
| Desktop Sign in                | `bg-accent text-white`             | `bg-brand-sky font-medium text-brand hover:bg-white`                                     |
| Mobile "Menu" summary          | `border-slate-300`                 | `border-brand-sky/40 text-white`                                                         |
| Mobile dropdown panel          | white panel, dark text             | unchanged                                                                                |
| `CourseSwitcher` (desktop)     | white `<select>`                   | unchanged; a white control reads correctly on the blue bar                               |
| Focus on header controls       | browser default, invisible on blue | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky` |

**Home hero** (`src/pages/index.astro`, `src/components/hero/TypingVerb.tsx`)

| Element                | Today                                                                            | New                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Section                | `border-b border-slate-200 bg-gradient-to-b from-white to-slate-50`              | `bg-brand`                                                                   |
| h1                     | `font-semibold`                                                                  | `font-extrabold text-white`                                                  |
| Typing verb and cursor | `text-accent`, `bg-accent`                                                       | `text-brand-sky`, `bg-brand-sky` (TypingVerb is used only here)              |
| Subtitle               | `text-ink-muted`                                                                 | `text-brand-mist`                                                            |
| ECO 1002 CTA           | `bg-accent text-white hover:bg-blue-700`                                         | `bg-white text-brand hover:bg-slate-50`                                      |
| FIN 3610 CTA           | `border-slate-300 hover:border-accent hover:text-accent`, label `text-ink-muted` | `border-brand-sky text-white hover:bg-white/10`, label `text-brand-sky-soft` |
| Both CTAs              | none                                                                             | the header's focus-outline classes                                           |

**Elsewhere**

- `hover:bg-blue-700` becomes `hover:bg-accent-strong` in all 32 places across 25 files. Mechanical replace.
- Lesson sidebar unit labels (the `h3` in `LessonSidebar.tsx`): `text-ink-muted` becomes `text-accent`. The active lesson already uses `bg-accent/10 text-accent` and follows the token (8.84:1).
- `.prose blockquote`: `border-accent/40` becomes `border-brand-sky`.
- Favicon (`public/favicon.svg`): tile `#2563eb` becomes `#05336B`.
- Native controls: `:root { accent-color: rgb(var(--accent)); }` themes every slider, checkbox, and radio.

### 5.4 Charts

**Palette**

| Token            | Hex       | Name                                 | Replaces                                                                            |
| ---------------- | --------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `--chart-1`      | `#2869AF` | Midtown Blue (PMS 7455C)             | `#2563eb`, `#4572a7`                                                                |
| `--chart-2`      | `#E65F24` | Tangerine (PMS 165C)                 | `#dc2626`, `#aa4643`                                                                |
| `--chart-3`      | `#009E73` | Okabe-Ito bluish green               | `#059669`, `#89a54e`                                                                |
| `--chart-4`      | `#CC79A7` | Okabe-Ito reddish purple             | `#f97316`, `#80699b`                                                                |
| `--chart-1-soft` | `#DCE8F5` | Midtown tint                         | `#dbeafe` (Solow area fill)                                                         |
| `--chart-3-soft` | `#56BA96` | Light step of chart-3 (ordinal pair) | `#10b981` (waterfall D&A)                                                           |
| `--chart-grid`   | `#E6E4DF` | Same as the `slate-200` remap        | `#e2e8f0`                                                                           |
| `--chart-ref`    | `#8C8A84` | Warm gray, 3.45:1 on white           | `#94a3b8` (zero lines, reference curves)                                            |
| `--chart-ink`    | `#383838` | Same as `--ink`                      | `#0f172a` (equilibrium dots, total lines, YTM handle) and series-colored label text |

Chart tokens are stored as hex, not RGB channels, because they are used in SVG attributes rather than Tailwind classes.

**Why slots 3 and 4 are not Baruch colors.** Baruch's Grape and Ochre collide with Midtown Blue and Tangerine for colorblind readers once any two colors can touch: Grape against Midtown Blue scores ΔE 2.8 for deuteranopes, and Ochre against Tangerine scores ΔE 2.2 for protanopes and 12.0 even for full color vision. Seven charts show slots 1 and 3 together (MM Proposition II, WACC, Money Multiplier, Solow, Efficient Frontier, TVM/NPV, Cash Flow Waterfall), so the collision would be common. Okabe-Ito is the standard colorblind-safe set. Slots 1 and 2, which every two-line chart uses, stay on-brand.

**Mapping.** Replacement is one-to-one by hex, so every existing distinction between series survives. Two notes:

- `CashflowWaterfall.tsx`: NOPAT becomes chart-3, D&A chart-3-soft, terminal value chart-1, minus ΔWC chart-4, minus CapEx chart-2, and the total line chart-ink. Sign is still carried by position and by the "−" in the labels. Today's negative stack puts red next to orange, which fails even for full color vision (ΔE 14.9); the new pair passes.
- `CreditSpreadExplorer.tsx`: its line (`#aa4643`) and marker (`#dc2626`) both become chart-2. The marker sits on its own line, so sharing a color is correct.

**Text never wears a series color.** Tangerine (3.48:1) and reddish purple (3.06:1) are fine as marks but fail as small text.

- `DragHandle` (a separate copy in each of `ISLMChart.tsx`, `ADASChart.tsx`, and `BondPriceYield.tsx`, differing slightly): each passes the series color as text `color`. Keep it only as `borderColor` and add `text-ink`, so the border carries identity and the label is ink. ISLM's copy also wraps the label in a `<span>` with an unused `borderColor`; render the label directly.
- `DuPontExplorer.tsx`: the reference-line label's `fill: '#dc2626'` becomes `fill: 'var(--chart-ink)'`.
- Recharts colors legend text and default-tooltip items with the series color, set as an inline style. Override once in `global.css` (hence `!important`): `.recharts-legend-item-text, .recharts-tooltip-item { color: rgb(var(--ink)) !important; }`. Legend swatches keep identity.

**BarFigure and lesson content**

- `DEFAULT_COLORS` in `src/components/mdx/BarFigure.tsx` becomes `['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']`.
- A series `color` may be a slot name (`'chart-1'` to `'chart-4'`), resolved to `var(--chart-n)`. Hex values still pass through.
- The 16 hardcoded colors in 11 FIN 3610 lessons change from `'#4572a7'` to `'chart-1'` and from `'#aa4643'` to `'chart-2'`.

### 5.5 Ride-alongs (their own commit)

- **Lesson tables.** 13 of 39 lessons contain Markdown tables with no styles. Add `.prose` table rules: collapsed borders, `px-3.5 py-2` cells, a header row on `slate-50` in the heading color, row rules in `slate-200`, and `display: block; overflow-x: auto` so a wide table scrolls inside the column on phones.
- **Native controls.** The `accent-color` rule from §5.3.

## 6. Rollout: two PRs, one logical change per commit

**PR 1, `feat/baruch-blue-theme`**

0. `docs: Baruch Blue theme design spec` (this file).
1. `refactor(theme): route colors through CSS variables`. Tokens hold today's values (`--accent: 37 99 235`; the `slate` remap holds Tailwind's current slate; `--accent-strong` is `#1D4ED8`, equal to `blue-700`). Replace `hover:bg-blue-700` with `hover:bg-accent-strong`. Remove the dead `serif` and `typography` config. **No visual change**, confirmed by before and after screenshots.
2. `feat(theme): self-host Figtree and JetBrains Mono`. Fontsource packages and `fontFamily`.
3. `feat(theme): Baruch Blue palette`. Token values, the heading rule, header, hero, TypingVerb, sidebar labels, heading weights and prose size, blockquote, favicon, and the two course `accentColor` values.
4. `fix(lessons): style Markdown tables and theme native controls`.
5. `test(theme): contrast guard for theme tokens` (see §7).

**PR 2, `feat/baruch-blue-charts`**

6. `refactor(charts): chart colors via CSS variables`. Chart tokens hold today's hex values; 23 chart files, BarFigure slot names, and the 11 lessons switch to them. **No visual change.**
7. `fix(charts): chart text uses ink, not series colors`. DragHandle, the DuPont label, and the legend and tooltip override.
8. `feat(charts): Baruch colorblind-safe chart palette`. Token values switch.

Splitting each switch into a no-visual-change refactor followed by a value change keeps every diff reviewable on its own and makes a rollback a one-commit revert.

## 7. Verification

**Automated**

- New pure, alias-free `src/lib/theme/contrast.ts` exporting `contrastRatio(hexA, hexB)`, with `contrast.test.ts`. The test reads `src/styles/global.css`, parses the `:root` tokens, and asserts:
  - ink, ink-muted, heading, and accent on white: at least 4.5:1;
  - ink-muted on the `slate-50`, `slate-100`, and `slate-200` remaps: at least 4.5:1;
  - white on accent and on accent-strong: at least 4.5:1;
  - white, brand-sky-soft, and brand-mist on brand: at least 4.5:1;
  - brand on brand-sky (the Sign in label): at least 4.5:1;
  - chart-1 to chart-4 and chart-ref on white: at least 3:1;
  - chart-3-soft on white: at least 2:1 (the floor for the light step of an ordinal pair; it is 2.37:1).
    A later token edit that breaks AA then fails `node --test`.
- `npm run typecheck`, `npm run build` (placeholder env per CLAUDE.md), `npm run format`, and `node --test 'src/lib/**/*.test.ts'`.
- Re-run the dataviz palette validator with `--pairs all` and paste the output into the PR 2 description (current results in Appendix B).

**Visual** (dev server and Playwright at 1280px and 390px)

- Commits 1 and 6: before and after screenshots match.
- After commits 3, 4, and 8:
  - `/`
  - `/eco-1002`
  - `/lessons/eco-1002/is-lm-intro` (chart, table, drag handles)
  - `/lessons/fin-3610/capital-budgeting-cashflows` (waterfall, BarFigure)
  - `/lessons/fin-3610/valuing-stocks` (BarFigure slots)
  - a graded quiz under `/practice`
  - `/auth/signin`
  - the header at the `xl` breakpoint (nav plus CourseSwitcher still fit in Figtree)
  - the mobile menu open
- Owner, signed in on the Vercel preview: `/dashboard`, `/instructor/classes/<course>` (roster table), `/admin`, and one workshop page (sky states and headings on tinted panels).
- Keyboard: tab through the header and hero; the Sky outline is visible on blue.

## 8. Risks and mitigations

| Risk                                                                   | Mitigation                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| The base heading rule recolors headings inside tinted status panels    | Visual pass on workshop, admin, and dashboard pages; add an explicit `text-*` class where a status color should win |
| `slate-*` classes now render warm grays, so the name misdescribes them | Comment in `tailwind.config.mjs`; semantic rename is a follow-up                                                    |
| Figtree metrics change line breaks                                     | Check the header at `xl`, the CTA cards, tables, and the sidebar at 390px                                           |
| Fallback font flashes on a first visit                                 | `font-display: swap`; optionally preload the Latin Figtree file in `BaseLayout`                                     |
| `var()` inside SVG attributes on old browsers                          | Supported by every current evergreen browser; no action                                                             |
| FIN 3610 switches from green to Grape                                  | Owner decision in §10; one JSON value either way                                                                    |

## 9. Out of scope and follow-ups

- Dark mode on top of these tokens. Its chart palette needs its own validation; the Trading Floor set on the comparison page fails the all-pairs check.
- Semantic class names for neutrals (`bg-panel`, `border-line`).
- `ring-accent/40` focus rings are below 3:1 on white today, site-wide. Pre-existing.
- The home page `<title>` repeats the site name. Pre-existing one-line fix.

## 10. Open decision

**FIN 3610 course color.** Grape `#510C76` is on-brand, distinct from ECO's CUNY Blue, and 12.62:1 as text (recommended). Keeping emerald `#047857` preserves continuity with what students have seen since August, but emerald also means "correct" in quizzes. This spec assumes Grape.

## Appendix A: Contrast (WCAG 2.2)

| Pair                                                 | Ratio   | Needed |
| ---------------------------------------------------- | ------- | ------ |
| Ink `#383838` on white                               | 11.73:1 | 4.5    |
| Heading `#05336B` on white                           | 12.41:1 | 4.5    |
| Ink-muted `#56657A` on white                         | 5.94:1  | 4.5    |
| Ink-muted on Pearl `#F7F4EB` (`slate-50`)            | 5.40:1  | 4.5    |
| Ink-muted on `#EFECE5` (`slate-100`)                 | 5.03:1  | 4.5    |
| Ink-muted on `#E6E4DF` (`slate-200`, table head)     | 4.67:1  | 4.5    |
| Ink on Pearl                                         | 10.66:1 | 4.5    |
| Accent `#0033A1` on white                            | 10.56:1 | 4.5    |
| White on accent                                      | 10.56:1 | 4.5    |
| White on accent-strong and brand `#05336B`           | 12.41:1 | 4.5    |
| Brand-sky-soft `#C9DCF7` on brand (nav)              | 8.90:1  | 4.5    |
| Brand-mist `#D3E2F6` on brand (hero subtitle)        | 9.44:1  | 4.5    |
| Brand-sky `#A3C9FF` on brand (verb, focus outline)   | 7.30:1  | 3      |
| Brand on brand-sky (Sign in label)                   | 7.30:1  | 4.5    |
| Active lesson: accent on accent/10 (`#E6EBF6`)       | 8.84:1  | 4.5    |
| ECO accent `#0033A1` as text                         | 10.56:1 | 4.5    |
| FIN accent Grape `#510C76` as text, and white on it  | 12.62:1 | 4.5    |
| Chart-1 Midtown `#2869AF` on white                   | 5.63:1  | 3      |
| Chart-2 Tangerine `#E65F24` on white                 | 3.48:1  | 3      |
| Chart-3 `#009E73` on white                           | 3.42:1  | 3      |
| Chart-4 `#CC79A7` on white                           | 3.06:1  | 3      |
| Chart-ref `#8C8A84` on white                         | 3.45:1  | 3      |
| Chart-3-soft `#56BA96` on white (ordinal light step) | 2.37:1  | 2      |

## Appendix B: Chart palette validator (dataviz skill, surface `#FFFFFF`)

- **Chosen, `--pairs all`:** `#2869AF, #E65F24, #009E73, #CC79A7`. Lightness band, chroma floor, and contrast pass. Normal-vision floor passes (worst ΔE 15.2). Colorblind separation is a WARN at ΔE 7.6 (deutan, slots 3 and 4), which is permitted with secondary encoding; the only two charts that use slot 4 (BarFigure with four series, CashflowWaterfall) both have legends.
- **Waterfall inflows, `--ordinal`:** `#56BA96` to `#009E73`. Passes.
- **Rejected, `--pairs all`:** `#2869AF, #E65F24, #7B3FA0, #A97B22` (Baruch Grape and Ochre). Fails colorblind separation (ΔE 2.2 protan) and the normal-vision floor (12.0).
- **Today, `--pairs all`:** `#2563EB, #DC2626, #059669, #F97316`. Fails the normal-vision floor: red against orange at ΔE 14.9.
