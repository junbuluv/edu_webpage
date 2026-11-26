// Run: node --test src/lib/tutor/lesson-context.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonToContext, TUTOR_MAX_CONTEXT_CHARS } from './lesson-context.ts';

const meta = {
  title: 'NPV',
  summary: 'Accept projects with positive NPV.',
  learningObjectives: ['Compute NPV', 'Apply the rule'],
  prerequisites: [],
};

test('drops imports, keeps prose and math, adds a header', () => {
  const body =
    "import TVMNPV from '@components/viz/TVMNPV';\n\n## The rule\n\nA higher $r$ lowers $NPV$.\n";
  const out = lessonToContext(body, meta);
  assert.ok(
    out.startsWith(
      'Lesson: NPV\nSummary: Accept projects with positive NPV.\nLearning objectives:\n- Compute NPV\n- Apply the rule',
    ),
  );
  assert.ok(out.includes('## The rule'));
  assert.ok(out.includes('A higher $r$ lowers $NPV$.'));
  assert.ok(!out.includes('import '));
  assert.ok(!out.includes('Prerequisites:'));
});

test('lists prerequisites when present', () => {
  const out = lessonToContext('Text.', {
    ...meta,
    prerequisites: ['Time value of money'],
  });
  assert.ok(out.includes('Prerequisites:\n- Time value of money'));
});

test('replaces a multi-line Figure with its caption', () => {
  const body =
    '<Figure\n  src="/figures/fin-3610/x.png"\n  alt="Alt text"\n  caption="Mortgage rates rose sharply in 2022."\n  credit="FRED"\n/>\n\nAfter.';
  const out = lessonToContext(body, meta);
  assert.ok(out.includes('[Figure: Mortgage rates rose sharply in 2022.]'));
  assert.ok(!out.includes('src='));
  assert.ok(out.includes('After.'));
});

test('summarizes interactive components without leaking props', () => {
  const out = lessonToContext('<TVMNPV client:load />\n\nText after.', meta);
  assert.ok(out.includes('[Interactive: TVMNPV]'));
  assert.ok(!out.includes('client:load'));
  assert.ok(out.includes('Text after.'));
});

test('keeps prose from string props even when strings contain /> and >', () => {
  const body = [
    '<StepThrough',
    '  client:load',
    '  lessonSlug="fin-3610/npv-decision-rule"',
    '  steps={[',
    "    { heading: 'Where we are headed', bodyHtml: `<p>The NPV rule accepts a project when its present value exceeds its cost.<br/></p>` },",
    '  ]}',
    '/>',
    '',
    'Closing paragraph.',
  ].join('\n');
  const out = lessonToContext(body, meta);
  assert.ok(out.includes('[Interactive: StepThrough]'));
  assert.ok(
    out.includes(
      'The NPV rule accepts a project when its present value exceeds its cost.',
    ),
  );
  assert.ok(!out.includes('<p>'));
  assert.ok(!out.includes('fin-3610/npv-decision-rule'));
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

test('drops self-check answer explanations from component props', () => {
  const body = [
    '<StepThrough',
    '  steps={[',
    '    {',
    "      heading: 'Discount rate',",
    '      bodyHtml: `<p>NPV falls as the discount rate rises because later cash flows shrink.</p>`,',
    '      check: {',
    "        prompt: 'A higher discount rate moves NPV in which direction?',",
    "        choices: ['NPV falls', 'NPV rises'],",
    '        correctIndex: 0,',
    '        explanation:',
    "          'A higher rate discounts every future cash flow more, so NPV falls.',",
    '      },',
    '    },',
    '  ]}',
    '/>',
  ].join('\n');
  const out = lessonToContext(body, meta);
  assert.ok(
    out.includes('A higher discount rate moves NPV in which direction?'),
  );
  assert.ok(
    out.includes(
      'NPV falls as the discount rate rises because later cash flows shrink.',
    ),
  );
  assert.ok(!out.includes('A higher rate discounts every future cash flow'));
});

test('renders BarFigure data as a compact table the tutor can read', () => {
  const body = [
    '<BarFigure',
    '  client:load',
    '  data={[',
    "    { fy: 'FY14', ocf: 59.7, capex: 9.6 },",
    "    { fy: 'FY15', ocf: 81.3, capex: 11.2 },",
    '  ]}',
    '  xKey="fy"',
    '  series={[',
    "    { key: 'ocf', name: 'Operating cash flow ($B)', color: 'chart-1' },",
    "    { key: 'capex', name: 'CapEx ($B)', color: 'chart-2' },",
    '  ]}',
    '  yAxisLabel="USD billions"',
    '  caption="Apple operating cash flow and capital expenditures."',
    '  credit="Apple 10-K filings via SEC EDGAR"',
    '/>',
    '',
    'After.',
  ].join('\n');
  const out = lessonToContext(body, meta);
  assert.ok(
    out.includes(
      '[Chart (USD billions)]\nfy | Operating cash flow ($B) | CapEx ($B)\nFY14 | 59.7 | 9.6\nFY15 | 81.3 | 11.2',
    ),
  );
  assert.ok(
    out.includes('Apple operating cash flow and capital expenditures.'),
  );
  assert.ok(out.includes('Source: Apple 10-K filings via SEC EDGAR'));
  assert.ok(!out.includes('chart-1'));
  assert.ok(!out.includes('client:load'));
  assert.ok(out.includes('After.'));
});

test('a chart whose data is not a literal keeps the caption-only summary', () => {
  const out = lessonToContext(
    '<BarFigure data={rows} xKey="fy" series={cols} caption="Free cash flow by fiscal year." />\n',
    meta,
  );
  assert.ok(out.includes('[Interactive: BarFigure]'));
  assert.ok(out.includes('Free cash flow by fiscal year.'));
});
