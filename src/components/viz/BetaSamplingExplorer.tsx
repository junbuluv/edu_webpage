import { useId, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import raw from '@lib/factors/regressions.json';
import {
  INDUSTRIES,
  WINDOW,
  betaDataFrom,
  costOfEquity,
  monthIndex,
  monthLabel,
  rollingBetas,
  sampleBetas,
  windowBeta,
  type Industry,
} from '@lib/cases/beta-sampling';
import { bins, percentile } from '@lib/cases/dcf';
import { ESTIMATE } from '@lib/cases/union-pacific';
import ChartFrame from './ChartFrame';

// How sure is one estimate of beta? Monthly excess returns of two Ken French
// industry portfolios against the market's (src/lib/factors/regressions.json).
// A 60-month window gives one beta; every window gives the strip; 1,000 sets
// of 60 random months show how far a 60-month estimate lands from the
// full-history beta by chance alone. Cost of equity holds the risk-free rate
// and premium at the cost of capital case's values, so only beta moves it.

const DATA = betaDataFrom(raw);
const N = DATA.market.length;
const FIRST_END = WINDOW - 1;
const LAST_END = N - 1;
const BASELINE = monthIndex(DATA.start, '1999-12');
const DRAWS = 1_000;
const BIN = 0.05;
const RF = ESTIMATE.riskFree;
const PREMIUM = ESTIMATE.premium;

const NAMES: Record<Industry, string> = {
  utilities: 'Utilities',
  'high-tech': 'High tech',
};

const ROLLING = Object.fromEntries(
  INDUSTRIES.map((id) => [id, rollingBetas(DATA.returns[id], DATA.market)]),
) as Record<Industry, number[]>;
const FULL = Object.fromEntries(
  INDUSTRIES.map((id) => [
    id,
    windowBeta(DATA.returns[id], DATA.market, LAST_END, N).beta,
  ]),
) as Record<Industry, number>;

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const monthName = (i: number) => {
  const [y, m] = monthLabel(DATA.start, i).split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
const PRESETS = [
  { label: 'Dec 1999', end: BASELINE },
  { label: 'Dec 2004', end: monthIndex(DATA.start, '2004-12') },
  { label: `${monthName(LAST_END)}: latest`, end: LAST_END },
];
// January of each decade, for the strip's axis.
const DECADES = Array.from({ length: 6 }, (_, k) =>
  monthIndex(DATA.start, `${1970 + 10 * k}-01`),
);

const X_DOMAIN = [-25, 20];
const Y_DOMAIN = [-30, 25];
const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const pct = (v: number) => `${v.toFixed(2)}%`;
const coe = (beta: number) => costOfEquity(RF, PREMIUM, beta);

export default function BetaSamplingExplorer() {
  const [industry, setIndustry] = useState<Industry>('high-tech');
  const [end, setEnd] = useState(BASELINE);
  const [seed, setSeed] = useState(1);
  const industryLabelId = useId();

  const y = DATA.returns[industry];
  const fit = windowBeta(y, DATA.market, end);
  const full = FULL[industry];
  const rolling = ROLLING[industry];
  const from = end - WINDOW + 1;
  const points = DATA.market
    .slice(from, end + 1)
    .map((x, k) => ({ x, y: y[from + k] }));
  const strip = rolling.map((beta, k) => ({ i: k + FIRST_END, beta }));

  const { p5, p95, histogram, fitBin, fullBin, outside, countTicks } =
    useMemo(() => {
      const draws = sampleBetas(y, DATA.market, DRAWS, seed).sort(
        (a, b) => a - b,
      );
      const lo = percentile(draws, 5);
      const hi = percentile(draws, 95);
      const label = (v: number) => f2(Math.floor(v / BIN) * BIN);
      // The two marked betas join the bins so their bars exist on the axis;
      // the counts come from the draws alone.
      const counted = bins([...draws, fit.beta, full], BIN).map((b) => ({
        label: f2(b.from),
        detail: `${f2(b.from)} to ${f2(b.to)}`,
        count: draws.filter((v) => v >= b.from && v < b.to).length,
      }));
      return {
        p5: lo,
        p95: hi,
        histogram: counted,
        fitBin: label(fit.beta),
        fullBin: label(full),
        outside: rolling.filter((b) => b < lo || b > hi).length,
        // Ticks every 50 draws, so the axis is evenly spaced at any height.
        countTicks: Array.from(
          {
            length:
              Math.ceil(Math.max(...counted.map((b) => b.count)) / 50) + 1,
          },
          (_, k) => k * 50,
        ),
      };
    }, [y, seed, fit.beta, full, rolling]);

  const inside = fit.beta >= p5 && fit.beta <= p95;
  const span = `${monthName(from)} to ${monthName(end)}`;

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="text-sm">
          <span id={industryLabelId} className="font-medium">
            Industry
          </span>
          <div
            role="group"
            aria-labelledby={industryLabelId}
            className="mt-1 flex gap-2"
          >
            {INDUSTRIES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={industry === id}
                onClick={() => setIndustry(id)}
                className={
                  industry === id
                    ? 'rounded bg-accent px-3 py-1 font-medium text-white'
                    : 'rounded border border-slate-300 px-3 py-1 text-ink-muted hover:bg-slate-50'
                }
              >
                {NAMES[id]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col text-sm">
          <span className="font-medium">
            Last month of the 60-month window:{' '}
            <span className="text-accent">{monthName(end)}</span>
          </span>
          <input
            type="range"
            min={FIRST_END}
            max={LAST_END}
            step={1}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="mt-1 w-64"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setEnd(p.end)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-strong"
        >
          Draw again
        </button>
        <button
          type="button"
          onClick={() => {
            setIndustry('high-tech');
            setEnd(BASELINE);
            setSeed(1);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <ul className="mt-4 max-w-measure space-y-1 text-sm">
        <li>
          Beta, {span}: <strong className="text-accent">{f3(fit.beta)}</strong>{' '}
          (standard error {f3(fit.se)}; R² {f2(fit.r2)}). Cost of equity:{' '}
          <strong className="text-accent">{pct(coe(fit.beta))}</strong>.
        </li>
        <li>
          Beta, all {N} months: <strong>{f3(full)}</strong>. Cost of equity:{' '}
          <strong>{pct(coe(full))}</strong>.
        </li>
        <li>
          Middle 90% of {DRAWS.toLocaleString('en-US')} betas from 60 random
          months: <strong>{f3(p5)}</strong> to <strong>{f3(p95)}</strong>, a
          cost of equity of {pct(coe(p5))} to {pct(coe(p95))}. This window's
          beta is {inside ? 'inside' : 'outside'} that range.
        </li>
        <li>
          All {rolling.length} windows: beta from {f2(Math.min(...rolling))} to{' '}
          {f2(Math.max(...rolling))};{' '}
          {Math.round((outside / rolling.length) * 100)}% of them fall outside
          the middle 90% of the random draws.
        </li>
      </ul>

      <ChartFrame
        description={`Three charts for the ${NAMES[industry].toLowerCase()} industry. First: a scatter of the industry's monthly return over Treasury bills against the market's, one dot per month of the chosen 60-month window, with the fitted line, whose slope is beta. Second: beta from every 60-month window, plotted at the window's last month, with a dashed line at the full-history beta and a marker at the chosen window. Third: a histogram of ${DRAWS.toLocaleString('en-US')} betas, each from 60 months drawn at random from the whole history, with lines at the full-history beta and the chosen window's beta.`}
        summary={`${NAMES[industry]}, ${span}: beta ${f3(fit.beta)}, standard error ${f3(fit.se)}, cost of equity ${pct(coe(fit.beta))}. Full history: beta ${f3(full)}. Middle 90% of random draws: ${f3(p5)} to ${f3(p95)}; this window is ${inside ? 'inside' : 'outside'} it.`}
      >
        <p className="mt-5 text-sm font-medium">
          {NAMES[industry]} against the market, {span}, % a month over Treasury
          bills
        </p>
        <div className="mt-1 h-64">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={X_DOMAIN}
                ticks={[-20, -10, 0, 10, 20]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'market',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={Y_DOMAIN}
                ticks={[-30, -20, -10, 0, 10, 20]}
                tickFormatter={(v) => `${v}%`}
                width={48}
              />
              <ZAxis range={[20, 20]} />
              <ReferenceLine x={0} stroke="var(--chart-ref)" />
              <ReferenceLine y={0} stroke="var(--chart-ref)" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Scatter
                data={points}
                name="Month"
                fill="var(--chart-1)"
                fillOpacity={0.6}
                isAnimationActive={false}
              />
              <ReferenceLine
                segment={X_DOMAIN.map((x) => ({
                  x,
                  y: fit.alpha + fit.beta * x,
                }))}
                stroke="var(--chart-2)"
                strokeWidth={2}
                ifOverflow="hidden"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 text-sm font-medium">
          Beta from every 60-month window, by its last month
        </p>
        <div className="mt-1 h-44">
          <ResponsiveContainer>
            <LineChart
              data={strip}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="i"
                domain={[FIRST_END, LAST_END]}
                ticks={DECADES}
                tickFormatter={(i: number) =>
                  monthLabel(DATA.start, i).slice(0, 4)
                }
              />
              <YAxis
                width={48}
                domain={[0, 2.25]}
                ticks={[0, 0.5, 1, 1.5, 2]}
              />
              <Tooltip
                formatter={(v: number) => [f3(v), 'Beta']}
                labelFormatter={(i) => `Window ending ${monthName(Number(i))}`}
              />
              <ReferenceLine
                y={full}
                stroke="var(--chart-ink)"
                strokeDasharray="4 3"
              />
              <Line
                type="linear"
                dataKey="beta"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine x={end} stroke="var(--chart-2)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 text-sm font-medium">
          {DRAWS.toLocaleString('en-US')} betas, each from 60 months drawn at
          random from all {N}
        </p>
        <div className="mt-1 h-44">
          <ResponsiveContainer>
            <BarChart
              data={histogram}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
              barCategoryGap={1}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval={Math.max(0, Math.ceil(histogram.length / 8) - 1)}
              />
              <YAxis width={48} ticks={countTicks} interval={0} />
              <Tooltip
                formatter={(v: number) => [v, 'Draws']}
                labelFormatter={(_, p) =>
                  `Beta ${p?.[0]?.payload?.detail ?? ''}`
                }
              />
              <Bar
                dataKey="count"
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
              <ReferenceLine
                x={fullBin}
                stroke="var(--chart-ink)"
                strokeDasharray="4 3"
              />
              <ReferenceLine
                x={fitBin}
                stroke="var(--chart-2)"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        Returns are the {NAMES.utilities.toLowerCase()} and high-tech portfolios
        of the Ken French Data Library's 10 industries, value weighted, and the
        market, each minus the one-month Treasury bill rate, July 1963 to{' '}
        {monthName(LAST_END)}. {DATA.copyright}. Cost of equity = {pct(RF)} +
        beta × {pct(PREMIUM)}: the risk-free rate and premium from the cost of
        capital case, held fixed so only beta changes it. Orange marks the
        chosen window and its line; the dashed black line is the full-history
        beta. The random draws use a fixed seed, so the page shows the same
        draws until you press Draw again.
      </p>
    </div>
  );
}
