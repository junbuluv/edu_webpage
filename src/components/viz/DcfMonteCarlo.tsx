import { useMemo, useState } from 'react';
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
import { DCF_BASE, DCF_RANGES, UNION_PACIFIC } from '@lib/cases/union-pacific';
import {
  bins,
  dcf,
  impliedLongRunGrowth,
  percentile,
  simulate,
  type DcfRanges,
  type Triangle,
} from '@lib/cases/dcf';
import ChartFrame from './ChartFrame';

// Union Pacific's value per share from 2,000 random draws of three inputs:
// revenue growth over the next five years, the operating margin, and growth
// after year 5. Each input is drawn from a triangle the student sets (low,
// most likely, high). Everything else is the case's base case
// (src/lib/cases/union-pacific.ts). The draws use a fixed seed, so the page
// shows the same results until the student presses "Draw again".

const DRAWS = 2_000;
const BIN_WIDTH = 10;
const PRICE = UNION_PACIFIC.sharePrice;

const DRIVERS: {
  key: keyof DcfRanges;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: 'revenueGrowth',
    label: 'Revenue growth, years 1 to 5',
    min: -3,
    max: 8,
    step: 0.1,
  },
  {
    key: 'operatingMargin',
    label: 'Operating margin',
    min: 30,
    max: 50,
    step: 0.5,
  },
  {
    key: 'longRunGrowth',
    label: 'Long-run growth after year 5',
    min: 0,
    max: 5,
    step: 0.1,
  },
];
const POINTS: { key: keyof Triangle; label: string }[] = [
  { key: 'low', label: 'low' },
  { key: 'mode', label: 'most likely' },
  { key: 'high', label: 'high' },
];

const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
const dollars = (v: number) => `$${v.toFixed(2)}`;

/** Move one point of a triangle and keep low <= most likely <= high. */
function setPoint(t: Triangle, key: keyof Triangle, v: number): Triangle {
  if (key === 'low') return { ...t, low: Math.min(v, t.mode) };
  if (key === 'high') return { ...t, high: Math.max(v, t.mode) };
  return { ...t, mode: Math.min(Math.max(v, t.low), t.high) };
}

export default function DcfMonteCarlo() {
  const [ranges, setRanges] = useState<DcfRanges>(DCF_RANGES);
  const [seed, setSeed] = useState(1);

  const mostLikely = {
    ...DCF_BASE,
    revenueGrowth: ranges.revenueGrowth.mode,
    operatingMargin: ranges.operatingMargin.mode,
    longRunGrowth: ranges.longRunGrowth.mode,
  };
  const base = dcf(mostLikely);
  const implied = impliedLongRunGrowth(mostLikely, PRICE);

  const { median, p10, p90, shareAbove, histogram, priceBin } = useMemo(() => {
    const values = simulate(DCF_BASE, ranges, DRAWS, seed).sort(
      (a, b) => a - b,
    );
    const above = values.filter((v) => v >= PRICE).length;
    const counted = bins([...values, PRICE], BIN_WIDTH).map((b) => {
      const inBin = values.filter((v) => v >= b.from && v < b.to);
      return {
        label: `$${b.from}`,
        detail: `$${b.from} to $${b.to}`,
        below: inBin.filter((v) => v < PRICE).length,
        above: inBin.filter((v) => v >= PRICE).length,
      };
    });
    return {
      median: percentile(values, 50),
      p10: percentile(values, 10),
      p90: percentile(values, 90),
      shareAbove: (above / DRAWS) * 100,
      histogram: counted,
      priceBin: `$${Math.floor(PRICE / BIN_WIDTH) * BIN_WIDTH}`,
    };
  }, [ranges, seed]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      {DRIVERS.map((d) => (
        <fieldset key={d.key} className="mb-4">
          <legend className="text-sm font-semibold">{d.label}</legend>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
            {POINTS.map((p) => (
              <label key={p.key} className="flex flex-col text-sm">
                <span>
                  {p.label}:{' '}
                  <span className="text-accent">
                    {pct(ranges[d.key][p.key])}
                  </span>
                </span>
                <input
                  type="range"
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  value={ranges[d.key][p.key]}
                  onChange={(e) =>
                    setRanges((r) => ({
                      ...r,
                      [d.key]: setPoint(
                        r[d.key],
                        p.key,
                        Number(e.target.value),
                      ),
                    }))
                  }
                  className="mt-1 w-40"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-2">
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
            setRanges(DCF_RANGES);
            setSeed(1);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <ul className="mt-4 space-y-1 text-sm">
        <li>
          Every input at its most likely value:{' '}
          <strong className="text-accent">{dollars(base.perShare)}</strong> a
          share.
        </li>
        <li>
          Middle of the {DRAWS.toLocaleString('en-US')} draws:{' '}
          <strong className="text-accent">{dollars(median)}</strong>. Middle
          80%: {dollars(p10)} to {dollars(p90)}.
        </li>
        <li>
          Draws at or above the market price of {dollars(PRICE)}:{' '}
          <strong className="text-accent">{pct(shareAbove)}</strong>.
        </li>
        <li>
          Long-run growth that makes the most likely case equal the price:{' '}
          <strong className="text-accent">{pct(implied, 2)}</strong>.
        </li>
      </ul>

      <ChartFrame
        description={`Histogram of Union Pacific's value per share in ${DRAWS.toLocaleString('en-US')} random draws, in ten-dollar bins. Bars below the market price of ${dollars(PRICE)} and bars at or above it have different colors, and a vertical line marks the price.`}
        summary={`Middle value ${dollars(median)}; middle 80% from ${dollars(p10)} to ${dollars(p90)}; ${pct(shareAbove)} of draws at or above the market price of ${dollars(PRICE)}.`}
      >
        <p className="mt-5 text-sm font-medium">
          Value per share in {DRAWS.toLocaleString('en-US')} draws
        </p>
        <div className="mt-1 h-72">
          <ResponsiveContainer>
            <BarChart
              data={histogram}
              margin={{ top: 8, right: 16, bottom: 16, left: 8 }}
              barCategoryGap={1}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                // At most about eight labels, evenly spaced, whatever the
                // number of bins.
                interval={Math.max(0, Math.ceil(histogram.length / 8) - 1)}
                label={{
                  value: 'value per share (bin starts at)',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis
                allowDecimals={false}
                width={48}
                label={{
                  value: 'draws',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 12,
                }}
              />
              <Tooltip
                labelFormatter={(_l, items) =>
                  String(items?.[0]?.payload?.detail ?? '')
                }
              />
              <Legend verticalAlign="top" height={28} />
              <Bar
                dataKey="below"
                name="Below the market price"
                stackId="draws"
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="above"
                name="At or above the market price"
                stackId="draws"
                fill="var(--chart-2)"
                isAnimationActive={false}
              />
              <ReferenceLine
                x={priceBin}
                stroke="var(--chart-ink)"
                strokeDasharray="4 3"
                label={{
                  value: `price ${dollars(PRICE)}`,
                  position: 'insideTopRight',
                  fontSize: 12,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        Each draw picks one revenue growth rate for all five years, one
        operating margin and one long-run growth rate, each from a triangle that
        peaks at its most likely value. The draws are independent of each other.
        Everything else stays at the base case: a 24.1% tax rate, 16.6% of
        after-tax operating income reinvested, a 7.57% cost of capital, net debt
        of $24,984 million and 593.4 million shares. The dashed line marks the
        ten-dollar bin that holds the market price of {dollars(PRICE)} on
        January 30, 2026. Sources: Union Pacific's 10-K reports for 2023 and
        2025 (SEC EDGAR).
      </p>
    </div>
  );
}
