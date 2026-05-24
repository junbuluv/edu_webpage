import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Simple deposit multiplier:  m_simple = 1 / r
// Full money multiplier (Hubbard Ch 14):
//   M = m * MB,  with  m = (1 + C/D) / ((C/D) + (R/D))
// Where:
//   C/D = currency-deposit ratio (public's choice)
//   R/D = reserve-deposit ratio = r_required + r_excess
//   MB  = monetary base = currency + reserves

interface State {
  monetaryBase: number;
  reserveRatio: number;     // R/D
  currencyRatio: number;    // C/D
}

const baseline: State = {
  monetaryBase: 1000,
  reserveRatio: 0.10,
  currencyRatio: 0.30,
};

function multiplier(s: State) {
  return (1 + s.currencyRatio) / (s.currencyRatio + s.reserveRatio);
}

function moneySupply(s: State) {
  return s.monetaryBase * multiplier(s);
}

function decompose(s: State) {
  const M = moneySupply(s);
  const D = M / (1 + s.currencyRatio); // M = C + D, C = (C/D)*D
  const C = s.currencyRatio * D;
  const R = s.reserveRatio * D;
  return { M, C, D, R };
}

export default function MoneyMultiplier() {
  const [state, setState] = useState<State>(baseline);
  const m = useMemo(() => multiplier(state), [state]);
  const { M, C, D, R } = useMemo(() => decompose(state), [state]);

  const chartData = [
    { name: 'Monetary base', currency: state.monetaryBase - R, reserves: R },
    { name: 'Money supply', currency: C, deposits: D },
  ];

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Monetary base (MB)"
          v={state.monetaryBase}
          min={200}
          max={3000}
          step={50}
          fmt={(v) => `$${v.toFixed(0)}B`}
          onChange={(v) => setState((s) => ({ ...s, monetaryBase: v }))}
        />
        <Slider
          label="Reserve ratio (R/D)"
          v={state.reserveRatio}
          min={0.01}
          max={0.5}
          step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setState((s) => ({ ...s, reserveRatio: v }))}
        />
        <Slider
          label="Currency ratio (C/D)"
          v={state.currencyRatio}
          min={0}
          max={1.5}
          step={0.05}
          fmt={(v) => v.toFixed(2)}
          onChange={(v) => setState((s) => ({ ...s, currencyRatio: v }))}
        />
        <button
          onClick={() => setState(baseline)}
          className="self-end text-sm text-ink-muted underline"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Stat label="Multiplier m" value={m.toFixed(2)} />
        <Stat label="Money supply M" value={`$${M.toFixed(0)}B`} />
        <Stat label="Deposits D" value={`$${D.toFixed(0)}B`} />
        <Stat label="Currency C" value={`$${C.toFixed(0)}B`} />
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(v: number) => `$${v.toFixed(0)}B`}
            />
            <Legend />
            <Bar dataKey="currency" name="Currency in circulation" stackId="a" fill="#2563eb" />
            <Bar dataKey="reserves" name="Bank reserves" stackId="a" fill="#dc2626" />
            <Bar dataKey="deposits" name="Checkable deposits" stackId="a" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Money supply <code>M = m · MB</code> where
        <code> m = (1 + C/D) / ((C/D) + (R/D))</code>. As banks hold more
        excess reserves (R/D ↑) or the public holds more cash (C/D ↑), the
        multiplier shrinks. This is why QE's effect on M depends on what
        banks do with the new reserves.
      </p>
    </div>
  );
}

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
        className="mt-1 w-52"
      />
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
