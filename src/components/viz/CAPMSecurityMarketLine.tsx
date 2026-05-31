import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// CAPM: E[R_i] = R_f + beta_i * (E[R_m] - R_f)
// SML is the line in (beta, E[R]) space.
// Observed assets plotted as scatter; alpha = observed - SML expectation.

interface State {
  rf: number;
  mrp: number;
}

const baseline: State = { rf: 0.04, mrp: 0.06 };

interface Asset {
  name: string;
  beta: number;
  observed: number; // observed return
}

const initialAssets: Asset[] = [
  { name: 'Treasury 10Y', beta: 0.05, observed: 0.045 },
  { name: 'Utility ETF', beta: 0.55, observed: 0.075 },
  { name: 'S&P 500', beta: 1.0, observed: 0.105 },
  { name: 'Tech ETF', beta: 1.3, observed: 0.15 },
  { name: 'Levered HF', beta: 1.8, observed: 0.14 },
];

function smlLine(s: State) {
  return Array.from({ length: 41 }, (_, i) => {
    const beta = i * 0.05;
    return { beta, exp: s.rf + beta * s.mrp };
  });
}

export default function CAPMSecurityMarketLine() {
  const [s, setS] = useState<State>(baseline);
  const [assets] = useState<Asset[]>(initialAssets);
  const line = useMemo(() => smlLine(s), [s]);
  const points = useMemo(
    () =>
      assets.map((a) => ({
        ...a,
        expected: s.rf + a.beta * s.mrp,
        alpha: a.observed - (s.rf + a.beta * s.mrp),
      })),
    [s, assets],
  );

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Risk-free rate Rf"
          v={s.rf}
          min={0}
          max={0.1}
          step={0.0025}
          fmt={(v) => (v * 100).toFixed(2) + '%'}
          onChange={(v) => setS((x) => ({ ...x, rf: v }))}
        />
        <Slider
          label="Market risk premium"
          v={s.mrp}
          min={0.02}
          max={0.15}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, mrp: v }))}
        />
        <div className="self-end text-sm text-ink-muted">
          Slope of SML = MRP = <strong>{(s.mrp * 100).toFixed(1)}%</strong>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <ComposedChart
            data={line}
            margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="beta"
              type="number"
              domain={[0, 2]}
              label={{
                value: 'beta (β)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              domain={[0, 0.25]}
              tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{
                value: 'expected / observed return',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip formatter={(v: number) => (v * 100).toFixed(2) + '%'} />
            <ReferenceLine
              y={s.rf}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: 'Rf', position: 'right', fontSize: 10 }}
            />
            <Line
              data={line}
              dataKey="exp"
              stroke="#2563eb"
              dot={false}
              name="SML"
              type="monotone"
            />
            <Scatter
              data={points}
              dataKey="observed"
              fill="#dc2626"
              name="Observed assets"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-ink-muted">
          <tr>
            <th className="py-1">Asset</th>
            <th>β</th>
            <th>Observed</th>
            <th>CAPM E[R]</th>
            <th>α</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.name} className="border-t border-slate-100">
              <td className="py-1.5">{p.name}</td>
              <td>{p.beta.toFixed(2)}</td>
              <td>{(p.observed * 100).toFixed(1)}%</td>
              <td>{(p.expected * 100).toFixed(1)}%</td>
              <td
                className={p.alpha >= 0 ? 'text-emerald-700' : 'text-rose-700'}
              >
                {p.alpha >= 0 ? '+' : ''}
                {(p.alpha * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-ink-muted">
        Points above the SML have positive α (mispriced cheap / outperforming).
        Below the line ⇒ negative α. In a CAPM-efficient market, α = 0 for every
        asset on average.
      </p>
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
        className="mt-1 w-48"
      />
    </label>
  );
}
