import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import raw from '@lib/cases/yield-curve.json';
import {
  TENOR,
  forwardCheck,
  monthAt,
  monthIndex,
  monthLabel,
  runs,
  spread,
  type YieldCurveData,
} from '@lib/cases/yield-curve';
import ChartFrame from './ChartFrame';

// Replays month-end US Treasury yields (FRED) from January 2000. The top
// chart is one month's curve; the strip is the 10-year minus 2-year gap for
// the whole period with recessions shaded. The y-axis of the curve is fixed
// at 0 to 7% (the data's range is 0 to 6.71%) so the curve's moves are
// comparable from month to month while it plays. The 30-year point is null
// for February 2002 to January 2006 (see scripts/cases/yield-curve-data.ts).

const DATA: YieldCurveData = raw;
const LAST = DATA.yields.length - 1;
const MATURITY = ['3 mo', '1 yr', '2 yr', '5 yr', '10 yr', '30 yr'];
const STEP_MS = 150;

const label = (i: number) => monthLabel(monthAt(DATA.start, i));
const STRIP = DATA.yields.map((row, i) => ({
  i,
  gap: spread(row, TENOR.y10, TENOR.y2),
}));
const RECESSIONS = runs(DATA.recession);
const YEAR_TICKS = STRIP.filter(
  ({ i }) => i % 60 === 0, // January of 2000, 2005, ...
).map(({ i }) => i);

const PRESETS = [
  { month: '2004-06', name: 'June 2004: normal' },
  { month: '2007-02', name: 'February 2007: inverted' },
  { month: '2008-12', name: 'December 2008: crisis' },
  { month: '2023-07', name: 'July 2023: deeply inverted' },
].map((p) => ({ ...p, index: monthIndex(DATA.start, p.month) }));

const BASELINE = monthIndex(DATA.start, '2023-07');

const pct = (v: number) => `${v.toFixed(2)}%`;
const points = (v: number) => `${v.toFixed(2).replace('-', '−')} points`;

export default function YieldCurveReplay() {
  const [index, setIndex] = useState(BASELINE);
  const [showLater, setShowLater] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  // One month per step while playing; stops at the last month.
  useEffect(() => {
    if (!playing) return;
    if (index >= LAST) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, index]);

  const jump = (i: number) => {
    setPlaying(false);
    setIndex(i);
  };

  const row = DATA.yields[index];
  const laterRow = DATA.yields[index + 12];
  const gap2 = spread(row, TENOR.y10, TENOR.y2) ?? 0;
  const gap3m = spread(row, TENOR.y10, TENOR.m3) ?? 0;
  const check = forwardCheck(DATA.yields, index);
  const inRecession = DATA.recession[index] === 1;

  const nowName = label(index);
  const laterName = `One year later (${label(index + 12)})`;
  const curve = MATURITY.map((maturity, j) => ({
    maturity,
    now: row[j],
    later: showLater && laterRow ? laterRow[j] : undefined,
  }));

  const summary = playing
    ? 'Playing.'
    : `${nowName}: 3-month ${pct(row[TENOR.m3] ?? 0)}, 2-year ${pct(row[TENOR.y2] ?? 0)}, 10-year ${pct(row[TENOR.y10] ?? 0)}. 10-year minus 2-year gap ${points(gap2)}, ${gap2 < 0 ? 'inverted' : 'not inverted'}.`;

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <label className="flex flex-col text-sm">
        <span className="font-medium">
          Month: <span className="text-accent">{nowName}</span>
          {inRecession && (
            <span className="ml-2 font-normal text-ink-muted">
              (US recession month)
            </span>
          )}
        </span>
        <input
          type="range"
          min={0}
          max={LAST}
          step={1}
          value={index}
          onChange={(e) => jump(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!reduceMotion && (
          <button
            type="button"
            onClick={() => {
              if (!playing && index >= LAST) setIndex(0);
              setPlaying((p) => !p);
            }}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-strong"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
        {PRESETS.map((p) => (
          <button
            key={p.month}
            type="button"
            onClick={() => jump(p.index)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => jump(LAST)}
          className="rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Latest
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showLater}
          onChange={(e) => setShowLater(e.target.checked)}
        />
        Show what happened one year later
      </label>

      <ul className="mt-3 space-y-1 text-sm">
        <li>
          10-year minus 2-year:{' '}
          <strong className="text-accent">{points(gap2)}</strong>
          {gap2 < 0 ? ' (inverted)' : ''}
        </li>
        <li>
          10-year minus 3-month:{' '}
          <strong className="text-accent">{points(gap3m)}</strong>
          {gap3m < 0 ? ' (inverted)' : ''}
        </li>
        <li>
          1-year rate a year ahead implied by this curve:{' '}
          <strong className="text-accent">{pct(check.implied)}</strong>.
          {showLater &&
            (check.realized === null
              ? ` The 1-year yield for ${label(index + 12)} is not known yet.`
              : ` Actual 1-year yield in ${label(index + 12)}: ${pct(check.realized)}.`)}
        </li>
      </ul>

      <ChartFrame
        description="Two charts. First: the US Treasury yield curve for the chosen month, yield in percent against maturity from 3 months to 30 years, with an optional dashed curve for one year later. Second: the 10-year minus 2-year yield gap for every month since January 2000, with US recessions shaded and a marker at the chosen month."
        summary={summary}
      >
        <p className="mt-5 text-sm font-medium">
          Treasury yield curve, {nowName}
        </p>
        <div className="mt-1 h-72">
          <ResponsiveContainer>
            <LineChart
              data={curve}
              margin={{ top: 8, right: 16, bottom: 16, left: 8 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="maturity"
                label={{
                  value: 'maturity',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis
                domain={[0, 7]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                interval={0}
                tickFormatter={(v) => `${v}%`}
                width={48}
              />
              <Tooltip
                formatter={(v) => (typeof v === 'number' ? pct(v) : 'n/a')}
              />
              <Legend verticalAlign="top" height={28} />
              <Line
                type="linear"
                dataKey="now"
                name={nowName}
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
              {showLater && laterRow && (
                <Line
                  type="linear"
                  dataKey="later"
                  name={laterName}
                  stroke="var(--chart-ref)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-5 text-sm font-medium">
          10-year minus 2-year gap, percentage points (click to pick a month)
        </p>
        <div className="mt-1 h-40 cursor-pointer">
          <ResponsiveContainer>
            <LineChart
              data={STRIP}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              onClick={(state) => {
                if (state?.activeLabel != null) jump(Number(state.activeLabel));
              }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              {RECESSIONS.map(([from, to]) => (
                <ReferenceArea
                  key={from}
                  x1={Math.max(0, from - 0.5)}
                  x2={to + 0.5}
                  fill="var(--chart-ref)"
                  fillOpacity={0.25}
                  stroke="none"
                />
              ))}
              <XAxis
                dataKey="i"
                type="number"
                domain={[0, LAST]}
                ticks={YEAR_TICKS}
                tickFormatter={(i: number) =>
                  monthAt(DATA.start, i).slice(0, 4)
                }
              />
              <YAxis
                domain={[-1.5, 3]}
                ticks={[-1, 0, 1, 2, 3]}
                interval={0}
                width={48}
              />
              <Tooltip
                formatter={(v: number) => points(v)}
                labelFormatter={(i: number) => label(i)}
              />
              <ReferenceLine y={0} stroke="var(--chart-ref)" />
              <Line
                type="linear"
                dataKey="gap"
                name="10-year minus 2-year"
                stroke="var(--chart-1)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine x={index} stroke="var(--chart-ink)" />
              <ReferenceDot
                x={index}
                y={gap2}
                r={4}
                fill="var(--chart-ink)"
                stroke="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        Month-end US Treasury yields from FRED (series DGS3MO, DGS1, DGS2, DGS5,
        DGS10, DGS30), January 2000 to {label(LAST)}. Maturities are evenly
        spaced on the axis. The 30-year point is empty from February 2002 to
        January 2006: FRED notes that the 30-year series was discontinued on
        February 18, 2002 and reintroduced on February 9, 2006. Shaded bands are
        US recessions (FRED series USREC). Below the zero line the 10-year yield
        is under the 2-year yield: the curve is inverted. The implied 1-year
        rate treats the published yields as if the bonds paid no coupons. The
        chart opens on July 2023, the middle of the longest inversion in the
        data.
      </p>
    </div>
  );
}
