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

// Okun's law:  u - u_n = -k * (Y - Y_n)/Y_n           (k ≈ 0.5 for US)
// Phillips curve (expectations-augmented):
//   π = π_e - β*(u - u_n) + ε
//
// Chain: output gap → unemployment gap (via Okun) → inflation (via Phillips).

interface State {
  outputGap: number;   // (Y - Y_n) / Y_n in percent
  natUnemp: number;    // u_n in percent
  inflExp: number;     // π_e in percent
  beta: number;        // Phillips slope
  okunK: number;       // Okun coefficient
}

const baseline: State = { outputGap: 0, natUnemp: 4.5, inflExp: 2.5, beta: 0.5, okunK: 0.5 };

function chain(s: State, gap: number) {
  const u = s.natUnemp - s.okunK * gap;
  const pi = s.inflExp - s.beta * (u - s.natUnemp);
  return { u, pi };
}

function buildSeries(s: State) {
  // Iterate over output gap (used by Okun panel x-axis).
  return Array.from({ length: 41 }, (_, i) => {
    const gap = -5 + i * 0.25;
    const { u, pi } = chain(s, gap);
    return { gap, u, pi };
  });
}

export default function OkunPhillips() {
  const [s, setS] = useState<State>(baseline);
  const data = useMemo(() => buildSeries(s), [s]);
  // Phillips panel plots π vs u; sort by u so the line draws monotonically.
  const phillipsData = useMemo(
    () => [...data].sort((a, b) => a.u - b.u),
    [data],
  );
  const current = useMemo(() => chain(s, s.outputGap), [s]);

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap gap-6">
        <Slider label="Output gap (Y−Yₙ)/Yₙ" v={s.outputGap} min={-5} max={5} step={0.25}
          fmt={(v) => v.toFixed(2) + '%'}
          onChange={(v) => setS((x) => ({ ...x, outputGap: v }))} />
        <Slider label="Natural rate uₙ" v={s.natUnemp} min={3} max={7} step={0.1}
          fmt={(v) => v.toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, natUnemp: v }))} />
        <Slider label="Expected inflation πᵉ" v={s.inflExp} min={0} max={8} step={0.1}
          fmt={(v) => v.toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, inflExp: v }))} />
        <Slider label="Phillips slope β" v={s.beta} min={0.1} max={1.5} step={0.05}
          fmt={(v) => v.toFixed(2)}
          onChange={(v) => setS((x) => ({ ...x, beta: v }))} />
        <Slider label="Okun coefficient k" v={s.okunK} min={0.2} max={1.0} step={0.05}
          fmt={(v) => v.toFixed(2)}
          onChange={(v) => setS((x) => ({ ...x, okunK: v }))} />
        <div className="self-end text-sm text-ink-muted">
          u = <strong>{current.u.toFixed(2)}%</strong>, π = <strong>{current.pi.toFixed(2)}%</strong>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Okun: gap → unemployment</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="gap" tickFormatter={(v) => v.toFixed(0) + '%'}
                label={{ value: 'output gap', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis tickFormatter={(v) => v.toFixed(0) + '%'}
                label={{ value: 'u (%)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toFixed(2) + '%'} />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" dataKey="u" name="u(gap)" stroke="#2563eb" dot={false} />
              <ReferenceDot x={s.outputGap} y={current.u} r={5} fill="#0f172a" stroke="white" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Phillips: unemployment → inflation</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={phillipsData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="u" type="number" domain={['auto', 'auto']}
                tickFormatter={(v) => v.toFixed(1) + '%'}
                label={{ value: 'unemployment u', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis tickFormatter={(v) => v.toFixed(1) + '%'}
                label={{ value: 'π (%)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toFixed(2) + '%'} />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" dataKey="pi" name="π(u)" stroke="#dc2626" dot={false} />
              <ReferenceDot x={current.u} y={current.pi} r={5} fill="#0f172a" stroke="white" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="md:col-span-2 mt-1 text-xs text-ink-muted">
        Positive output gap (boom) ⇒ lower unemployment via Okun ⇒ higher
        inflation via the Phillips curve. Try sliding the output gap from
        −3% to +3% — that's roughly the swing the US economy made between
        the 2020 trough and the 2022 over-heating.
      </p>
    </div>
  );
}

function Slider({
  label, v, min, max, step, fmt, onChange,
}: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; }) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">{label}: <span className="text-accent">{fmt(v)}</span></span>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-48" />
    </label>
  );
}
