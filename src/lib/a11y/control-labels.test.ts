// Run: node --test src/lib/a11y/control-labels.test.ts
//
// Every form control in a React component needs an accessible name, or a
// screen reader announces "slider, 100" with no hint of which parameter it is.
// Accepted: aria-label, aria-labelledby, or title on the control; a wrapping
// <label>; or an id that some <label htmlFor> in the same file points at
// (matched by expression text, so useId() pairs work).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const COMPONENTS = fileURLToPath(new URL('../../components/', import.meta.url));
const CONTROLS = new Set(['input', 'select', 'textarea']);
const UNLABELED_TYPES = new Set(['hidden', 'submit', 'button', 'reset']);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function attribute(el: Opening, name: string): ts.JsxAttribute | undefined {
  return el.attributes.properties.find(
    (p): p is ts.JsxAttribute =>
      ts.isJsxAttribute(p) && p.name.getText() === name,
  );
}

// The attribute's value as source text: 'x' for "x", the expression for {x}.
function valueText(attr: ts.JsxAttribute | undefined): string | undefined {
  const init = attr?.initializer;
  if (!init) return attr ? '' : undefined;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression)
    return init.expression.getText();
  return undefined;
}

function unlabeledControls(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const htmlFors = new Set<string>();
  const controls: { el: Opening; insideLabel: boolean }[] = [];

  const visit = (node: ts.Node, insideLabel: boolean): void => {
    let inside = insideLabel;
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText() === 'label'
    ) {
      inside = true;
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (tag === 'label') {
        const target = valueText(attribute(node, 'htmlFor'));
        if (target) htmlFors.add(target);
      }
      if (CONTROLS.has(tag)) controls.push({ el: node, insideLabel: inside });
    }
    ts.forEachChild(node, (child) => visit(child, inside));
  };
  visit(source, false);

  return controls
    .filter(({ el, insideLabel }) => {
      const type = valueText(attribute(el, 'type'));
      if (type && UNLABELED_TYPES.has(type)) return false;
      // A spread may carry the name; nothing to judge statically.
      if (el.attributes.properties.some(ts.isJsxSpreadAttribute)) return false;
      if (insideLabel) return false;
      if (
        ['aria-label', 'aria-labelledby', 'title'].some((a) => attribute(el, a))
      ) {
        return false;
      }
      const id = valueText(attribute(el, 'id'));
      return !(id && htmlFors.has(id));
    })
    .map(({ el }) => {
      const { line } = source.getLineAndCharacterOfPosition(el.getStart());
      const type = valueText(attribute(el, 'type'));
      return `${relative(COMPONENTS, file)}:${line + 1} <${el.tagName.getText()}${type ? ` type=${type}` : ''}>`;
    });
}

test('every form control in src/components has an accessible name', () => {
  const offenders = tsxFiles(COMPONENTS).flatMap(unlabeledControls);
  assert.deepEqual(
    offenders,
    [],
    `unlabeled controls:\n${offenders.join('\n')}`,
  );
});
