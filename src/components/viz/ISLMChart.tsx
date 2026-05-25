import { useMemo, useState } from 'react';
import { useAnimatedValue } from '@lib/animation/useAnimatedValue';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Closed-economy IS-LM in (Y, r).
//
//   IS curve (goods market clears):
//     Y = alpha*(A - b*r)   where A = C0 + I0 + G,  alpha = 1/(1 - c(1-t))
//     Equivalently r as a function of Y:
//       r_IS(Y) = (alpha*A - Y) / (alpha*b)
//
//   LM curve (money market clears):
//     M/P = k*Y - h*r   ==>   r_LM(Y) = (k*Y - M/P) / h
//
// Equilibrium (set r_IS(Y) = r_LM(Y), solve for Y):
//     Y* = (alpha*A*h + alpha*b*(M/P)) / (h + alpha*b*k)
//     r* = (k*Y* - M/P) / h
//
// Calibrated so baseline equilibrium sits at a textbook-style positive
// rate (~3-6%). Slider ranges keep r* > 0 across the bulk of settings;
// extreme combinations can still produce negative r, and the chart's
// auto-scaled Y axis handles that gracefully.

interface State {
  G: number;
  M: number;
  A0: number;
}

const baseline: State = { G: 100, M: 100, A0: 100 };
const params = { c: 0.6, t: 0.2, b: 20, k: 0.5, h: 10, P: 1 };

function solve(s: State) {
  const { c, t, b, k, h, P } = params;
  const alpha = 1 / (1 - c * (1 - t));
  const A = s.A0 + s.G;
  const Yeq = (A * alpha * h + alpha * b * (s.M / P)) / (h + alpha * b * k);
  const req = (k * Yeq - s.M / P) / h;
  return { alpha, A, Yeq, req };
}

function buildSeries(s: State, Yeq: number) {
  const { alpha, A } = solve(s);
  const { b, k, h, P } = params;
  // Common Y grid bracketing the equilibrium with margin on both sides.
  const lo = Math.max(0, Yeq - 200);
  const hi = Yeq + 200;
  const n = 41;
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const Y = lo + i * step;
    return {
      Y,
      rIS: (alpha * A - Y) / (alpha * b),
      rLM: (k * Y - s.M / P) / h,
    };
  });
}

export default function ISLMChart() {
  const [state, setState] = useState<State>(baseline);
  // Animate the underlying state so curves and the equilibrium point
  // ease into place when sliders jump (Reset, scenario buttons), while
  // staying responsive during scrubbing.
  const G = useAnimatedValue(state.G, { durationMs: 200 });
  const M = useAnimatedValue(state.M, { durationMs: 200 });
  const A0 = useAnimatedValue(state.A0, { durationMs: 200 });
  const animated: State = { G, M, A0 };
  const eq = useMemo(() => solve(animated), [G, M, A0]);
  const data = useMemo(() => buildSeries(animated, eq.Yeq), [G, M, A0, eq.Yeq]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-6">
        <Slider
          label="Government spending G"
          value={state.G}
          min={0}
          max={250}
          step={5}
          onChange={(v) => setState((s) => ({ ...s, G: v }))}
        />
        <Slider
          label="Money supply M"
          value={state.M}
          min={50}
          max={250}
          step={5}
          onChange={(v) => setState((s) => ({ ...s, M: v }))}
        />
        <Slider
          label="Autonomous spending C₀+I₀"
          value={state.A0}
          min={50}
          max={250}
          step={5}
          onChange={(v) => setState((s) => ({ ...s, A0: v }))}
        />
        <button
          onClick={() => setState(baseline)}
          className="text-sm text-ink-muted underline"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 text-sm text-ink-muted">
        Equilibrium: <strong>Y* = {eq.Yeq.toFixed(1)}</strong>,{' '}
        <strong>r* = {eq.req.toFixed(2)}%</strong>
      </div>

      <div className="mt-4 h-80">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="Y"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => v.toFixed(0)}
              label={{
                value: 'Output (Y)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => v.toFixed(0) + '%'}
              label={{
                value: 'Interest rate (r)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(v: number) => `${v.toFixed(2)}%`}
              labelFormatter={(label: number) => `Y = ${label.toFixed(0)}`}
            />
            <Legend verticalAlign="top" height={28} />
            <Line
              type="linear"
              dataKey="rIS"
              name="IS (goods market)"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="rLM"
              name="LM (money market)"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={eq.Yeq}
              y={eq.req}
              r={5}
              fill="#0f172a"
              stroke="white"
              strokeWidth={2}
              label={{
                value: 'eq',
                position: 'top',
                fontSize: 11,
                offset: 8,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Closed-economy IS-LM. Parameters: c = 0.6, t = 0.2, b = 20, k = 0.5,
        h = 10, P = 1. The IS curve slopes down (lower r ⇒ more investment
        ⇒ higher Y). The LM curve slopes up (higher Y ⇒ more money demand
        ⇒ higher r to clear the money market at fixed M). They cross at
        equilibrium. Drag sliders to study fiscal (G) and monetary (M)
        shocks.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">
        {label}: <span className="text-accent">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-56"
      />
    </label>
  );
}
