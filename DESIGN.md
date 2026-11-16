---
name: Baruch Econ & Finance Studio
description: Interactive macroeconomics and corporate finance lessons for Baruch College undergraduates.
colors:
  ink: '#383838'
  ink-muted: '#56657A'
  heading: '#05336B'
  accent: '#0033A1'
  accent-strong: '#05336B'
  accent-soft: '#E8F0FC'
  brand: '#05336B'
  brand-sky: '#A3C9FF'
  brand-sky-soft: '#C9DCF7'
  brand-mist: '#D3E2F6'
  white: '#FFFFFF'
  neutral-50: '#F7F4EB'
  neutral-100: '#EFECE5'
  neutral-200: '#E6E4DF'
  neutral-300: '#D8D7D6'
  neutral-400: '#A19E98'
  course-eco-1002: '#0033A1'
  course-fin-3610: '#510C76'
  chart-1: '#2869AF'
  chart-2: '#E65F24'
  chart-3: '#009E73'
  chart-4: '#CC79A7'
  chart-1-soft: '#DCE8F5'
  chart-3-soft: '#56BA96'
  chart-grid: '#E6E4DF'
  chart-ref: '#8C8A84'
  chart-ink: '#383838'
typography:
  display:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '3rem'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  title:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: '-0.025em'
  body:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.7
  body-ui:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  table:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Figtree Variable", "Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: '0.025em'
  mono:
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace'
    fontSize: '0.9em'
    fontWeight: 400
rounded:
  sm: '4px'
  lg: '8px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.white}'
    typography: '{typography.body-ui}'
    rounded: '{rounded.sm}'
    padding: '6px 12px'
  button-primary-hover:
    backgroundColor: '{colors.accent-strong}'
  button-secondary:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    typography: '{typography.body-ui}'
    rounded: '{rounded.sm}'
    padding: '4px 8px'
  button-header-sign-in:
    backgroundColor: '{colors.brand-sky}'
    textColor: '{colors.brand}'
    rounded: '{rounded.sm}'
  chip:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink-muted}'
    typography: '{typography.body-ui}'
    rounded: '{rounded.full}'
    padding: '4px 12px'
  chip-selected:
    backgroundColor: 'rgb(0 51 161 / 0.1)'
    textColor: '{colors.accent}'
  card:
    backgroundColor: '{colors.white}'
    rounded: '{rounded.lg}'
    padding: '20px'
  input:
    backgroundColor: '{colors.white}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
  header:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.white}'
  header-nav-link:
    textColor: '{colors.brand-sky-soft}'
---

# Design System: Baruch Econ & Finance Studio

## Overview

**Creative North Star: "The Working Notebook"**

The Studio looks like a well-kept course notebook: warm paper surfaces, Baruch-blue ink, thin ruled borders, and on every lesson page an equation or chart that the student works on. The interface stays out of the way so the model is the thing on the page. Baruch Blue frames the site in the header and the home hero, and everything inside that frame is light and quiet.

The mood is calm and exact. Corners are small, borders are one pixel, surfaces sit flat, and motion only confirms that something changed. Density follows the task: lessons read in a single 65-character column at 17px, while app pages (dashboard, roster, admin) pack 14px text into tables and bordered cards. The site rejects publisher-platform clutter, gamification, startup gloss, and dark trading-terminal looks.

**Key Characteristics:**

- Baruch Blue chrome around a light, warm-neutral page.
- One typeface, Figtree, for interface and reading; JetBrains Mono only for code.
- Flat bordered surfaces; shadows only on things that float.
- Charts use a colorblind-safe palette, and their text stays in ink.
- Every color pair meets WCAG AA, enforced by tests.

## Colors

The palette is Baruch's official blues over warm Pearl and Dove neutrals, with a separate colorblind-safe set for chart marks.

### Primary

- **CUNY Blue** (`accent`): every action and interactive state: links, buttons, selected chips, the active lesson in the sidebar, slider and checkbox fills (`accent-color`), and focus rings on white.
- **Baruch Blue** (`brand`, `heading`, `accent-strong`): the header bar and home hero background, h1 to h3 text, and the hover state of CUNY Blue buttons.

### Secondary

- **Sky** (`brand-sky`): accents on Baruch Blue only: the header Sign in button, the hero's typing verb, focus outlines on blue, and the blockquote rule.
- **Sky Soft** (`brand-sky-soft`): header navigation text.
- **Sky Mist** (`brand-mist`): the hero subtitle.
- **Accent Soft** (`accent-soft`): a pale CUNY Blue fill, defined but not used yet. Selected states use CUNY Blue at 10% opacity instead.

### Tertiary

- **Midtown Blue, Tangerine, Bluish Green, Reddish Purple** (`chart-1` to `chart-4`): data marks only, in that order. Slots 1 and 2 are Baruch colors; slots 3 and 4 are Okabe-Ito because Baruch's Grape and Ochre collide with slots 1 and 2 for colorblind readers.
- **Midtown Tint and Light Green** (`chart-1-soft`, `chart-3-soft`): area fills and the light step of an ordinal pair.
- **Grid and Reference Gray** (`chart-grid`, `chart-ref`): gridlines, zero lines, and reference curves.
- **Course identity**: ECO 1002 is CUNY Blue (`course-eco-1002`) and FIN 3610 is Grape (`course-fin-3610`), set in `src/content/courses/<slug>.json` and used as course-name text and chip fills.

### Neutral

- **Charcoal** (`ink`, `chart-ink`): body text, and all text inside charts.
- **Muted Slate** (`ink-muted`): secondary text, captions, and labels on white and on Pearl.
- **White** (`white`): the page and card background.
- **Pearl** (`neutral-50`, Tailwind `slate-50`): panel fills, table headers, hover fills.
- **Pearl Deep and Linen** (`neutral-100`, `neutral-200`): inline code, progress tracks, and default card and table borders.
- **Dove** (`neutral-300`): input and secondary-button borders, table header rules.
- **Stone** (`neutral-400`): disabled and decorative strokes only, never text.

### Named Rules

**The Three Blues Rule.** The site chrome uses at most three official Baruch colors (Baruch Blue, CUNY Blue, Sky) plus neutrals, following Baruch's 2024 cheat sheet.

**The Ink, Not Series Rule.** Text never takes a series color. Tangerine and Reddish Purple pass as marks but fail as small text, so chart labels, legends, tooltips, and drag-handle labels are Charcoal and the series color moves to a border or swatch.

**The Status Stays Tailwind Rule.** Status colors are Tailwind's own: emerald for correct and success, amber for warnings, rose and red for errors and destructive actions, sky for open workshop windows. Emerald never marks a course, because it means "correct."

## Typography

**Display Font:** Figtree Variable (with Avenir Next, Avenir, system sans)
**Body Font:** Figtree Variable
**Label/Mono Font:** JetBrains Mono Variable, for code only

**Character:** Figtree is a plain, geometric-humanist sans that stands in for Baruch's Avenir. Weight carries hierarchy; one face keeps lessons and app screens consistent. Both fonts are self-hosted through Fontsource, so no request leaves the site.

### Hierarchy

- **Display** (800, 3rem from `md` up and 2.25rem below, line-height 1, tracking -0.025em): the home hero headline only, in white on Baruch Blue.
- **Headline** (800, 1.875rem, 1.2): the lesson title. An h1 written inside lesson prose is 700, and app page titles use the same size at 600 so app pages stay quieter than lessons.
- **Title** (700, 1.5rem, 1.333): lesson section headings (h2). Lesson h3 is 1.25rem at 600.
- **Body** (400, 1.0625rem, 1.7): lesson prose, capped at 65ch, in Charcoal at 90% opacity.
- **Body UI** (400, 0.875rem, 1.43): the default for app pages, app tables, forms, buttons, and chart controls.
- **Table** (400, 0.9375rem, 1.5): Markdown tables inside lessons; header cells are 600 in Baruch Blue on Pearl.
- **Label** (500, 0.75rem, tracking 0.025em, uppercase): eyebrow labels above titles and on the hero's course buttons, in CUNY Blue or Muted Slate.

### Named Rules

**The One Face Rule.** Figtree for everything people read; JetBrains Mono only for code. No serif, no display face.

**The Lessons Speak Louder Rule.** Lesson titles and section headings are bold (700) or extrabold (800); app page titles stay at semibold (600).

**The 12px Floor Rule.** No text is smaller than 12px, including chart ticks, legends, and labels inside charts.

## Layout

The site is a single centered column. The header and footer run to 72rem (`max-w-6xl`) with a 16px side gutter. Content pages sit at 48rem (`max-w-3xl`) to 56rem (`max-w-4xl`); forms narrow to 28rem (`max-w-md`). The lesson column is 65ch, which charts, tables, and math use in full; paragraphs, lists, quotes, summaries, and captions stop at the reading width `max-w-measure` (52ch, about 73 characters per line at any size). Cards inside a page break into two columns from `md` (768px) up and stack below it. The full desktop navigation appears at `xl` (1280px); below it, a "Menu" disclosure holds the links.

Spacing runs on Tailwind's 4px grid. The working steps are 4, 8, 12, 16, 20, 24, and 32px; 12px and 8px dominate inside components, 20px pads a card, and 32px separates a chart block from the prose around it. Wide lesson tables and math scroll sideways inside the column rather than widening the page.

## Elevation & Depth

The system is flat. Depth comes from a one-pixel Linen border and, for panels, a Pearl fill against white. Shadows are reserved for elements that float above the page: the tutor launcher and other fixed controls, chart drag handles, and the hero's white course button.

### Shadow Vocabulary

- **Lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): the hero's white course button, so it separates from Baruch Blue.
- **Handle** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): chart drag handles at rest, rising to the Raised value on hover.
- **Raised** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): a drag handle under the pointer.
- **Floating** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): fixed buttons in a page corner, such as the tutor launcher.

### Named Rules

**The Flat Paper Rule.** Cards, tables, and panels sit flat with a border. A shadow means the element floats or can be dragged; nothing else gets one.

## Shapes

Corners are small and consistent. Buttons, inputs, inline code, and most controls use a 4px radius (`rounded`). Cards, chart blocks, and the hero buttons use 8px (`rounded-lg`). Pills (practice filters, drag handles, the tutor launcher, progress tracks) are fully rounded. Borders are always one pixel, except drag handles, whose 2px border carries the series color.

## Components

### Buttons

Plain and direct: a flat fill, medium weight, no icons unless the action needs one.

- **Shape:** gently squared (4px).
- **Primary:** CUNY Blue fill, white text, 500 weight, 6px by 12px padding at 14px (8px by 16px for a full-width form submit).
- **Hover / Focus:** fill shifts to Baruch Blue. On white, most buttons keep the browser's focus outline and a few add a 2px CUNY Blue ring; on Baruch Blue, controls show a 2px Sky outline offset 2px.
- **Secondary:** white with a Dove border and Charcoal text, 4px by 8px; hover turns the border CUNY Blue or fills it Pearl.
- **Disabled:** 40 to 60% opacity.
- **On Baruch Blue:** the header Sign in is Sky with Baruch Blue text and goes white on hover; the hero's second course button is a Sky outline with white text and a 10% white fill on hover.

### Chips

- **Style:** practice filters are fully rounded pills with a Dove border, Muted Slate 14px text, 4px by 12px.
- **State:** selected (`aria-pressed`) turns the border and text CUNY Blue on a 10% CUNY Blue fill at 500 weight; hover fills Pearl.

### Cards / Containers

- **Corner Style:** 8px.
- **Background:** white, or Pearl for a secondary panel.
- **Shadow Strategy:** none (see The Flat Paper Rule).
- **Border:** one pixel Linen.
- **Internal Padding:** 20px; 32px of space above and below when a card holds a chart inside lesson prose.

### Inputs / Fields

- **Style:** white field, one-pixel Dove border, 4px radius, 8px by 12px padding, full width in forms, with a 14px medium label above.
- **Focus:** form fields keep the browser's focus outline; the tutor's text box turns its border CUNY Blue instead. Sliders, checkboxes, and radios take CUNY Blue through `accent-color`.
- **Error:** a red status panel above the form (red-50 fill, red-300 border, red-800 text), not a red field.

### Navigation

- **Header:** a Baruch Blue bar with a 25% Sky bottom border. The site name is white; links are Sky Soft and turn white on hover. The course switcher is a white select on the blue bar.
- **Mobile:** below `xl`, a "Menu" disclosure with a Sky border opens a white dropdown panel with Charcoal links.
- **Lesson sidebar:** unit labels are CUNY Blue; the active lesson is CUNY Blue text on a 10% CUNY Blue fill.
- **Footer:** Muted Slate 14px links below a Linen top rule.

### Simulation Block (signature component)

The block that makes a lesson a lesson: a white card (8px corners, Linen border, 20px padding) holding a Recharts chart and its controls, wrapped in `ChartFrame` so screen readers get a description and a live summary of the current values. Sliders sit under labels that name the parameter. Panel titles inside the block are 14px semibold `h3`s. Readouts (price, duration, totals) sit in Pearl tiles with 4px corners and no border, so they never read as a card inside the card. Draggable curve handles are white pills with a 2px border in the series color and a Charcoal label. A Reset control returns the baseline. Animated values tween with `useAnimatedValue`, which honors `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** use the theme tokens through their Tailwind names (`text-ink`, `text-heading`, `bg-accent`, `hover:bg-accent-strong`, `bg-brand`, `border-slate-200`). `src/lib/theme/no-hardcoded-colors.test.ts` fails on a hex literal in `src/components`.
- **Do** keep every text pair at WCAG AA (4.5:1 for text, 3:1 for large text and chart marks); `src/lib/theme/theme-tokens.test.ts` checks the tokens.
- **Do** give every form control an accessible name from its visible label (`src/lib/a11y/control-labels.test.ts`).
- **Do** wrap every chart in `ChartFrame` with a description and a summary of its current values (`src/lib/a11y/chart-alternatives.test.ts`).
- **Do** use `var(--chart-1)` to `var(--chart-4)` in that order for series, and a slot name (`'chart-1'`) for `BarFigure` colors.
- **Do** keep motion to color and opacity transitions and value tweens, and honor `prefers-reduced-motion`.
- **Do** cap every text block at `max-w-measure`; the `design-detect` CI job fails on lines over 80 characters.

### Don't:

- **Don't** add publisher-platform clutter: promotional banners, badges, upsell sidebars, or dense toolbars.
- **Don't** gamify: no points, streaks, confetti, or trophy icons.
- **Don't** add startup gloss: purple-to-blue gradients, glassmorphism, glowing cards, or an icon tile above every heading.
- **Don't** build a black, neon-ticker trading-terminal look; the site is light (`color-scheme: light`).
- **Don't** use raw Tailwind `blue-*` classes or hex values for brand color.
- **Don't** put a series color on text, or Stone (`neutral-400`) on any text.
- **Don't** add a shadow to a card, table, or panel that does not float.
- **Don't** put a bordered box inside a bordered card; use a Pearl fill instead.
