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

// WACC = (E/V) * rE + (D/V) * rD * (1 - tax)
// With MM-with-taxes intuition: as D/E rises, tax shield lowers WACC up to
// a point, but financial-distress costs eventually offset.
//
// We let the user set base rE, rD, tax, and a distress-cost parameter
// alpha. Effective rD grows quadratically with D/V beyond a kink to capture
// rising default risk.

interface State {
  baseRE: number;
  baseRD: number;
  tax: number;
  distress: number;
}

const baseline: State = { baseRE: 0.10, baseRD: 0.05, tax: 0.21, distress: 0.5 };

function rdAt(s: State, dv: number) {
  // No distress until D/V > 0.4, then quadratic rise
  const kink = 0.4;
  if (dv <= kink) return s.baseRD;
  const excess = dv - kink;
  return s.baseRD + s.distress * excess * excess;
}

function reAt(s: State, dv: number) {
  // MM II: rE rises with leverage. r_E = r_U + (D/E) * (r_U - r_D) * (1 - t)
  // Use baseRE as r_U for simplicity.
  if (dv >= 0.999) return 10; // avoid div by zero
  const ev = 1 - dv;
  const de = dv / ev;
  return s.baseRE + de * (s.baseRE - rdAt(s, dv)) * (1 - s.tax);
}

function waccAt(s: State, dv: number) {
  const ev = 1 - dv;
  const rd = rdAt(s, dv);
  const re = reAt(s, dv);
  return ev * re + dv * rd * (1 - s.tax);
}

export default function WACCVisualizer() {
  const [s, setS] = useState<State>(baseline);
  const data = useMemo(
    () =>
      Array.from({ length: 81 }, (_, i) => {
        const dv = i * 0.01;
        return {
          dv,
          wacc: waccAt(s, dv),
          rd: rdAt(s, dv) * (1 - s.tax),
          re: reAt(s, dv),
        };
      }),
    [s],
  );

  // Find the D/V that minimizes WACC
  const optimal = useMemo(() => {
    let best = data[0];
    for (const row of data) if (row.wacc < best.wacc) best = row;
    return best;
  }, [data]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="Unlevered cost of equity" v={s.baseRE} min={0.05} max={0.25} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, baseRE: v }))} />
        <Slider label="Risk-free debt rate" v={s.baseRD} min={0.01} max={0.10} step={0.0025}
          fmt={(v) => (v * 100).toFixed(2) + '%'}
          onChange={(v) => setS((x) => ({ ...x, baseRD: v }))} />
        <Slider label="Corporate tax rate" v={s.tax} min={0} max={0.5} step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, tax: v }))} />
        <Slider label="Distress sensitivity α" v={s.distress} min={0} max={2} step={0.05}
          fmt={(v) => v.toFixed(2)}
          onChange={(v) => setS((x) => ({ ...x, distress: v }))} />
        <div className="self-end text-sm text-ink-muted">
          Optimal D/V ≈ <strong>{(optimal.dv * 100).toFixed(0)}%</strong>,
          min WACC ≈ <strong>{(optimal.wacc * 100).toFixed(2)}%</strong>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="dv" tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{ value: 'D/V (leverage)', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{ value: 'cost of capital', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => (v * 100).toFixed(2) + '%'}
              labelFormatter={(l: number) => `D/V = ${(l * 100).toFixed(0)}%`} />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="re" name="cost of equity rE" stroke="#dc2626" dot={false} />
            <Line type="monotone" dataKey="rd" name="after-tax rD" stroke="#059669" dot={false} />
            <Line type="monotone" dataKey="wacc" name="WACC" stroke="#2563eb" strokeWidth={2} dot={false} />
            <ReferenceDot x={optimal.dv} y={optimal.wacc} r={5} fill="#0f172a" stroke="white" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        With no taxes or distress (MM I), WACC is flat across leverage. Add
        a tax shield (raise tax rate) and WACC slopes down with D/V. Add
        distress costs (raise α) and WACC bends back up — the **trade-off
        theory of capital structure**.
      </p>
    </div>
  );
}

function Slider({
  label, v, min, max, step, fmt, onChange,
}: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; }) {
  return (
    <label className="flex flex-col text-sm">
      <span className="font-medium">
        {label}: <span className="text-accent">{fmt(v)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-48" />
    </label>
  );
}
