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

// PV of the four repeating cash-flow streams from Berk & DeMarzo Ch 4.
// The chart plots PV against the discount rate r so students can see the
// claim the prose only states: long-duration streams are extremely sensitive
// to r (a $1,000 perpetuity is worth $20,000 at 5% and $40,000 at 2.5%).
// Growing streams require r > g; the curve blows up as r approaches g.

type Stream = 'perpetuity' | 'growing-perp' | 'annuity' | 'growing-annuity';

interface State {
  type: Stream;
  C: number; // payment
  r: number; // discount rate
  g: number; // growth (growing streams only)
  T: number; // periods (annuity streams only)
}

const baseline: State = { type: 'perpetuity', C: 1000, r: 0.05, g: 0.02, T: 10 };

const LABELS: Record<Stream, string> = {
  perpetuity: 'Perpetuity  C / r',
  'growing-perp': 'Growing perpetuity  C / (r − g)',
  annuity: 'Annuity  C·[1 − (1+r)⁻ᵀ] / r',
  'growing-annuity': 'Growing annuity  (C/(r−g))·[1 − ((1+g)/(1+r))ᵀ]',
};

const isGrowing = (t: Stream) => t === 'growing-perp' || t === 'growing-annuity';
const isFinite_ = (t: Stream) => t === 'annuity' || t === 'growing-annuity';

function pv(type: Stream, C: number, r: number, g: number, T: number): number {
  switch (type) {
    case 'perpetuity':
      return C / r;
    case 'growing-perp':
      return r > g ? C / (r - g) : NaN;
    case 'annuity':
      return (C * (1 - Math.pow(1 + r, -T))) / r;
    case 'growing-annuity':
      if (Math.abs(r - g) < 1e-9) return (C * T) / (1 + r);
      return (C / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), T));
  }
}

export default function AnnuityExplorer() {
  const [s, setS] = useState<State>(baseline);

  const rMin = isGrowing(s.type) ? s.g + 0.005 : 0.01;

  const data = useMemo(() => {
    const pts: { r: number; pv: number }[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const r = rMin + (0.16 - rMin) * (i / 60);
      const v = pv(s.type, s.C, r, s.g, s.T);
      if (Number.isFinite(v) && v >= 0) pts.push({ r: +(r * 100).toFixed(2), pv: Math.round(v) });
    }
    return pts;
  }, [s]);

  const current = pv(s.type, s.C, s.r, s.g, s.T);
  const currentValid = Number.isFinite(current) && current >= 0;

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Stream[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setS((x) => ({ ...x, type: t }))}
            className={
              'rounded border px-2.5 py-1 text-sm ' +
              (s.type === t
                ? 'border-accent bg-accent/10 font-medium text-accent'
                : 'border-slate-300 text-ink-muted hover:bg-slate-50')
            }
          >
            {LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        <Slider label="Payment C" v={s.C} min={100} max={5000} step={100} fmt={(v) => '$' + v.toLocaleString()} onChange={(v) => setS((x) => ({ ...x, C: v }))} />
        <Slider label="Discount rate r" v={s.r} min={0.01} max={0.15} step={0.0025} fmt={pct} onChange={(v) => setS((x) => ({ ...x, r: v }))} />
        {isGrowing(s.type) && (
          <Slider label="Growth g" v={s.g} min={0} max={0.1} step={0.0025} fmt={pct} onChange={(v) => setS((x) => ({ ...x, g: v }))} />
        )}
        {isFinite_(s.type) && (
          <Slider label="Periods T" v={s.T} min={1} max={40} step={1} fmt={(v) => v + ' yr'} onChange={(v) => setS((x) => ({ ...x, T: v }))} />
        )}
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 text-sm">
        Present value at r = {pct(s.r)}:{' '}
        <strong className="text-accent">
          {currentValid ? '$' + Math.round(current).toLocaleString() : 'undefined (needs r > g)'}
        </strong>
        {isGrowing(s.type) && currentValid && (
          <span className="text-ink-muted">, driven by the gap r − g = {pct(s.r - s.g)}</span>
        )}
      </p>

      <div className="mt-3 h-72">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="r"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'discount rate r', position: 'insideBottom', offset: -6, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
              width={56}
              label={{ value: 'present value', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(v: number) => '$' + v.toLocaleString()} labelFormatter={(l: number) => `r = ${l}%`} />
            <Line type="monotone" dataKey="pv" name="PV" stroke="#4572a7" strokeWidth={2} dot={false} />
            {currentValid && s.r >= rMin && (
              <ReferenceDot x={+(s.r * 100).toFixed(2)} y={Math.round(current)} r={5} fill="#dc2626" stroke="none" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        The red dot is your chosen r. Drag r left and watch PV climb steeply:
        halving the rate roughly doubles the value of a perpetual stream. For
        growing streams the curve diverges as r approaches g, which is why the r
        − g gap dominates a Gordon-model valuation.
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
