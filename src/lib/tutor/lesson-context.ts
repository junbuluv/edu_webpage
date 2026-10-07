// Turns a lesson's raw MDX body (CollectionEntry<'lessons'>.body) into plain
// text for the tutor's instructions. Pure and alias-free. Imports are dropped;
// <Figure> becomes its caption; <BarFigure> becomes a small table of its
// literal data; other components become "[Interactive: Name]" plus any prose
// found in their string props (GuidedReader keeps its steps); children of
// components with closing tags stay in place. Prose and $…$ math are kept
// verbatim. Components are only
// recognized at the start of a line, so math like $r<R$ is never mistaken
// for a tag.

export interface LessonMeta {
  title: string;
  summary: string;
  learningObjectives: string[];
  prerequisites: string[];
}

export const TUTOR_MAX_CONTEXT_CHARS = 30_000;

// Prop keys whose strings answer a lesson's self-checks (GuidedReader's
// `check.explanation`). The tutor must not read answers off the page it
// is coaching on, so these never enter the context.
const ANSWER_KEYS = new Set([
  'explanation',
  'answer',
  'solution',
  'feedback',
  'correct',
]);

interface ScannedTag {
  name: string;
  end: number;
  selfClosing: boolean;
  strings: string[];
  attrs: Record<string, string>;
  // Raw source of {expression} props, e.g. BarFigure's data={[…]}.
  exprs: Record<string, string>;
}

function findStringEnd(src: string, open: number): number {
  const quote = src[open];
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] === '\\') {
      i++;
      continue;
    }
    if (src[i] === quote) return i;
  }
  return -1;
}

// Scans a JSX opening tag that starts at `start` (the '<'). Tracks quotes and
// brace depth so '>' or '/>' inside strings or {expressions} don't end it.
function scanTag(src: string, start: number): ScannedTag | null {
  const nameMatch = /^<([A-Z][A-Za-z0-9.]*)/.exec(src.slice(start));
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const strings: string[] = [];
  const attrs: Record<string, string> = {};
  const exprs: Record<string, string> = {};
  let exprAttr: string | null = null;
  let exprStart = 0;
  let depth = 0;
  let i = start + nameMatch[0].length;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const close = findStringEnd(src, i);
      if (close < 0) return null;
      const value = src.slice(i + 1, close);
      const before = src.slice(Math.max(start, i - 64), i);
      // Object keys like `explanation: '...'` hold self-check answers.
      const key = /([A-Za-z_$][\w$]*)\s*:\s*$/.exec(before)?.[1];
      if (!key || !ANSWER_KEYS.has(key)) strings.push(value);
      if (depth === 0) {
        const attr = /([A-Za-z_][\w:-]*)\s*=\s*$/.exec(before);
        if (attr) attrs[attr[1]] = value;
      }
      i = close + 1;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) {
        const before = src.slice(Math.max(start, i - 64), i);
        exprAttr = /([A-Za-z_][\w:-]*)\s*=\s*$/.exec(before)?.[1] ?? null;
        exprStart = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && exprAttr) {
        exprs[exprAttr] = src.slice(exprStart, i);
        exprAttr = null;
      }
    } else if (depth === 0 && ch === '/' && src[i + 1] === '>') {
      return { name, end: i + 2, selfClosing: true, strings, attrs, exprs };
    } else if (depth === 0 && ch === '>') {
      return { name, end: i + 1, selfClosing: false, strings, attrs, exprs };
    }
    i++;
  }
  return null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_CHART_ROWS = 60;

// The {…} objects directly inside an array literal such as data={[{…}, {…}]}.
function objectLiterals(raw: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let begin = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const close = findStringEnd(raw, i);
      if (close < 0) return objects;
      i = close;
    } else if (ch === '{' || ch === '[') {
      if (ch === '{' && depth === 1) begin = i;
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (ch === '}' && depth === 1 && begin >= 0) {
        objects.push(raw.slice(begin + 1, i));
        begin = -1;
      }
    }
  }
  return objects;
}

// `key: 'text'` / `key: "text"` / `key: 12.5` pairs; other values are skipped.
const LITERAL_FIELD =
  /([A-Za-z_$][\w$]*)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?))/g;

function literalFields(source: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of source.matchAll(LITERAL_FIELD)) {
    fields[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return fields;
}

// BarFigure's numbers live in the MDX (data, xKey, series), so the tutor gets
// them as rows instead of only the caption. Null when the data isn't a
// literal array, so the caller falls back to the generic summary.
function describeChart(tag: ScannedTag): string | null {
  const { xKey, yAxisLabel, caption, credit } = tag.attrs;
  const { data, series: seriesSource } = tag.exprs;
  if (!xKey || !data || !seriesSource) return null;
  const series = objectLiterals(seriesSource)
    .map(literalFields)
    .filter((s) => s.key);
  const rows = objectLiterals(data).map(literalFields);
  if (series.length === 0 || rows.length === 0) return null;
  const lines = [
    `[Chart${yAxisLabel ? ` (${yAxisLabel})` : ''}]`,
    [xKey, ...series.map((s) => s.name || s.key)].join(' | '),
    ...rows
      .slice(0, MAX_CHART_ROWS)
      .map((row) =>
        [row[xKey] ?? '', ...series.map((s) => row[s.key] ?? '')].join(' | '),
      ),
  ];
  if (rows.length > MAX_CHART_ROWS) {
    lines.push(`(${rows.length - MAX_CHART_ROWS} more rows)`);
  }
  if (caption) lines.push(caption);
  if (credit) lines.push(`Source: ${credit}`);
  return lines.join('\n');
}

function describeComponent(tag: ScannedTag): string {
  if (tag.name === 'Figure') {
    const text = tag.attrs.caption ?? tag.attrs.alt;
    return text ? `[Figure: ${text}]` : '[Figure]';
  }
  if (tag.name === 'BarFigure') {
    const chart = describeChart(tag);
    if (chart) return chart;
  }
  // Prose-like props only: long enough and containing a space (skips slugs,
  // paths, and ids such as lessonSlug="eco-1002/is-lm-guided").
  const prose = tag.strings
    .map(stripHtml)
    .filter((s) => s.length >= 20 && /\s/.test(s));
  return [`[Interactive: ${tag.name}]`, ...prose].join('\n');
}

export function lessonToContext(body: string, meta: LessonMeta): string {
  const src = body
    .replace(/^import\s.+$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const atLineStart = i === 0 || src[i - 1] === '\n';
    if (atLineStart && src[i] === '<' && /[A-Z]/.test(src[i + 1] ?? '')) {
      const tag = scanTag(src, i);
      if (tag) {
        out += describeComponent(tag);
        i = tag.end;
        continue;
      }
    }
    if (src.startsWith('</', i)) {
      const close = /^<\/[A-Z][A-Za-z0-9.]*\s*>/.exec(src.slice(i));
      if (close) {
        i += close[0].length;
        continue;
      }
    }
    out += src[i];
    i++;
  }

  const header = [
    `Lesson: ${meta.title}`,
    `Summary: ${meta.summary}`,
    'Learning objectives:',
    ...meta.learningObjectives.map((o) => `- ${o}`),
    ...(meta.prerequisites.length
      ? ['Prerequisites:', ...meta.prerequisites.map((p) => `- ${p}`)]
      : []),
  ].join('\n');
  const full = `${header}\n\n${out.replace(/\n{3,}/g, '\n\n').trim()}`;
  return full.length > TUTOR_MAX_CONTEXT_CHARS
    ? `${full.slice(0, TUTOR_MAX_CONTEXT_CHARS)}\n[Lesson text truncated]`
    : full;
}
