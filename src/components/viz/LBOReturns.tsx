import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { runLbo, unleveredLbo, type LboInputs } from '@lib/lbo/model';
import ChartFrame from './ChartFrame';

// Leveraged buyout returns. The model (src/lib/lbo/model.ts) buys a firm at
// entryMultiple x EBITDA, part with debt, sweeps each year's cash flow after
// interest into debt repayment, and sells at exitMultiple x final EBITDA.
// The bars split the equity gain into EBITDA growth, the change in the
// multiple, and debt paydown (plus any cash paid out once the debt is gone);
// the three always sum to sale price - closing debt + payouts - equity in.
//
// Baseline is deliberately ordinary (no multiple gain, 5% growth, 50% debt):
// about 12% a year, so reaching 20% takes a visible push on some slider.
// Slider ranges keep debt (at most 7x) below the price (at least 8x).

const baseline: LboInputs = {
  ebitda: 100, // $ millions, fixed
  entryMultiple: 10,
  debtToEbitda: 5,
  growth: 0.05,
  exitMultiple: 10,
  years: 5,
  interestRate: 0.08,
  cashShare: 0.5, // fixed
};

const TARGET_IRR = 0.2;

export default function LBOReturns() {
  const [s, setS] = useState<LboInputs>(baseline);
  const r = useMemo(() => runLbo(s), [s]);
  const unlevered = useMemo(() => unleveredLbo(s), [s]);
  const set = (key: keyof LboInputs) => (v: number) =>
    setS((x) => ({ ...x, [key]: v }));

  const bars = [
    { name: 'EBITDA growth', value: Math.round(r.bridge.growth) },
    { name: 'Multiple change', value: Math.round(r.bridge.multiple) },
    { name: 'Debt paydown', value: Math.round(r.bridge.paydown) },
  ];
  const wiped = r.exitEquity < 0;
  const firstShort = r.schedule.find((y) => y.shortfall > 0);
  const warnings = [
    firstShort &&
      `Cash flow cannot cover the interest from year ${firstShort.year}. The ${usd(r.shortfall)} left unpaid over the holding period is added to the debt here. A real lender could instead force a default.`,
    wiped &&
      `The sale price is ${usd(-r.exitEquity)} below the debt. The owners lose their whole ${usd(r.entryEquity)} and the lenders are not repaid in full. The bars add to more than the owners' loss; the extra is the lenders' loss.`,
  ].filter((w): w is string => Boolean(w));

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Entry multiple"
          v={s.entryMultiple}
          min={8}
          max={14}
          step={0.5}
          fmt={times}
          onChange={set('entryMultiple')}
        />
        <Slider
          label="Debt / EBITDA"
          v={s.debtToEbitda}
          min={0}
          max={7}
          step={0.25}
          fmt={times}
          onChange={set('debtToEbitda')}
        />
        <Slider
          label="EBITDA growth"
          v={s.growth}
          min={-0.05}
          max={0.15}
          step={0.005}
          fmt={pct}
          onChange={set('growth')}
        />
        <Slider
          label="Exit multiple"
          v={s.exitMultiple}
          min={6}
          max={14}
          step={0.5}
          fmt={times}
          onChange={set('exitMultiple')}
        />
        <Slider
          label="Holding period"
          v={s.years}
          min={3}
          max={8}
          step={1}
          fmt={(v) => `${v} years`}
          onChange={set('years')}
        />
        <Slider
          label="Interest rate"
          v={s.interestRate}
          min={0.04}
          max={0.14}
          step={0.0025}
          fmt={(v) => (v * 100).toFixed(2) + '%'}
          onChange={set('interestRate')}
        />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <Stat label="Equity in" value={usd(r.entryEquity)} />
        <Stat label="Equity out" value={usd(r.proceeds)} />
        <Stat label="Multiple of invested capital" value={mult(r.moic)} />
        <Stat
          label="IRR"
          value={pct(r.irr)}
          tone={r.irr >= TARGET_IRR ? 'text-emerald-700' : 'text-accent'}
        />
        <Stat label="Unlevered IRR (no debt)" value={pct(unlevered.irr)} />
      </dl>
      <p className="mt-2 max-w-measure text-sm text-ink-muted">
        Price {usd(r.entryValue)} = debt {usd(r.entryDebt)} + equity{' '}
        {usd(r.entryEquity)}. With one payment at the sale, a 20% IRR over{' '}
        {s.years} years needs {mult(Math.pow(1 + TARGET_IRR, s.years))}.
      </p>

      {warnings.map((w) => (
        <Warning key={w}>{w}</Warning>
      ))}

      <h3 className="mt-4 text-sm font-semibold">
        Where the change in equity value comes from ($ millions)
      </h3>
      <ChartFrame
        description={
          'Value bridge: three bars, in millions of dollars, that sum to the change in equity value. One bar for EBITDA growth valued at the entry multiple, one for the change in the multiple applied to final EBITDA, and one for debt paydown. A bar below zero is a loss from that source.'
        }
        summary={`Equity in ${usd(r.entryEquity)}, equity out ${usd(r.proceeds)}, ${mult(r.moic)} the money, IRR ${pct(r.irr)}; unlevered IRR ${pct(unlevered.irr)}. EBITDA growth ${usd(bars[0].value)}, multiple change ${usd(bars[1].value)}, debt paydown ${usd(bars[2].value)}. ${warnings.join(' ')}`}
      >
        <div className="mt-2 h-72">
          <ResponsiveContainer>
            <BarChart
              data={bars}
              margin={{ top: 20, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
              <YAxis
                tickFormatter={(v) => String(v).replace('-', '−')}
                width={52}
                // Room for the value label under a bar that points down.
                padding={{ bottom: bars.some((b) => b.value < 0) ? 20 : 0 }}
              />
              <Tooltip formatter={(v: number) => usd(v)} />
              <ReferenceLine y={0} stroke="var(--chart-ref)" />
              <Bar
                dataKey="value"
                name="Change in equity value"
                isAnimationActive={false}
              >
                {bars.map((b, i) => (
                  <Cell key={b.name} fill={`var(--chart-${i + 1})`} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number) => usd(v)}
                  style={{ fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        Baseline: a firm earning $100M of EBITDA is bought at 10x, half with
        debt at 8% (5x EBITDA). EBITDA grows 5% a year and the firm is sold
        after 5 years at the same 10x, which returns 1.76x, about 12% a year.
        Half of each year's EBITDA is taken to be cash left after taxes and
        investment, at any level of debt. Interest on the opening debt is paid
        first and the rest repays debt. Once the debt is gone, spare cash is
        paid to the owners each year and counted in the debt paydown bar. The
        unlevered IRR is the same purchase with no debt. Deal fees, fund fees
        and carry are left out. Stylized numbers, not a real deal.
      </p>
    </div>
  );
}

// Round first so 10.25% does not flip between 10.2% and 10.3% on float noise.
const pct = (v: number) =>
  (Math.round(v * 1e5) / 1e3).toFixed(1).replace('-', '−') + '%';
const times = (v: number) => `${v}x`;
const mult = (v: number) => v.toFixed(2) + 'x';
const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}M`;

function Stat({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`text-lg font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function Warning({ children }: { children: string }) {
  return (
    <p className="mt-3 max-w-measure rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <strong>Warning:</strong> {children}
    </p>
  );
}

function Slider({
  label,
  v,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">
        {label}: <span className="text-accent">{fmt(v)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-44"
      />
    </label>
  );
}
