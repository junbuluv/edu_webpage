// Run: node --test src/lib/tutor/lesson-context.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonToContext, TUTOR_MAX_CONTEXT_CHARS } from './lesson-context.ts';

const meta = {
  title: 'IS-LM',
  summary: 'Goods and money markets.',
  learningObjectives: ['Derive IS', 'Derive LM'],
  prerequisites: [],
};

test('drops imports, keeps prose and math, adds a header', () => {
  const body =
    "import ISLMChart from '@components/viz/ISLMChart';\n\n## IS curve\n\nLower $r$ raises $Y$.\n";
  const out = lessonToContext(body, meta);
  assert.ok(
    out.startsWith(
      'Lesson: IS-LM\nSummary: Goods and money markets.\nLearning objectives:\n- Derive IS\n- Derive LM',
    ),
  );
  assert.ok(out.includes('## IS curve'));
  assert.ok(out.includes('Lower $r$ raises $Y$.'));
  assert.ok(!out.includes('import '));
  assert.ok(!out.includes('Prerequisites:'));
});

test('lists prerequisites when present', () => {
  const out = lessonToContext('Text.', {
    ...meta,
    prerequisites: ['Supply and demand'],
  });
  assert.ok(out.includes('Prerequisites:\n- Supply and demand'));
});

test('replaces a multi-line Figure with its caption', () => {
  const body =
    '<Figure\n  src="/figures/eco-1002/x.png"\n  alt="Alt text"\n  caption="GDP growth and the funds rate move together."\n  credit="FRED"\n/>\n\nAfter.';
  const out = lessonToContext(body, meta);
  assert.ok(
    out.includes('[Figure: GDP growth and the funds rate move together.]'),
  );
  assert.ok(!out.includes('src='));
  assert.ok(out.includes('After.'));
});

test('summarizes interactive components without leaking props', () => {
  const out = lessonToContext('<ISLMChart client:load />\n\nText after.', meta);
  assert.ok(out.includes('[Interactive: ISLMChart]'));
  assert.ok(!out.includes('client:load'));
  assert.ok(out.includes('Text after.'));
});

test('keeps prose from string props even when strings contain /> and >', () => {
  const body = [
    '<GuidedReader',
    '  client:load',
    '  lessonSlug="eco-1002/is-lm-guided"',
    '  steps={[',
    "    { heading: 'Where we are headed', bodyHtml: `<p>The IS-LM model gives equilibrium output and the interest rate.<br/></p>` },",
    '  ]}',
    '/>',
    '',
    'Closing paragraph.',
  ].join('\n');
  const out = lessonToContext(body, meta);
  assert.ok(out.includes('[Interactive: GuidedReader]'));
  assert.ok(
    out.includes(
      'The IS-LM model gives equilibrium output and the interest rate.',
    ),
  );
  assert.ok(!out.includes('<p>'));
  assert.ok(!out.includes('eco-1002/is-lm-guided'));
  assert.ok(out.includes('Closing paragraph.'));
});

test('keeps children of components that have closing tags', () => {
  const out = lessonToContext(
    '<Callout type="note">\nMoney demand rises with $Y$.\n</Callout>\n',
    meta,
  );
  assert.ok(out.includes('[Interactive: Callout]'));
  assert.ok(out.includes('Money demand rises with $Y$.'));
  assert.ok(!out.includes('</Callout>'));
});

test('does not treat inline math comparisons as tags', () => {
  const out = lessonToContext('When $r<R$ the bond trades at a premium.', meta);
  assert.ok(out.includes('When $r<R$ the bond trades at a premium.'));
});

test('caps very long lessons', () => {
  const marker = '\n[Lesson text truncated]';
  const out = lessonToContext('x '.repeat(40_000), meta);
  assert.equal(out.length, TUTOR_MAX_CONTEXT_CHARS + marker.length);
  assert.ok(out.endsWith(marker));
});
