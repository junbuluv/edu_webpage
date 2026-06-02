import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Gordon dividend-discount model with the value-creation lens (Berk &
// DeMarzo Ch 9). Growth is not a free dial: it comes from retaining
// earnings and reinvesting them at a return. g = retention b × return on
// new investment. Reinvesting only ADDS value when that return exceeds the
// cost of equity r_E; otherwise growth destroys value. The chart plots
// price against retention so students see the no-growth benchmark
// (pay everything out, P = EPS₁ / r_E) and whether retaining beats it.

interface State {
  eps1: number; // next-year earnings per share
  retention: number; // fraction of earnings reinvested (b)
  roi: number; // return on new investment
  rE: number; // cost of equity
}

const baseline: State = { eps1: 5, retention: 0.4, roi: 0.12, rE: 0.1 };

function growth(s: State) {
  return s.retention * s.roi; // g = b × ROI
}
function div1(s: State) {
  return s.eps1 * (1 - s.retention);
}
// Gordon price; null when g ≥ r_E (formula explodes / invalid).
function price(s: State): number | null {
  const g = growth(s);
  if (g >= s.rE) return null;
  return div1(s) / (s.rE - g);
}
// No-growth benchmark: pay out 100% of earnings forever.
function benchmark(s: State) {
  return s.eps1 / s.rE;
}

export default function DDMValuation() {
  const [s, setS] = useState<State>(baseline);
  const g = growth(s);
  const P = price(s);
  const base = benchmark(s);
  const created = P === null ? null : P - base;

  // Price as a function of retention b, holding ROI/r_E/EPS fixed.
  const curve = useMemo(() => {
    const pts: { b: number; price: number | null }[] = [];
    for (let i = 0; i <= 90; i += 2) {
      const b = i / 100;
      const gg = b * s.roi;
      const p = gg >= s.rE ? null : (s.eps1 * (1 - b)) / (s.rE - gg);
      pts.push({ b, price: p && p > 0 && p < 5000 ? p : null });
    }
    return pts;
  }, [s.eps1, s.roi, s.rE]);

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap gap-6">
        <Slider
          label="Next-year EPS₁"
          v={s.eps1}
          min={1}
          max={20}
          step={0.5}
          fmt={(v) => `$${v.toFixed(2)}`}
          onChange={(v) => setS((x) => ({ ...x, eps1: v }))}
        />
        <Slider
          label="Retention b"
          v={s.retention}
          min={0}
          max={0.9}
          step={0.05}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, retention: v }))}
        />
        <Slider
          label="Return on new investment"
          v={s.roi}
          min={0}
          max={0.25}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, roi: v }))}
        />
        <Slider
          label="Cost of equity r_E"
          v={s.rE}
          min={0.04}
          max={0.2}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, rE: v }))}
        />
      </div>

      <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Growth g = b × ROI" value={(g * 100).toFixed(2) + '%'} />
        <Stat label="Dividend Div₁" value={`$${div1(s).toFixed(2)}`} />
        <Stat
          label="Price P₀"
          value={P === null ? '— (g ≥ r_E)' : `$${P.toFixed(2)}`}
          tone={P === null ? 'warn' : 'neutral'}
        />
        <Stat
          label="vs no-growth benchmark"
          value={
            created === null
              ? '—'
              : `${created >= 0 ? '+' : ''}$${created.toFixed(2)}`
          }
          tone={created === null ? 'warn' : created >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="md:col-span-2">
        <h4 className="text-sm font-semibold mb-2">
          Price vs retention (benchmark = pay out everything, ${base.toFixed(2)}
          )
        </h4>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={curve}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="b"
                tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
                label={{
                  value: 'retention b',
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 11,
                }}
              />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v: number) => `$${v.toFixed(2)}`}
                labelFormatter={(l: number) =>
                  `retention = ${(l * 100).toFixed(0)}%`
                }
              />
              <ReferenceLine
                y={base}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{
                  value: 'no-growth benchmark',
                  position: 'insideTopRight',
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                name="P₀(b)"
                stroke="#2563eb"
                dot={false}
                connectNulls
              />
              {P !== null && (
                <ReferenceDot
                  x={s.retention}
                  y={P}
                  r={4}
                  fill="#dc2626"
                  stroke="none"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          When the return on new investment exceeds r_E, the curve rises above
          the benchmark: retaining and reinvesting creates value. When it is
          below r_E, the curve falls and the same growth destroys value. Equal
          to r_E, the line is flat, so growth is value-neutral.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'bad'
        ? 'text-rose-700'
        : tone === 'warn'
          ? 'text-amber-700'
          : 'text-ink';
  return (
    <div className="rounded bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</div>
    </div>
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
