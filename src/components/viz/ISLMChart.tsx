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

// Closed-economy IS-LM in (Y, r).
// IS: Y = C0 + I0 - b*r + G; with linear C, t, multiplier alpha:
//   Y_IS(r) = alpha*(A - b*r),   A = C0 + I0 + G,   alpha = 1/(1 - c(1-t))
// LM: M/P = k*Y - h*r  ==>  r_LM(Y) = (k*Y - M/P)/h
// Equilibrium (sub LM into IS):
//   alpha*A*h + alpha*b*(M/P) = Y*(h + alpha*b*k)
//   Y* = (alpha*A*h + alpha*b*M/P) / (h + alpha*b*k)
//   r* = (k*Y* - M/P)/h

interface State {
  G: number;
  M: number;
  A0: number;
}

const baseline: State = { G: 100, M: 600, A0: 200 };
const params = { c: 0.6, t: 0.2, b: 20, k: 0.5, h: 10, P: 1 };

function solve(s: State) {
  const { c, t, b, k, h, P } = params;
  const alpha = 1 / (1 - c * (1 - t));
  const A = s.A0 + s.G;
  const Yeq = (A * alpha * h + alpha * b * (s.M / P)) / (h + alpha * b * k);
  const req = (k * Yeq - s.M / P) / h;
  return { alpha, A, Yeq, req };
}

function buildCurves(s: State) {
  const { alpha, A } = solve(s);
  const { b, k, h, P } = params;
  const rs = Array.from({ length: 41 }, (_, i) => i * 0.5);
  const isCurve = rs.map((r) => ({ x: alpha * (A - b * r), y: r }));
  const lmCurve = rs.map((r) => ({ x: (h * r + s.M / P) / k, y: r }));
  return { isCurve, lmCurve };
}

export default function ISLMChart() {
  const [state, setState] = useState<State>(baseline);
  const { isCurve, lmCurve } = useMemo(() => buildCurves(state), [state]);
  const eq = useMemo(() => solve(state), [state]);
  const eqPoint = [{ x: eq.Yeq, y: eq.req }];

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
          <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Output (Y)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, 20]}
              label={{
                value: 'Interest rate (r, %)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <ZAxis range={[0, 0]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number, name: string) => [
                name === 'y' ? `${v.toFixed(2)}%` : v.toFixed(0),
                name === 'y' ? 'r' : 'Y',
              ]}
            />
            <Legend verticalAlign="top" height={28} />
            <Scatter
              data={isCurve}
              name="IS"
              fill="#2563eb"
              line={{ stroke: '#2563eb', strokeWidth: 2 }}
              shape={() => <></>}
              isAnimationActive={false}
            />
            <Scatter
              data={lmCurve}
              name="LM"
              fill="#dc2626"
              line={{ stroke: '#dc2626', strokeWidth: 2 }}
              shape={() => <></>}
              isAnimationActive={false}
            />
            <Scatter
              data={eqPoint}
              name="Equilibrium"
              fill="#0f172a"
              shape="circle"
              isAnimationActive={false}
            />
          </ScatterChart>
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
