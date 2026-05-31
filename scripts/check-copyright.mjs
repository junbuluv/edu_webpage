#!/usr/bin/env node
// Deterministic copyright gate (NO AI) — the mechanical subset of the
// project's copyright conventions (CLAUDE.md #14 + "New lesson figure").
// The judgment-heavy review (provenance reasoning, copied-prose detection,
// web verification) lives in the on-demand `/copyright-check` skill + the
// copyright-critic / content-critic agents; this script only enforces rules
// that are unambiguous enough to block a PR.
//
// Usage:
//   node scripts/check-copyright.mjs            # scan all lesson MDX + quiz JSON
//   node scripts/check-copyright.mjs <files...> # scan only the given files
//
// Exit code: 1 if any BLOCKER is found, else 0. Warnings never fail the run.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');

// --- rules -------------------------------------------------------------

// Disallowed-source hints in a figure path/filename or import (warning).
const SUSPECT_SOURCE = /\b(bloomberg|getty|shutterstock|textbook|scan(ned)?|mcgraw|pearson|cengage|wiley)\b/i;
// External image hotlink in MDX/markdown.
const MD_IMAGE_EXTERNAL = /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)/g;
const IMG_TAG_EXTERNAL = /<img\b[^>]*\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi;

const findings = [];
function report(severity, file, line, rule, message) {
  findings.push({ severity, file, line, rule, message });
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Extract `<Figure ...>` / `<BarFigure ...>` blocks (the attribute span).
// Handles BOTH self-closing (`<Figure ... />`) and paired
// (`<Figure ...></Figure>`) forms — taking whichever close comes first — so
// a paired tag can't slip past the credit/src checks. Heuristic but
// sufficient for hand-authored MDX.
function* componentBlocks(text) {
  const re = /<(Figure|BarFigure)\b/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const selfClose = text.indexOf('/>', start);
    const pairedClose = text.indexOf(`</${m[1]}>`, start);
    let end = -1;
    if (selfClose !== -1) end = selfClose + 2;
    if (pairedClose !== -1 && (end === -1 || pairedClose < end)) {
      end = pairedClose + m[1].length + 3; // length of `</Name>`
    }
    const attrs = end === -1 ? text.slice(start, start + 1200) : text.slice(start, end);
    yield { name: m[1], attrs, line: lineOf(text, start) };
  }
}

function attrValue(attrs, key) {
  // matches key="..." | key='...' | key={...}
  const m = attrs.match(new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`));
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

function checkContentText(file, text) {
  // 1. materials/ leakage — gitignored copyrighted source must never be referenced.
  let idx = text.indexOf('materials/');
  while (idx !== -1) {
    report('blocker', file, lineOf(text, idx), 'no-materials-ref',
      'References the gitignored `materials/` folder (copyrighted source). Use a sanctioned source (FRED / SEC EDGAR / Wikimedia / own work).');
    idx = text.indexOf('materials/', idx + 1);
  }

  // 2. External image hotlinks (provenance unknown + breaks if remote changes).
  for (const re of [MD_IMAGE_EXTERNAL, IMG_TAG_EXTERNAL]) {
    let m;
    while ((m = re.exec(text))) {
      report('blocker', file, lineOf(text, m.index), 'no-external-image',
        `External image hotlink (${m[1]}). Commit the asset under public/figures/ and cite its source instead.`);
    }
  }
}

function checkMdx(file, text) {
  checkContentText(file, text);
  for (const block of componentBlocks(text)) {
    const credit = attrValue(block.attrs, 'credit');
    if (!credit) {
      report('blocker', file, block.line, 'figure-missing-credit',
        `<${block.name}> has no \`credit\` — every figure needs source attribution.`);
    }
    if (block.name === 'Figure') {
      const src = attrValue(block.attrs, 'src');
      if (!src) {
        report('blocker', file, block.line, 'figure-missing-src', '<Figure> has no `src`.');
      } else if (/^https?:\/\//i.test(src)) {
        report('blocker', file, block.line, 'figure-external-src',
          `<Figure src> is an external URL (${src}); commit the image under public/figures/.`);
      } else {
        // Local path like /figures/<course>/<slug>/<name>.png — must be committed.
        const rel = src.replace(/^\//, '');
        if (src.startsWith('/figures/') && !existsSync(join(PUBLIC_DIR, rel))) {
          report('warning', file, block.line, 'figure-missing-file',
            `<Figure src="${src}"> points at a file not found under public/. Commit it or fix the path.`);
        } else if (!src.startsWith('/figures/')) {
          report('warning', file, block.line, 'figure-unexpected-path',
            `<Figure src="${src}"> is not under /figures/ — confirm provenance and location.`);
        }
      }
    }
    // Only inspect provenance fields (credit / creditHref / src) for suspect
    // sources — NOT caption prose, where words like "textbook" are normal.
    const provenance = [credit, attrValue(block.attrs, 'creditHref'), attrValue(block.attrs, 'src')]
      .filter(Boolean)
      .join(' ');
    if (SUSPECT_SOURCE.test(provenance)) {
      report('warning', file, block.line, 'suspect-source',
        `<${block.name}> is credited to a likely-copyrighted source. Verify it's licensed/public-domain.`);
    }
  }
}

function checkJson(file, text) {
  checkContentText(file, text); // materials/ + external image hotlinks in quiz text
}

// --- file discovery ----------------------------------------------------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function defaultTargets() {
  const lessons = walk(join(ROOT, 'src/content/lessons')).filter((f) => f.endsWith('.mdx'));
  const quizzes = walk(join(ROOT, 'src/content/quizzes')).filter((f) => f.endsWith('.json'));
  return [...lessons, ...quizzes];
}

// --- run ---------------------------------------------------------------

const argFiles = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = (argFiles.length ? argFiles : defaultTargets())
  .filter((f) => ['.mdx', '.json'].includes(extname(f)) && existsSync(f));

for (const file of targets) {
  const text = readFileSync(file, 'utf8');
  const rel = file.replace(ROOT + '/', '');
  if (file.endsWith('.mdx')) checkMdx(rel, text);
  else if (file.endsWith('.json')) checkJson(rel, text);
}

const blockers = findings.filter((f) => f.severity === 'blocker');
const warnings = findings.filter((f) => f.severity === 'warning');

const order = { blocker: 0, warning: 1 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file));
for (const f of findings) {
  const tag = f.severity === 'blocker' ? 'BLOCKER' : 'warning';
  console.log(`${tag}  ${f.file}:${f.line}  [${f.rule}] ${f.message}`);
}

console.log(
  `\ncopyright gate: scanned ${targets.length} file(s) — ${blockers.length} blocker(s), ${warnings.length} warning(s).`,
);
if (blockers.length > 0) {
  console.log('Run `/copyright-check` for a deeper AI review, or fix the blockers above.');
  process.exit(1);
}
process.exit(0);
