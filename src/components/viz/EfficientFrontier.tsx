import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

// Two-asset mean-variance frontier explorer (Berk & DeMarzo Ch 11). For a
// weight w in asset 1 (1-w in asset 2):
//   E[R_p] = w·E[R1] + (1-w)·E[R2]
//   σ_p²   = w²σ1² + (1-w)²σ2² + 2·w·(1-w)·ρ·σ1·σ2
// Lowering the correlation ρ bows the frontier left: the same expected
// return at lower risk. That leftward bow is the diversification benefit.
// Adding a risk-free asset, the best risky mix is the tangent (max-Sharpe)
// portfolio; the line from R_f through it is the capital market line.

interface State {
  er1: number;
  sd1: number;
  er2: number;
  sd2: number;
  rho: number;
  rf: number;
}

const baseline: State = {
  er1: 0.12,
  sd1: 0.2,
  er2: 0.07,
  sd2: 0.1,
  rho: 0.2,
  rf: 0.03,
};

function portfolio(s: State, w: number) {
  const er = w * s.er1 + (1 - w) * s.er2;
  const v =
    w * w * s.sd1 * s.sd1 +
    (1 - w) * (1 - w) * s.sd2 * s.sd2 +
    2 * w * (1 - w) * s.rho * s.sd1 * s.sd2;
  return { er, sd: Math.sqrt(Math.max(0, v)) };
}

export default function EfficientFrontier() {
  const [s, setS] = useState<State>(baseline);

  const { frontier, tangent, minVar } = useMemo(() => {
    // Long-only frontier (w in [0,1]) so the drawn curve and the tangent /
    // min-variance scans below cover the same set: the tangent dot then sits
    // exactly on the visible curve.
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 100; i += 1) {
      const { er, sd } = portfolio(s, i / 100);
      pts.push({ x: +(sd * 100).toFixed(3), y: +(er * 100).toFixed(3) });
    }
    // Grid-scan w in [0,1] for max Sharpe (tangent) and min variance.
    let best = { w: 0, sharpe: -Infinity, er: 0, sd: 0 };
    let mv = { w: 0, sd: Infinity, er: 0 };
    for (let i = 0; i <= 1000; i += 1) {
      const w = i / 1000;
      const { er, sd } = portfolio(s, w);
      if (sd > 1e-6) {
        const sharpe = (er - s.rf) / sd;
        if (sharpe > best.sharpe) best = { w, sharpe, er, sd };
      }
      if (sd < mv.sd) mv = { w, sd, er };
    }
    return { frontier: pts, tangent: best, minVar: mv };
  }, [s]);

  const maxX = Math.max(s.sd1, s.sd2) * 100 * 1.15;
  // Capital market line: from (0, rf) through the tangent portfolio.
  const cml = [
    { x: 0, y: +(s.rf * 100).toFixed(3) },
    {
      x: +maxX.toFixed(3),
      y: +((s.rf + tangent.sharpe * (maxX / 100)) * 100).toFixed(3),
    },
  ];

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-5">
        <Slider
          label="E[R₁]"
          v={s.er1}
          min={0}
          max={0.25}
          step={0.005}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, er1: v }))}
        />
        <Slider
          label="σ₁"
          v={s.sd1}
          min={0.02}
          max={0.4}
          step={0.005}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, sd1: v }))}
        />
        <Slider
          label="E[R₂]"
          v={s.er2}
          min={0}
          max={0.25}
          step={0.005}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, er2: v }))}
        />
        <Slider
          label="σ₂"
          v={s.sd2}
          min={0.02}
          max={0.4}
          step={0.005}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, sd2: v }))}
        />
        <Slider
          label="Correlation ρ"
          v={s.rho}
          min={-1}
          max={1}
          step={0.05}
          fmt={(v) => v.toFixed(2)}
          onChange={(v) => setS((x) => ({ ...x, rho: v }))}
        />
        <Slider
          label="Risk-free Rf"
          v={s.rf}
          min={0}
          max={0.08}
          step={0.0025}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, rf: v }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Tangent Sharpe" value={tangent.sharpe.toFixed(2)} />
        <Stat
          label="Tangent: weight in asset 1"
          value={(tangent.w * 100).toFixed(0) + '%'}
        />
        <Stat
          label="Min-variance σ"
          value={(minVar.sd * 100).toFixed(1) + '%'}
        />
      </div>

      <div className="h-80">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="risk"
              unit="%"
              domain={[0, Math.ceil(maxX)]}
              label={{
                value: 'risk σ (%)',
                position: 'insideBottom',
                offset: -8,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="return"
              unit="%"
              label={{
                value: 'expected return (%)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number) => v.toFixed(1) + '%'}
            />
            <Legend verticalAlign="top" height={24} />
            <Scatter
              name="Frontier (vary weights)"
              data={frontier}
              line={{ stroke: '#2563eb' }}
              fill="#2563eb"
              shape={() => <></>}
            />
            <Scatter
              name="Capital market line"
              data={cml}
              line={{ stroke: '#059669', strokeDasharray: '5 4' }}
              fill="#059669"
              shape={() => <></>}
            />
            <Scatter
              name="Assets"
              data={[
                { x: +(s.sd1 * 100).toFixed(2), y: +(s.er1 * 100).toFixed(2) },
                { x: +(s.sd2 * 100).toFixed(2), y: +(s.er2 * 100).toFixed(2) },
              ]}
              fill="#0f172a"
            />
            <Scatter
              name="Tangent portfolio"
              data={[
                {
                  x: +(tangent.sd * 100).toFixed(2),
                  y: +(tangent.er * 100).toFixed(2),
                },
              ]}
              fill="#dc2626"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-ink-muted">
        Drag correlation ρ down toward -1 and watch the blue frontier bow left:
        the same expected return becomes reachable at lower risk. That leftward
        bow is diversification. The green capital market line, drawn from the
        risk-free rate through the tangent portfolio, is the best risk-return
        trade-off any investor can reach by mixing the risk-free asset with that
        one tangent portfolio.
      </p>
    </div>
  );
}

const pct = (v: number) => (v * 100).toFixed(1) + '%';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
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
        className="mt-1 w-40"
      />
    </label>
  );
}
