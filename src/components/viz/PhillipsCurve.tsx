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

// Expectations-augmented Phillips curve:
//   pi_t = pi_e - beta*(u - u_n) + eps
// We let the user move expected inflation and the natural rate, and shade
// where today's inflation lands at the chosen unemployment rate.

interface State {
  piE: number;
  un: number;
  beta: number;
  u: number;
}

const baseline: State = { piE: 2, un: 5, beta: 0.5, u: 5 };

function curve({ piE, un, beta }: State) {
  return Array.from({ length: 61 }, (_, i) => {
    const u = i * 0.2;
    return { u, pi: piE - beta * (u - un) };
  });
}

export default function PhillipsCurve() {
  const [state, setState] = useState<State>(baseline);
  const data = useMemo(() => curve(state), [state]);
  const today = state.piE - state.beta * (state.u - state.un);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Expected inflation πᵉ (%)"
          v={state.piE}
          min={0}
          max={10}
          step={0.1}
          onChange={(v) => setState((s) => ({ ...s, piE: v }))}
        />
        <Slider
          label="Natural rate uₙ (%)"
          v={state.un}
          min={2}
          max={8}
          step={0.1}
          onChange={(v) => setState((s) => ({ ...s, un: v }))}
        />
        <Slider
          label="Slope β"
          v={state.beta}
          min={0.1}
          max={1.5}
          step={0.05}
          onChange={(v) => setState((s) => ({ ...s, beta: v }))}
        />
        <Slider
          label="Actual unemployment u (%)"
          v={state.u}
          min={0}
          max={12}
          step={0.1}
          onChange={(v) => setState((s) => ({ ...s, u: v }))}
        />
        <div className="self-end text-sm text-ink-muted">
          Today's inflation π = <strong>{today.toFixed(2)}%</strong>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="u"
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Unemployment u (%)',
                position: 'insideBottom',
                offset: -4,
                fontSize: 11,
              }}
            />
            <YAxis
              label={{
                value: 'Inflation π (%)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Legend verticalAlign="top" height={24} />
            <Line
              type="monotone"
              dataKey="pi"
              name="Phillips curve"
              stroke="#2563eb"
              dot={false}
            />
            <ReferenceDot
              x={state.u}
              y={today}
              r={5}
              fill="#0f172a"
              stroke="white"
            />
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
        {label}: <span className="text-accent">{v.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-56"
      />
    </label>
  );
}
