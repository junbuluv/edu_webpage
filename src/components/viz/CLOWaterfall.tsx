import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ILLUSTRATIVE_TRANCHES,
  allocateLosses,
  poolLoss,
  type TrancheResult,
} from '@lib/clo/waterfall';
import ChartFrame from './ChartFrame';

// Principal-loss waterfall for an illustrative CLO. The pool loses
// d * (1 - R) of its principal (cumulative default rate d, recovery rate R),
// and that loss is charged to the tranches from the equity upward. Excess
// interest is left out: in a real deal it is paid to the equity each quarter
// and redirected to repay senior notes when a coverage test fails.

interface State {
  d: number; // cumulative default rate of the loan pool
  r: number; // recovery rate on defaulted loans
}

const baseline: State = { d: 0.2, r: 0.65 };

export default function CLOWaterfall() {
  const [s, setS] = useState<State>(baseline);

  // Whole basis points, so a loss that exactly wipes out one tranche leaves
  // the next one untouched instead of nicked by float error.
  const loss = Math.round(poolLoss(s.d, s.r) * 1e4) / 100;
  const rows = allocateLosses(ILLUSTRATIVE_TRANCHES, loss);
  const data = rows.map((t) => ({
    ...t,
    // Non-breaking spaces: Recharts wraps a bar label at ordinary spaces.
    label: t.lost > 0 ? `${lostShare(t)} lost`.replaceAll(' ', ' ') : '',
  }));
  const outcome = describe(rows);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Cumulative default rate"
          v={s.d}
          step={0.01}
          onChange={(v) => setS((x) => ({ ...x, d: v }))}
        />
        <Slider
          label="Recovery rate"
          v={s.r}
          step={0.05}
          onChange={(v) => setS((x) => ({ ...x, r: v }))}
        />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 max-w-measure text-sm">
        Pool loss = {pct(s.d)} × (1 − {pct(s.r)}) ={' '}
        <strong className="text-rose-700">{loss.toFixed(1)}%</strong>: {outcome}
      </p>

      <ChartFrame
        description={
          'One horizontal bar per tranche of an illustrative CLO, from AAA at the top to equity at the bottom. Bar length is the tranche size as a percent of the loan pool: AAA 62, AA 12, A 6, BBB 6, BB 5, equity 9. Each bar is split into principal still intact and principal lost.'
        }
        summary={`Pool loss ${loss.toFixed(1)}%: ${outcome}`}
      >
        <div className="mt-3 h-80">
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 72, bottom: 16, left: 8 }}
            >
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 70]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "tranche size (% of the pool's principal)",
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis type="category" dataKey="name" width={56} />
              <Tooltip
                formatter={(v: number) => `${v.toFixed(1)}% of the pool`}
              />
              {/* No fixed height: on a phone the legend wraps and must push the bars down. */}
              <Legend
                verticalAlign="top"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Bar
                dataKey="intact"
                name="principal intact"
                stackId="tranche"
                fill="var(--chart-1)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="lost"
                name="principal lost"
                stackId="tranche"
                fill="var(--chart-2)"
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="label"
                  position="right"
                  style={{ fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        The tranche sizes are illustrative, not a real deal. Losses climb from
        the bottom: equity is hit first, and no tranche loses a dollar until
        every tranche below it is gone. This chart allocates principal losses
        only. A real CLO also collects more interest on its loans than it pays
        on its notes. That excess interest goes to the equity each quarter, and
        a failed coverage test redirects it to repay senior notes. So real notes
        hold up better than these bars, and the equity collects years of
        interest that its bar does not show.
      </p>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Share of a partly hit tranche that is lost, kept honest at the extremes.
function lostShare(t: TrancheResult): string {
  const p = (t.lost / t.size) * 100;
  if (p < 1) return 'under 1%';
  if (p >= 99.5 && t.intact > 0) return 'over 99%';
  return `${Math.round(p)}%`;
}

const list = (names: string[]) =>
  names.length > 2
    ? `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    : names.join(' and ');

// "equity is wiped out; BB loses 60% of its principal; BBB and above are untouched."
function describe(rows: TrancheResult[]): string {
  const juniorFirst = [...rows].reverse();
  const name = (t: TrancheResult) => (t.name === 'Equity' ? 'equity' : t.name);
  const wiped = juniorFirst.filter((t) => t.intact === 0);
  const partial = juniorFirst.find((t) => t.lost > 0 && t.intact > 0);
  const untouched = juniorFirst.filter((t) => t.lost === 0);

  if (wiped.length === rows.length) return 'every tranche is wiped out.';
  if (untouched.length === rows.length) return 'no tranche loses principal.';

  const parts: string[] = [];
  if (wiped.length)
    parts.push(
      `${list(wiped.map(name))} ${wiped.length > 1 ? 'are' : 'is'} wiped out`,
    );
  if (partial)
    parts.push(`${name(partial)} loses ${lostShare(partial)} of its principal`);
  if (untouched.length)
    parts.push(
      untouched.length > 1
        ? `${name(untouched[0])} and above are untouched`
        : `${name(untouched[0])} is untouched`,
    );
  return `${parts.join('; ')}.`;
}

function Slider({
  label,
  v,
  step,
  onChange,
}: {
  label: string;
  v: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">
        {label}: <span className="text-accent">{pct(v)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-44"
      />
    </label>
  );
}
