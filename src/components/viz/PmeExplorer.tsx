import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import raw from '@lib/cases/market-annual.json';
import {
  FUND,
  accounts,
  compoundReturn,
  fundIrr,
  lastVintage,
  marketReturnsFor,
  pme,
  tvpi,
  type MarketData,
} from '@lib/cases/pme';
import ChartFrame from './ChartFrame';

// A made-up buyout fund (src/lib/cases/pme.ts) placed in any ten-year window
// of US stock market history since 1927 (Ken French Data Library). The same
// cash flows give the same IRR in every window, but the public market
// equivalent changes with what the market did over those years.

const DATA: MarketData = raw;
const FIRST = DATA.start;
const LAST = lastVintage(DATA);
const BASELINE = 1990;

const PRESETS = [
  { year: 1990, name: '1990: strong market' },
  { year: 2000, name: '2000: weak decade' },
  { year: 2007, name: '2007: crisis start' },
  { year: LAST, name: `${LAST}: latest` },
];

const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${v.toFixed(2)}%`;

export default function PmeExplorer() {
  const [vintage, setVintage] = useState(BASELINE);
  const [scale, setScale] = useState(1);

  const returns = marketReturnsFor(DATA, vintage);
  const irr = fundIrr(FUND, scale);
  const multiple = tvpi(FUND, scale);
  const ratio = pme(FUND, scale, returns);
  const market = compoundReturn(returns);
  const path = accounts(FUND, scale, returns).map((a) => ({
    year: vintage + a.year - 1,
    payIn: a.payIn,
    payOut: a.payOut,
  }));

  const byVintage = useMemo(() => {
    const rows: { year: number; pme: number }[] = [];
    for (let v = FIRST; v <= LAST; v++) {
      rows.push({ year: v, pme: pme(FUND, scale, marketReturnsFor(DATA, v)) });
    }
    return rows;
  }, [scale]);
  const beat = byVintage.filter((r) => r.pme >= 1).length;
  // Ticks every 0.5 up to the tallest bar, so 1 always gets a label.
  const top = Math.ceil(Math.max(...byVintage.map((r) => r.pme)) * 2) / 2;
  const pmeTicks = Array.from({ length: top * 2 + 1 }, (_, i) => i / 2);

  const verdict =
    ratio >= 1
      ? 'at or above 1: the fund did at least as well as the same money in the stock market'
      : 'below 1: the same money in the stock market would have done better';

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <label className="flex flex-col text-sm">
          <span className="font-medium">
            Fund's first year: <span className="text-accent">{vintage}</span>
          </span>
          <input
            type="range"
            min={FIRST}
            max={LAST}
            step={1}
            value={vintage}
            onChange={(e) => setVintage(Number(e.target.value))}
            className="mt-1 w-56"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium">
            Payouts, share of the base case:{' '}
            <span className="text-accent">{Math.round(scale * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-1 w-56"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.year}
            type="button"
            onClick={() => setVintage(p.year)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setVintage(BASELINE);
            setScale(1);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <ul className="mt-4 max-w-measure space-y-1 text-sm">
        <li>
          Fund IRR: <strong className="text-accent">{pct(irr)}</strong> a year,
          whatever the first year.
        </li>
        <li>
          Paid out over paid in (TVPI):{' '}
          <strong className="text-accent">{f2(multiple)}</strong>.
        </li>
        <li>
          Stock market return over the fund's life ({vintage + 1} to{' '}
          {vintage + 9}): <strong className="text-accent">{pct(market)}</strong>{' '}
          a year.
        </li>
        <li>
          Public market equivalent (PME):{' '}
          <strong className="text-accent">{f2(ratio)}</strong>, {verdict}.
        </li>
      </ul>

      <ChartFrame
        description={`Two charts. First: for the chosen ten-year window, the value of two stock market accounts at the end of each year, one holding every pay-in to the fund and one holding every payout from it; the PME is the payout account over the pay-in account in the last year. Second: the fund's PME for every first year from ${FIRST} to ${LAST}, with a line at 1 and a marker at the chosen year.`}
        summary={`Fund started ${vintage}: IRR ${pct(irr)}, TVPI ${f2(multiple)}, stock market ${pct(market)} a year, PME ${f2(ratio)}. ${beat} of ${byVintage.length} first years give a PME of 1 or more.`}
      >
        <p className="mt-5 text-sm font-medium">
          The fund's cash, each dollar put in the stock market, {vintage} to{' '}
          {vintage + 9}, per 100 committed
        </p>
        <div className="mt-1 h-64">
          <ResponsiveContainer>
            <LineChart
              data={path}
              margin={{ top: 8, right: 16, bottom: 16, left: 8 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{
                  value: 'end of year',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis width={48} />
              <Tooltip formatter={(v: number) => v.toFixed(1)} />
              <Legend verticalAlign="top" height={28} />
              <Line
                type="linear"
                dataKey="payIn"
                name="Pay-ins, invested in the market"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="payOut"
                name="Payouts, reinvested in the market"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 text-sm font-medium">
          The same fund's PME for every first year, {FIRST} to {LAST} (click to
          pick a year)
        </p>
        <div className="mt-1 h-44 cursor-pointer">
          <ResponsiveContainer>
            <BarChart
              data={byVintage}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              barCategoryGap={1}
              onClick={(state) => {
                if (state?.activeLabel != null) {
                  setVintage(Number(state.activeLabel));
                }
              }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                interval={9}
                tickFormatter={(y: number) => String(y)}
              />
              <YAxis
                width={48}
                domain={[0, top]}
                ticks={pmeTicks}
                interval={0}
              />
              <Tooltip
                formatter={(v: number) => [f2(v), 'PME']}
                labelFormatter={(y) => `Fund started ${y}`}
              />
              <Bar
                dataKey="pme"
                name="PME"
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
              <ReferenceLine y={1} stroke="var(--chart-ink)" />
              <ReferenceLine
                x={vintage}
                stroke="var(--chart-2)"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        The fund is made up: 100 paid in over years 1 to 4, 190 paid out over
        years 4 to 10, all at year end. The stock market is the US market's
        total return, dividends included, from the Ken French Data Library
        (Mkt-RF plus RF, January to December, {FIRST} to{' '}
        {FIRST + DATA.market.length - 1}). {DATA.copyright}. The orange line in
        the lower chart marks the chosen first year; the black line marks a PME
        of 1. The chart opens on 1990, when the same fund lost to the market.
      </p>
    </div>
  );
}
