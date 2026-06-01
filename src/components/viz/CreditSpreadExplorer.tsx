import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Break-even credit spread from Berk & DeMarzo Ch 6: a bond defaulting with
// probability p and recovering fraction delta of face needs a spread of about
// p*(1 - delta) over the risk-free yield just to match the Treasury's expected
// return. The line's slope IS (1 - delta), so lower recovery steepens it.
// Real spreads sit ABOVE this line: investors also demand a risk premium for
// bearing (not merely expecting) the loss.

interface State {
  p: number; // annual default probability
  delta: number; // recovery rate
  yT: number; // risk-free / Treasury yield
}

const baseline: State = { p: 0.015, delta: 0.5, yT: 0.04 };

const spread = (p: number, delta: number) => p * (1 - delta);

export default function CreditSpreadExplorer() {
  const [s, setS] = useState<State>(baseline);

  const data = useMemo(() => {
    const pts: { p: number; bps: number }[] = [];
    for (let i = 0; i <= 50; i += 1) {
      const p = (0.1 * i) / 50; // 0 to 10%
      pts.push({ p: +(p * 100).toFixed(2), bps: Math.round(spread(p, s.delta) * 10000) });
    }
    return pts;
  }, [s.delta]);

  const sp = spread(s.p, s.delta);
  const bps = Math.round(sp * 10000);
  const yCorp = s.yT + sp;

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="Default probability p" v={s.p} min={0} max={0.1} step={0.0025} fmt={pct} onChange={(v) => setS((x) => ({ ...x, p: v }))} />
        <Slider label="Recovery rate δ" v={s.delta} min={0} max={0.9} step={0.05} fmt={pct} onChange={(v) => setS((x) => ({ ...x, delta: v }))} />
        <Slider label="Treasury yield" v={s.yT} min={0.01} max={0.08} step={0.0025} fmt={pct} onChange={(v) => setS((x) => ({ ...x, yT: v }))} />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 text-sm">
        Break-even spread = p(1 − δ) ={' '}
        <strong className="text-accent">{bps} bps</strong>. Fair corporate yield ={' '}
        {pct(s.yT)} + {(sp * 100).toFixed(2)}% ={' '}
        <strong className="text-emerald-700">{pct(yCorp)}</strong>.
      </p>

      <div className="mt-3 h-72">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="p"
              type="number"
              domain={[0, 10]}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'annual default probability p', position: 'insideBottom', offset: -6, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => `${v}`}
              width={48}
              label={{ value: 'spread (bps)', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(v: number) => `${v} bps`} labelFormatter={(l: number) => `p = ${l}%`} />
            <Line type="monotone" dataKey="bps" name="break-even spread" stroke="#aa4643" strokeWidth={2} dot={false} />
            <ReferenceDot x={+(s.p * 100).toFixed(2)} y={bps} r={5} fill="#dc2626" stroke="none" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        The line is the spread that just compensates for expected loss; its slope
        is (1 − δ), so dragging recovery down steepens it. Drag δ to 0 (lose
        everything in default) and the spread equals the default probability
        outright. Actual market spreads trade above this line: that gap is the
        risk premium for bearing default risk, not just expecting it. The
        Treasury-yield slider moves only the fair corporate yield in the readout
        (corporate = Treasury + spread); the spread curve is independent of the
        risk-free level.
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
        className="mt-1 w-44"
      />
    </label>
  );
}
