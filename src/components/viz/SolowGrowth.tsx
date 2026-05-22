import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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

// Solow with Cobb-Douglas: y = k^alpha
// steady state k* = (s / (n + d))^(1/(1-alpha))

interface State {
  s: number; // savings rate
  n: number; // population growth
  d: number; // depreciation rate
  alpha: number; // capital share
}

const initial: State = { s: 0.25, n: 0.02, d: 0.05, alpha: 0.33 };

function steadyStateK({ s, n, d, alpha }: State) {
  return Math.pow(s / (n + d), 1 / (1 - alpha));
}

function buildCurves({ s, n, d, alpha }: State) {
  const ks = Array.from({ length: 80 }, (_, i) => i * 0.2);
  return ks.map((k) => ({
    k,
    y: Math.pow(k, alpha),
    sy: s * Math.pow(k, alpha),
    breakeven: (n + d) * k,
  }));
}

function simulate({ s, n, d, alpha }: State, T = 80, k0 = 1) {
  let k = k0;
  const path: { t: number; k: number; y: number }[] = [];
  for (let t = 0; t <= T; t++) {
    const y = Math.pow(k, alpha);
    path.push({ t, k, y });
    const dk = s * y - (n + d) * k;
    k = Math.max(0.01, k + dk);
  }
  return path;
}

export default function SolowGrowth() {
  const [state, setState] = useState<State>(initial);
  const curves = useMemo(() => buildCurves(state), [state]);
  const kss = useMemo(() => steadyStateK(state), [state]);
  const path = useMemo(() => simulate(state), [state]);

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap gap-6">
        <Slider label="Savings s" v={state.s} min={0.05} max={0.6} step={0.01}
          onChange={(v) => setState((x) => ({ ...x, s: v }))} fmt={(v) => v.toFixed(2)} />
        <Slider label="Pop. growth n" v={state.n} min={0} max={0.08} step={0.005}
          onChange={(v) => setState((x) => ({ ...x, n: v }))} fmt={(v) => v.toFixed(3)} />
        <Slider label="Depreciation δ" v={state.d} min={0.01} max={0.15} step={0.005}
          onChange={(v) => setState((x) => ({ ...x, d: v }))} fmt={(v) => v.toFixed(3)} />
        <Slider label="Capital share α" v={state.alpha} min={0.1} max={0.6} step={0.01}
          onChange={(v) => setState((x) => ({ ...x, alpha: v }))} fmt={(v) => v.toFixed(2)} />
        <div className="text-sm text-ink-muted self-end">
          Steady-state k* ≈ <strong>{kss.toFixed(2)}</strong>,
          y* ≈ <strong>{Math.pow(kss, state.alpha).toFixed(2)}</strong>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Investment vs break-even</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={curves}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="k" tickFormatter={(v) => v.toFixed(1)}
                label={{ value: 'Capital per worker (k)', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend verticalAlign="top" height={24} />
              <Area type="monotone" dataKey="sy" name="s·f(k)" stroke="#2563eb" fill="#dbeafe" />
              <Line type="monotone" dataKey="breakeven" name="(n+δ)·k" stroke="#dc2626" dot={false} />
              <ReferenceDot x={kss} y={(state.n + state.d) * kss} r={5} fill="#0f172a" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Transition path</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={path}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="t" label={{ value: 'time', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" dataKey="k" name="k(t)" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="y" name="y(t)" stroke="#059669" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
  fmt,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
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
