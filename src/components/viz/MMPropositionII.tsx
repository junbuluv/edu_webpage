import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// MM Proposition II in a perfect market (Berk & DeMarzo Ch 14): no taxes, no
// distress. As leverage D/E rises, the cost of equity rises linearly,
//   r_E = r_U + (D/E)(r_U - r_D),
// but the WACC stays pinned at the unlevered cost of capital r_U. The cheaper
// debt and the costlier equity offset exactly, so total firm value does not
// change with capital structure. The flat WACC line IS the MM result.

interface State {
  rU: number; // unlevered cost of capital
  rD: number; // cost of debt (assumed riskless / flat here)
}

const baseline: State = { rU: 0.12, rD: 0.05 };

export default function MMPropositionII() {
  const [s, setS] = useState<State>(baseline);

  const data = useMemo(() => {
    const pts: { de: number; rE: number; rD: number; wacc: number }[] = [];
    for (let i = 0; i <= 30; i += 1) {
      const de = i / 10; // D/E from 0 to 3
      const rE = s.rU + de * (s.rU - s.rD);
      const dv = de / (1 + de);
      const ev = 1 / (1 + de);
      const wacc = ev * rE + dv * s.rD; // = r_U exactly (no taxes)
      pts.push({
        de: +de.toFixed(2),
        rE: +(rE * 100).toFixed(2),
        rD: +(s.rD * 100).toFixed(2),
        wacc: +(wacc * 100).toFixed(2),
      });
    }
    return pts;
  }, [s]);

  // Reference point at D/E = 1 for the readout.
  const at1 = data[10];

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Unlevered cost of capital r_U"
          v={s.rU}
          min={0.05}
          max={0.18}
          step={0.005}
          fmt={pct}
          // Keep r_U >= r_D so (r_U - r_D) >= 0 and the cost-of-equity line
          // always slopes up with leverage, matching the lesson. Pulling r_U
          // down drags r_D with it.
          onChange={(v) => setS((x) => ({ ...x, rU: v, rD: Math.min(x.rD, v) }))}
        />
        <Slider
          label="Cost of debt r_D"
          v={s.rD}
          min={0.02}
          max={0.1}
          step={0.0025}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, rD: Math.min(v, s.rU) }))}
        />
        <div className="self-end text-sm text-ink-muted">
          At D/E = 1: r_E ≈ <strong>{at1.rE.toFixed(1)}%</strong>, WACC ={' '}
          <strong className="text-emerald-700">{at1.wacc.toFixed(1)}%</strong> (= r_U)
        </div>
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="de"
              label={{ value: 'leverage D/E', position: 'insideBottom', offset: -4, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              domain={[0, 'auto']}
              label={{ value: 'rate (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip
              formatter={(v: number) => `${v.toFixed(1)}%`}
              labelFormatter={(l: number) => `D/E = ${l}`}
            />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="rE" name="Cost of equity r_E" stroke="#dc2626" dot={false} />
            <Line type="monotone" dataKey="wacc" name="WACC (= r_U, flat)" stroke="#059669" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="rD" name="Cost of debt r_D" stroke="#2563eb" strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Raise leverage and the red cost of equity climbs in a straight line, yet
        the green WACC never moves: it stays pinned at r_U. The firm trades
        cheap debt for costlier equity in exactly offsetting amounts, so its
        total value is untouched. That flat green line is Modigliani-Miller.
      </p>
    </div>
  );
}

const pct = (v: number) => (v * 100).toFixed(2) + '%';

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
