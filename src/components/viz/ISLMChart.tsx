import { useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';

// Closed-economy IS-LM in (Y, r).
// IS: Y = (C0 + I0 - b*r + G) / (1 - c(1 - t))
// LM: M/P = k*Y - h*r  ==>  r = (k*Y - M/P) / h
//
// Solved equilibrium:
//   alpha = 1 / (1 - c(1 - t))
//   A = C0 + I0 + G
//   IS: Y_IS(r) = alpha*(A - b*r)
//   LM: r_LM(Y) = (k*Y - M/P) / h
//   Y* = (A*alpha*h + b*M/P) / (h + alpha*b*k)
//   r* = (k*Y* - M/P) / h

interface State {
  G: number; // government spending shifter (IS)
  M: number; // money supply (LM)
  A0: number; // autonomous spending C0 + I0 baseline
}

const baseline = { G: 100, M: 600, A0: 200 };
const params = { c: 0.6, t: 0.2, b: 20, k: 0.5, h: 10, P: 1 };

function solve(s: State) {
  const { c, t, b, k, h, P } = params;
  const alpha = 1 / (1 - c * (1 - t));
  const A = s.A0 + s.G;
  const Yeq = (A * alpha * h + b * (s.M / P)) / (h + alpha * b * k);
  const req = (k * Yeq - s.M / P) / h;
  return { alpha, A, Yeq, req };
}

function buildSeries(s: State) {
  const { alpha, A } = solve(s);
  const { b, k, h, P } = params;
  const rs = Array.from({ length: 41 }, (_, i) => i * 0.5); // r from 0 to 20
  return rs.map((r) => ({
    r,
    Y_IS: alpha * (A - b * r),
    Y_LM: (h * r + s.M / P) / k, // invert LM to plot Y on x-axis below
  }));
}

export default function ISLMChart() {
  const [state, setState] = useState<State>(baseline);
  const data = useMemo(() => buildSeries(state), [state]);
  const eq = useMemo(() => solve(state), [state]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-6">
        <Slider
          label="Government spending G"
          value={state.G}
          min={0}
          max={300}
          step={5}
          onChange={(v) => setState((s) => ({ ...s, G: v }))}
        />
        <Slider
          label="Money supply M"
          value={state.M}
          min={200}
          max={1200}
          step={10}
          onChange={(v) => setState((s) => ({ ...s, M: v }))}
        />
        <Slider
          label="Autonomous spending C₀+I₀"
          value={state.A0}
          min={50}
          max={400}
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
              dataKey="Y_IS"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(v) => v.toFixed(0)}
              label={{ value: 'Output (Y)', position: 'insideBottom', offset: -10 }}
            />
            <YAxis
              dataKey="r"
              type="number"
              domain={[0, 20]}
              label={{ value: 'Interest rate (r, %)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(v: number) => v.toFixed(2)}
              labelFormatter={() => ''}
            />
            <Legend verticalAlign="top" height={28} />
            <Line
              data={data}
              dataKey="r"
              name="IS"
              dot={false}
              stroke="#2563eb"
              strokeWidth={2}
              isAnimationActive={false}
              type="monotone"
            />
            <Line
              data={data.map((d) => ({ ...d, _x: d.Y_LM }))}
              dataKey="r"
              name="LM"
              dot={false}
              stroke="#dc2626"
              strokeWidth={2}
              isAnimationActive={false}
              type="monotone"
              xAxisId={0}
            />
            <ReferenceDot
              x={eq.Yeq}
              y={eq.req}
              r={5}
              fill="#0f172a"
              stroke="white"
              ifOverflow="visible"
              label={{ value: 'Equilibrium', position: 'top', fontSize: 12 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Closed-economy IS-LM. Parameters: c = 0.6, t = 0.2, b = 20, k = 0.5, h = 10, P = 1.
        Drag sliders to study fiscal (G) and monetary (M) shocks.
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
