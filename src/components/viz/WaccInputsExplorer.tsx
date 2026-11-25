import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BOOK_DEBT_SHARE,
  ESTIMATE,
  MARKET,
  RANGES,
} from '@lib/cases/union-pacific';
import {
  perpetuityValue,
  sensitivity,
  wacc,
  type WaccInputs,
} from '@lib/cases/wacc';
import ChartFrame from './ChartFrame';

// Union Pacific's weighted average cost of capital as of January 30, 2026.
// The sliders start at the case's estimate (src/lib/cases/union-pacific.ts,
// where every number names its source). The second chart moves one input at
// a time across the range a careful analyst might use, so the student sees
// which choice matters: the equity risk premium, by a wide margin. Both
// x-axes widen when a slider pushes the WACC past 12%, so nothing clips.

const CONTROLS: {
  key: keyof WaccInputs;
  label: string;
  short: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  digits: number;
}[] = [
  {
    key: 'riskFree',
    label: 'Risk-free rate',
    short: 'Risk-free rate',
    min: 3,
    max: 6,
    step: 0.01,
    unit: '%',
    digits: 2,
  },
  {
    key: 'premium',
    label: 'Equity risk premium',
    short: 'Risk premium',
    min: 3,
    max: 8,
    step: 0.01,
    unit: '%',
    digits: 2,
  },
  {
    key: 'beta',
    label: 'Beta',
    short: 'Beta',
    min: 0.6,
    max: 1.4,
    step: 0.01,
    unit: '',
    digits: 2,
  },
  {
    key: 'costOfDebt',
    label: 'Cost of debt before tax',
    short: 'Cost of debt',
    min: 3,
    max: 7,
    step: 0.01,
    unit: '%',
    digits: 2,
  },
  {
    key: 'taxRate',
    label: 'Tax rate',
    short: 'Tax rate',
    min: 15,
    max: 30,
    step: 0.1,
    unit: '%',
    digits: 1,
  },
  {
    key: 'debtShare',
    label: 'Debt share of firm value',
    short: 'Debt share',
    min: 0,
    max: 70,
    step: 0.01,
    unit: '%',
    digits: 2,
  },
];
const control = (key: keyof WaccInputs) => CONTROLS.find((c) => c.key === key)!;

const PRESETS: { name: string; inputs: WaccInputs }[] = [
  { name: 'Our estimate', inputs: ESTIMATE },
  {
    name: 'Historical-average premium',
    inputs: { ...ESTIMATE, premium: MARKET.historicalPremium },
  },
  {
    name: 'Book-value weights',
    inputs: { ...ESTIMATE, debtShare: BOOK_DEBT_SHARE },
  },
];

const pct = (v: number, digits = 2) => `${v.toFixed(digits)}%`;
const dollars = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
/** An input's value with its own unit and number of decimals. */
const shown = (key: keyof WaccInputs, v: number) =>
  `${v.toFixed(control(key).digits)}${control(key).unit}`;
/** "4.18% to 4.87%" for an input's range. */
const span = (key: keyof WaccInputs) =>
  `${shown(key, RANGES[key][0])} to ${shown(key, RANGES[key][1])}`;

export default function WaccInputsExplorer() {
  const [inputs, setInputs] = useState<WaccInputs>(ESTIMATE);
  const r = wacc(inputs);
  const value = perpetuityValue(100, r.wacc);

  const parts = [{ name: 'WACC', equity: r.equityPart, debt: r.debtPart }];
  const swings = sensitivity(inputs, RANGES).map((s) => ({
    name: control(s.key).short,
    range: [
      Math.min(s.waccAtLow, s.waccAtHigh),
      Math.max(s.waccAtLow, s.waccAtHigh),
    ],
    detail: `${span(s.key)}: WACC ${pct(s.waccAtLow)} to ${pct(s.waccAtHigh)}`,
    swing: s.swing,
  }));
  const top = swings[0];

  // Fixed at 12% for the case's numbers; wider only at slider extremes.
  const highest = Math.max(r.wacc, ...swings.map((s) => s.range[1]));
  const lowest = Math.min(r.wacc, ...swings.map((s) => s.range[0]));
  const axisMax = Math.max(12, Math.ceil(highest) + 1);
  const axisMin = Math.max(0, Math.min(4, Math.floor(lowest) - 1));

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {CONTROLS.map((c) => (
          <label key={c.key} className="flex flex-col text-sm">
            <span className="font-medium">
              {c.label}:{' '}
              <span className="text-accent">{shown(c.key, inputs[c.key])}</span>
            </span>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={inputs[c.key]}
              onChange={(e) =>
                setInputs((x) => ({ ...x, [c.key]: Number(e.target.value) }))
              }
              className="mt-1 w-44"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setInputs(p.inputs)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
          >
            {p.name}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-1 text-sm">
        <li>
          Cost of equity = {pct(inputs.riskFree)} + {inputs.beta.toFixed(2)} ×{' '}
          {pct(inputs.premium)} ={' '}
          <strong className="text-accent">{pct(r.costOfEquity, 3)}</strong>
        </li>
        <li>
          After-tax cost of debt = {pct(inputs.costOfDebt)} × (1 −{' '}
          {pct(inputs.taxRate, 1)}) ={' '}
          <strong className="text-accent">
            {pct(r.afterTaxCostOfDebt, 3)}
          </strong>
        </li>
        <li>
          WACC = {pct(100 - inputs.debtShare)} × {pct(r.costOfEquity, 3)} +{' '}
          {pct(inputs.debtShare)} × {pct(r.afterTaxCostOfDebt, 3)} ={' '}
          <strong className="text-accent">{pct(r.wacc)}</strong>
        </li>
        <li>
          $100 a year forever, discounted at that rate before rounding, is worth{' '}
          <strong className="text-accent">{dollars(value)}</strong>.
        </li>
      </ul>

      <ChartFrame
        description="Two bar charts. First: the weighted average cost of capital as one bar split into the part that comes from equity and the part that comes from debt. Second: for each of the six inputs, a bar showing how far the cost of capital moves when that input goes across its plausible range and the others stay where the sliders are, with the widest bar on top and a line at the current cost of capital."
        summary={`Cost of equity ${pct(r.costOfEquity)}, after-tax cost of debt ${pct(r.afterTaxCostOfDebt)}, WACC ${pct(r.wacc)}. ${top.name} moves the WACC most, by ${top.swing.toFixed(2)} points.`}
      >
        <p className="mt-5 text-sm font-medium">
          Where the {pct(r.wacc)} comes from
        </p>
        <div className="mt-1 h-28">
          <ResponsiveContainer>
            <BarChart
              data={parts}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, axisMax]}
                allowDecimals={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis type="category" dataKey="name" width={96} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)} points`} />
              <Legend verticalAlign="top" height={28} />
              <Bar
                dataKey="equity"
                name="Equity share × cost of equity"
                stackId="wacc"
                fill="var(--chart-1)"
                barSize={28}
                isAnimationActive={false}
              />
              <Bar
                dataKey="debt"
                name="Debt share × after-tax cost of debt"
                stackId="wacc"
                fill="var(--chart-2)"
                barSize={28}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 text-sm font-medium">
          How far each input can move the WACC
        </p>
        <div className="mt-1 h-64">
          <ResponsiveContainer>
            <BarChart
              data={swings}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 16, left: 8 }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[axisMin, axisMax]}
                allowDecimals={false}
                tickCount={axisMax - axisMin + 1}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'WACC',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis type="category" dataKey="name" width={96} interval={0} />
              <Tooltip
                formatter={(_v, _n, item): [string, string] => [
                  String(item.payload?.detail ?? ''),
                  'Range',
                ]}
              />
              <Bar
                dataKey="range"
                name="WACC across the input's range"
                fill="var(--chart-1)"
                barSize={16}
                radius={4}
                isAnimationActive={false}
              />
              <ReferenceLine x={r.wacc} stroke="var(--chart-ink)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        The sliders start at the case's estimate for January 30, 2026. In the
        lower chart each bar moves one input across its range while the others
        stay where the sliders are; the line marks the current WACC. When a
        slider sits outside its range, the line falls outside that input's bar.
        Moving the debt share keeps the costs of equity and debt fixed, which a
        real change in borrowing would not. Ranges: risk-free rate{' '}
        {span('riskFree')} (10-year Treasury at year-end to 30-year), risk
        premium {span('premium')} (implied to 1928 to 2025 average), beta{' '}
        {span('beta')} (Transportation group to railroad average), cost of debt{' '}
        {span('costOfDebt')} (Aaa to Baa bonds), tax rate {span('taxRate')}{' '}
        (federal to federal plus state), debt share {span('debtShare')} (Union
        Pacific to railroad average). Sources: Union Pacific's 2025 Form 10-K
        (SEC EDGAR), FRED, and Aswath Damodaran's data library, January 2026.
      </p>
    </div>
  );
}
