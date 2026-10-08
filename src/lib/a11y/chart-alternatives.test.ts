// Run: node --test src/lib/a11y/chart-alternatives.test.ts
//
// Charts are graphics, so each needs a text alternative (WCAG 1.1.1): wrap
// interactive charts in <ChartFrame> (a description plus a live summary of the
// current values), or put a static chart in a <figure> with a <figcaption>.
// An element with role="img" and an aria-label also counts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const COMPONENTS = fileURLToPath(new URL('../../components/', import.meta.url));
const DIRS = ['viz', 'mdx'].map((d) => join(COMPONENTS, d));
const CHARTS = new Set(['ResponsiveContainer', 'Plot']);

type El = ts.JsxElement | ts.JsxSelfClosingElement;

function opening(el: El): ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return ts.isJsxElement(el) ? el.openingElement : el;
}

function hasAttr(el: El, name: string): boolean {
  return opening(el).attributes.properties.some(
    (p) => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
}

function attrText(el: El, name: string): string | undefined {
  const attr = opening(el).attributes.properties.find(
    (p): p is ts.JsxAttribute =>
      ts.isJsxAttribute(p) && p.name.getText() === name,
  );
  const init = attr?.initializer;
  return init && ts.isStringLiteral(init) ? init.text : undefined;
}

function containsTag(node: ts.Node, tag: string): boolean {
  let found = false;
  const walk = (n: ts.Node): void => {
    if (found) return;
    if (
      (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) &&
      opening(n).tagName.getText() === tag
    ) {
      found = true;
      return;
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

function hasTextAlternative(ancestors: El[]): boolean {
  return ancestors.some((a) => {
    const tag = opening(a).tagName.getText();
    if (tag === 'ChartFrame') return true;
    if (tag === 'figure' && containsTag(a, 'figcaption')) return true;
    return (
      attrText(a, 'role') === 'img' &&
      (hasAttr(a, 'aria-label') || hasAttr(a, 'aria-labelledby'))
    );
  });
}

function bareCharts(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const out: string[] = [];
  const visit = (node: ts.Node, ancestors: El[]): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = opening(node).tagName.getText();
      if (CHARTS.has(tag) && !hasTextAlternative(ancestors)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        out.push(`${relative(COMPONENTS, file)}:${line + 1} <${tag}>`);
      }
      const next = [...ancestors, node];
      ts.forEachChild(node, (child) => visit(child, next));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, ancestors));
  };
  visit(source, []);
  return out;
}

test('every chart in viz/ and mdx/ has a text alternative', () => {
  const offenders = DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => bareCharts(join(dir, f))),
  );
  assert.deepEqual(
    offenders,
    [],
    `charts without a text alternative:\n${offenders.join('\n')}`,
  );
});
