import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// TVM + NPV calculator. CF stream: CF0 (initial outflow, negative) +
// {C_1, C_2, ..., C_T} with growth rate g applied to a base annual cash
// flow. NPV = sum_{t=0..T} CF_t / (1+r)^t.

interface State {
  cf0: number;
  baseCF: number;
  growth: number;
  rate: number;
  horizon: number;
}

const baseline: State = {
  cf0: -1000,
  baseCF: 250,
  growth: 0.03,
  rate: 0.08,
  horizon: 8,
};

function buildCashflows(s: State) {
  const cfs: { t: number; cf: number; pv: number; cumNPV: number }[] = [];
  let cum = s.cf0;
  cfs.push({ t: 0, cf: s.cf0, pv: s.cf0, cumNPV: cum });
  for (let t = 1; t <= s.horizon; t++) {
    const cf = s.baseCF * Math.pow(1 + s.growth, t - 1);
    const pv = cf / Math.pow(1 + s.rate, t);
    cum += pv;
    cfs.push({ t, cf, pv, cumNPV: cum });
  }
  return cfs;
}

function npvAt(s: State, r: number) {
  let v = s.cf0;
  for (let t = 1; t <= s.horizon; t++) {
    const cf = s.baseCF * Math.pow(1 + s.growth, t - 1);
    v += cf / Math.pow(1 + r, t);
  }
  return v;
}

function irr(s: State): number | null {
  // Bisect on r ∈ [-0.99, 5]. NPV typically decreasing in r when CF0<0.
  let lo = -0.99,
    hi = 5;
  let nLo = npvAt(s, lo),
    nHi = npvAt(s, hi);
  if (Number.isNaN(nLo) || Number.isNaN(nHi)) return null;
  if (nLo * nHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const nMid = npvAt(s, mid);
    if (Math.abs(nMid) < 1e-6) return mid;
    if (nLo * nMid < 0) {
      hi = mid;
      nHi = nMid;
    } else {
      lo = mid;
      nLo = nMid;
    }
  }
  return (lo + hi) / 2;
}

export default function TVMNPV() {
  const [s, setS] = useState<State>(baseline);
  const cashflows = useMemo(() => buildCashflows(s), [s]);
  const totalNPV = cashflows[cashflows.length - 1].cumNPV;
  const irrVal = useMemo(() => irr(s), [s]);
  const sensitivity = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => {
        const r = i * 0.01;
        return { r, npv: npvAt(s, r) };
      }),
    [s],
  );

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap gap-6">
        <Slider
          label="Initial outflow CF₀"
          v={s.cf0}
          min={-3000}
          max={0}
          step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, cf0: v }))}
        />
        <Slider
          label="Base annual CF"
          v={s.baseCF}
          min={0}
          max={1000}
          step={10}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, baseCF: v }))}
        />
        <Slider
          label="Growth g"
          v={s.growth}
          min={-0.05}
          max={0.15}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, growth: v }))}
        />
        <Slider
          label="Discount rate r"
          v={s.rate}
          min={0.01}
          max={0.3}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, rate: v }))}
        />
        <Slider
          label="Horizon T (years)"
          v={s.horizon}
          min={1}
          max={20}
          step={1}
          fmt={(v) => v.toFixed(0)}
          onChange={(v) => setS((x) => ({ ...x, horizon: v }))}
        />
        <div className="self-end text-sm text-ink-muted">
          NPV ={' '}
          <strong
            className={totalNPV >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          >
            ${totalNPV.toFixed(0)}
          </strong>
          {irrVal !== null && (
            <>
              , IRR ≈ <strong>{(irrVal * 100).toFixed(1)}%</strong>
            </>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Cashflows by year</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={cashflows}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                label={{
                  value: 'year',
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 11,
                }}
              />
              <YAxis />
              <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
              <Legend verticalAlign="top" height={24} />
              <Bar dataKey="cf" name="Cash flow" fill="#2563eb" />
              <Bar dataKey="pv" name="Discounted" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">
          NPV sensitivity to discount rate
        </h4>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={sensitivity}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="r"
                tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
                label={{
                  value: 'discount rate r',
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 11,
                }}
              />
              <YAxis />
              <Tooltip
                formatter={(v: number) => `$${v.toFixed(0)}`}
                labelFormatter={(l: number) => `r = ${(l * 100).toFixed(1)}%`}
              />
              <ReferenceLine y={0} stroke="#94a3b8" />
              {irrVal !== null && irrVal > 0 && irrVal < 0.5 && (
                <ReferenceLine
                  x={irrVal}
                  stroke="#dc2626"
                  strokeDasharray="3 3"
                  label={{ value: 'IRR', position: 'top', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="npv"
                name="NPV(r)"
                stroke="#2563eb"
                dot={false}
              />
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
