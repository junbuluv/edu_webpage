import { useMemo, useState } from 'react';
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

// Simple short-run AD-AS in (Y, P).
//   AD: Y = a - b*P + g*G + m*M
//   SRAS: P = P_e + c*(Y - Y_n)
// Solve simultaneously for equilibrium.

interface State {
  G: number;
  M: number;
  Pe: number;
  Yn: number;
}

const params = { a: 800, b: 40, g: 1.5, m: 0.4, c: 0.05 };
const baseline: State = { G: 100, M: 600, Pe: 2.5, Yn: 1000 };

function solve(s: State) {
  const { a, b, g, m, c } = params;
  // AD: Y = a - b*P + g*G + m*M
  // SRAS: P = Pe + c*(Y - Yn) => Y = (P - Pe)/c + Yn
  // a - b*P + gG + mM = (P - Pe)/c + Yn
  // c*(a - b*P + gG + mM) = P - Pe + c*Yn
  // c*a + c*gG + c*mM + Pe - c*Yn = P + c*b*P
  // P = (c*a + c*g*G + c*m*M + Pe - c*Yn) / (1 + c*b)
  const P =
    (c * a + c * g * s.G + c * m * s.M + s.Pe - c * s.Yn) / (1 + c * b);
  const Y = a - b * P + g * s.G + m * s.M;
  return { Y, P };
}

function buildSeries(s: State) {
  const { a, b, g, m, c } = params;
  const Ys = Array.from({ length: 41 }, (_, i) => 600 + i * 20);
  return Ys.map((Y) => ({
    Y,
    AD: (a - Y + g * s.G + m * s.M) / b,
    SRAS: s.Pe + c * (Y - s.Yn),
  }));
}

export default function ADASChart() {
  const [state, setState] = useState<State>(baseline);
  const data = useMemo(() => buildSeries(state), [state]);
  const eq = useMemo(() => solve(state), [state]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="G" v={state.G} min={0} max={300} step={5}
          onChange={(v) => setState((s) => ({ ...s, G: v }))} />
        <Slider label="M" v={state.M} min={200} max={1200} step={10}
          onChange={(v) => setState((s) => ({ ...s, M: v }))} />
        <Slider label="Expected price Pᵉ" v={state.Pe} min={1} max={5} step={0.1}
          onChange={(v) => setState((s) => ({ ...s, Pe: v }))} />
        <Slider label="Natural output Yₙ" v={state.Yn} min={800} max={1200} step={10}
          onChange={(v) => setState((s) => ({ ...s, Yn: v }))} />
        <div className="self-end text-sm text-ink-muted">
          Y* = <strong>{eq.Y.toFixed(0)}</strong>,
          P* = <strong>{eq.P.toFixed(2)}</strong>
        </div>
      </div>

      <div className="mt-4 h-80">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="Y" tickFormatter={(v) => v.toFixed(0)}
              label={{ value: 'Output (Y)', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis
              label={{ value: 'Price level (P)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="AD" name="AD" stroke="#2563eb" dot={false} />
            <Line type="monotone" dataKey="SRAS" name="SRAS" stroke="#dc2626" dot={false} />
            <ReferenceDot x={eq.Y} y={eq.P} r={5} fill="#0f172a" stroke="white" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Slider({
  label,
  v,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">
        {label}: <span className="text-accent">{v}</span>
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
