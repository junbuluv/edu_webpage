import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// DuPont decomposition from Berk & DeMarzo Ch 2:
//   ROE = (Net income / Revenue) x (Revenue / Assets) x (Assets / Equity)
//       = net margin       x   asset turnover     x   equity multiplier.
// The archetypes are tuned to the SAME ROE (~18%) through very different lever
// mixes, so the three bars are equal height: the lesson's "same headline
// number, different business" made literal. "Your firm" is the live dashed
// line, not a bar, so the sliders never produce a single tower that drowns the
// comparison. Archetype numbers are illustrative, not reported figures.

interface State {
  margin: number; // net margin
  turnover: number; // asset turnover
  em: number; // equity multiplier (assets / equity)
}

const baseline: State = { margin: 0.08, turnover: 1.25, em: 4 };

// Each multiplies out to ~18.2% ROE by a different route.
const ARCHETYPES: { name: string; s: State }[] = [
  { name: 'Discount retailer', s: { margin: 0.035, turnover: 2.6, em: 2.0 } },
  { name: 'Luxury brand', s: { margin: 0.14, turnover: 0.65, em: 2.0 } },
  { name: 'Bank', s: { margin: 0.27, turnover: 0.05, em: 13.5 } },
];

const roe = (s: State) => s.margin * s.turnover * s.em;

export default function DuPontExplorer() {
  const [s, setS] = useState<State>(baseline);

  const bars = ARCHETYPES.map((a) => ({ name: a.name, roe: +(roe(a.s) * 100).toFixed(1) }));
  const mine = +(roe(s) * 100).toFixed(1);
  const yMax = Math.max(25, Math.ceil((mine + 5) / 5) * 5);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="Net margin" v={s.margin} min={0.01} max={0.3} step={0.005} fmt={pct} onChange={(v) => setS((x) => ({ ...x, margin: v }))} />
        <Slider label="Asset turnover" v={s.turnover} min={0.05} max={3} step={0.05} fmt={(v) => v.toFixed(2) + '×'} onChange={(v) => setS((x) => ({ ...x, turnover: v }))} />
        <Slider label="Equity multiplier" v={s.em} min={1} max={15} step={0.5} fmt={(v) => v.toFixed(1) + '×'} onChange={(v) => setS((x) => ({ ...x, em: v }))} />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="self-center text-xs text-ink-muted">Load archetype:</span>
        {ARCHETYPES.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setS(a.s)}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-ink-muted hover:bg-slate-50"
          >
            {a.name}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm">
        Your firm: ROE = {pct(s.margin)} × {s.turnover.toFixed(2)} × {s.em.toFixed(1)} ={' '}
        <strong className="text-accent">{mine.toFixed(1)}%</strong>
      </p>

      <div className="mt-3 h-72">
        <ResponsiveContainer>
          <BarChart data={bars} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis domain={[0, yMax]} tickFormatter={(v) => `${v}%`} width={44} label={{ value: 'ROE', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <ReferenceLine
              y={mine}
              stroke="#dc2626"
              strokeDasharray="5 4"
              label={{ value: `your firm ${mine.toFixed(1)}%`, position: 'right', fontSize: 11, fill: '#dc2626' }}
            />
            <Bar dataKey="roe" name="ROE" fill="#4572a7">
              <LabelList dataKey="roe" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        The three archetype bars are the same height: each reaches roughly the
        same ROE by a different route. Thin margin and fast turnover for the
        retailer, fat margin and slow turnover for the luxury brand, a thin
        revenue base carried by heavy leverage for the bank. Click each to load
        its mix into the sliders and watch the red "your firm" line drop onto
        the bars. Push the equity multiplier alone and the line rises with no
        improvement in the underlying business: that is leverage flattering ROE.
        Archetype figures are illustrative, not reported.
      </p>
    </div>
  );
}

const pct = (v: number) => (v * 100).toFixed(1) + '%';

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
