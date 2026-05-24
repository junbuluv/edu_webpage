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

// Mankiw-style small open economy:
//   S - I = NX  (net capital outflow = net exports)
//   NX is a downward-sloping function of the real exchange rate ε:
//       NX(ε) = NX0 - bNX * ε
//   Capital outflow (S - I) is given (set by the loanable-funds market).
// Equilibrium ε* clears NX(ε) = S - I.
//
// Sliders:
//   - World interest rate r_world (shifts I)
//   - Domestic saving rate (shifts S)
//   - Tariff wedge (shifts NX0 right — protectionism raises NX at any ε)

interface State {
  rWorld: number;
  savingRate: number;
  tariff: number;
}

const baseline: State = { rWorld: 5, savingRate: 1.0, tariff: 0 };

// Calibrated so the baseline equilibrium ε lies near 1.1 (chart domain
// 0.5–2.5). With baseline (rWorld=5, savingRate=1, tariff=0):
//   S = S0 + bS_r·5 = 1500 + 100 = 1600
//   I = I0 − bI_r·5 = 1700 − 200 = 1500
//   capOutflow = S − I = 100
//   NX0 − bNX·ε = capOutflow  ⇒  ε = (900−100)/700 ≈ 1.14
const params = {
  S0: 1500,
  bS_r: 20,
  I0: 1700,
  bI_r: 40,
  NX0_base: 900,
  bNX: 700,
};

function computeFlows(s: State) {
  const S = params.S0 * s.savingRate + params.bS_r * s.rWorld;
  const I = params.I0 - params.bI_r * s.rWorld;
  return { S, I, capOutflow: S - I };
}

function equilibriumFX(s: State, capOutflow: number) {
  const NX0 = params.NX0_base + s.tariff;
  // NX(ε) = NX0 - bNX*ε = capOutflow
  // ε = (NX0 - capOutflow) / bNX
  return (NX0 - capOutflow) / params.bNX;
}

function buildSeries(s: State, epsStar: number) {
  const NX0 = params.NX0_base + s.tariff;
  // Build the line over a domain that always includes the current
  // equilibrium with some margin on both sides.
  const lo = Math.min(0.2, epsStar - 0.5);
  const hi = Math.max(2.5, epsStar + 0.5);
  const step = (hi - lo) / 40;
  return Array.from({ length: 41 }, (_, i) => {
    const eps = lo + i * step;
    return { eps, NX: NX0 - params.bNX * eps };
  });
}

export default function OpenEconomyFX() {
  const [s, setS] = useState<State>(baseline);
  const flows = useMemo(() => computeFlows(s), [s]);
  const epsStar = useMemo(() => equilibriumFX(s, flows.capOutflow), [s, flows]);
  const data = useMemo(() => buildSeries(s, epsStar), [s, epsStar]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="World real rate r*" v={s.rWorld} min={0} max={12} step={0.25}
          fmt={(v) => v.toFixed(2) + '%'}
          onChange={(v) => setS((x) => ({ ...x, rWorld: v }))} />
        <Slider label="Domestic saving multiplier" v={s.savingRate} min={0.5} max={1.5} step={0.05}
          fmt={(v) => v.toFixed(2) + 'x'}
          onChange={(v) => setS((x) => ({ ...x, savingRate: v }))} />
        <Slider label="Tariff/protection wedge" v={s.tariff} min={-200} max={500} step={10}
          fmt={(v) => `$${v.toFixed(0)}B`}
          onChange={(v) => setS((x) => ({ ...x, tariff: v }))} />
        <button onClick={() => setS(baseline)} className="self-end text-sm text-ink-muted underline">Reset</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Stat label="Saving S" value={`$${flows.S.toFixed(0)}B`} />
        <Stat label="Investment I" value={`$${flows.I.toFixed(0)}B`} />
        <Stat label="Net capital outflow (S − I)" value={`$${flows.capOutflow.toFixed(0)}B`} />
        <Stat label="Real exchange rate ε*" value={epsStar.toFixed(2)} />
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="eps" tickFormatter={(v) => v.toFixed(1)}
              label={{ value: 'Real exchange rate ε', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis
              label={{ value: 'Net exports NX', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(0)}B`}
              labelFormatter={(l: number) => `ε = ${l.toFixed(2)}`} />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="NX" name="NX(ε)" stroke="#2563eb" dot={false} />
            <ReferenceDot x={epsStar} y={flows.capOutflow} r={5} fill="#0f172a" stroke="white" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        A small open economy takes the world real rate as given. Higher
        domestic saving raises S − I (more capital flowing abroad), which
        requires a weaker domestic currency (lower ε) to generate the
        offsetting trade surplus. Tariffs shift the NX curve right but
        don't change the equilibrium quantity of NX — they just appreciate
        the currency. Trade balance is set by saving-investment, not by
        protection.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 px-3 py-2">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
