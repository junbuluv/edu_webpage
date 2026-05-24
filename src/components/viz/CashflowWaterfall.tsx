import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Project FCF waterfall:
//   Revenue       = R0 * (1+gR)^(t-1)
//   COGS          = Revenue * (1 - margin)
//   EBITDA        = Revenue - COGS = Revenue * margin
//   D&A           = capex0 / horizon (straight-line)
//   EBIT          = EBITDA - D&A
//   Tax           = EBIT * tax
//   NOPAT         = EBIT - Tax
//   ΔWC           = wcRate * (Revenue - prev Revenue)
//   CapEx         = capex0 (year 1 only) + maintCapex
//   FCF           = NOPAT + D&A - ΔWC - CapEx

interface State {
  revenue0: number;
  growth: number;
  margin: number;
  tax: number;
  wcRate: number;
  capex0: number;
  maintCapex: number;
  horizon: number;
  discount: number;
}

const baseline: State = {
  revenue0: 1000,
  growth: 0.05,
  margin: 0.30,
  tax: 0.25,
  wcRate: 0.10,
  capex0: 800,
  maintCapex: 50,
  horizon: 8,
  discount: 0.10,
};

function compute(s: State) {
  const rows: Array<{
    t: number;
    revenue: number;
    cogs: number;
    da: number;
    ebit: number;
    taxAmt: number;
    nopat: number;
    dWC: number;
    capex: number;
    fcf: number;
    pv: number;
    cumNPV: number;
    dWCNeg: number;
    capexNeg: number;
  }> = [];
  let prevRev = s.revenue0;
  let cum = 0;
  for (let t = 1; t <= s.horizon; t++) {
    const revenue = s.revenue0 * Math.pow(1 + s.growth, t - 1);
    const cogs = revenue * (1 - s.margin);
    const da = s.capex0 / s.horizon;
    const ebitda = revenue - cogs;
    const ebit = ebitda - da;
    const taxAmt = Math.max(0, ebit * s.tax);
    const nopat = ebit - taxAmt;
    const dWC = s.wcRate * (revenue - prevRev);
    const capex = (t === 1 ? s.capex0 : 0) + s.maintCapex;
    const fcf = nopat + da - dWC - capex;
    const pv = fcf / Math.pow(1 + s.discount, t);
    cum += pv;
    rows.push({
      t,
      revenue,
      cogs,
      da,
      ebit,
      taxAmt,
      nopat,
      dWC,
      capex,
      fcf,
      pv,
      cumNPV: cum,
      // Negated signed values so the stacked bar visually shows
      // additions above zero and subtractions below.
      dWCNeg: -dWC,
      capexNeg: -capex,
    });
    prevRev = revenue;
  }
  return rows;
}

export default function CashflowWaterfall() {
  const [s, setS] = useState<State>(baseline);
  const rows = useMemo(() => compute(s), [s]);
  const npv = rows[rows.length - 1].cumNPV;

  return (
    <div className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap gap-6">
        <Slider label="Year-1 revenue" v={s.revenue0} min={100} max={5000} step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, revenue0: v }))} />
        <Slider label="Revenue growth" v={s.growth} min={-0.05} max={0.20} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, growth: v }))} />
        <Slider label="Gross margin" v={s.margin} min={0.05} max={0.70} step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, margin: v }))} />
        <Slider label="Tax rate" v={s.tax} min={0} max={0.5} step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, tax: v }))} />
        <Slider label="Working capital / sales" v={s.wcRate} min={0} max={0.30} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, wcRate: v }))} />
        <Slider label="Initial CapEx" v={s.capex0} min={0} max={3000} step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, capex0: v }))} />
        <Slider label="Discount rate" v={s.discount} min={0.03} max={0.25} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, discount: v }))} />
        <Slider label="Horizon" v={s.horizon} min={3} max={15} step={1}
          fmt={(v) => `${v.toFixed(0)} yrs`}
          onChange={(v) => setS((x) => ({ ...x, horizon: v }))} />
        <div className="self-end text-sm text-ink-muted">
          NPV = <strong className={npv >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            ${npv.toFixed(0)}
          </strong>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">FCF by year (additions above zero, subtractions below)</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={rows} stackOffset="sign">
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="t" label={{ value: 'year', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
              <Legend verticalAlign="top" height={24} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="nopat" name="NOPAT" stackId="a" fill="#059669" />
              <Bar dataKey="da" name="+ D&A" stackId="a" fill="#10b981" />
              <Bar dataKey="dWCNeg" name="− ΔWC" stackId="a" fill="#f97316" />
              <Bar dataKey="capexNeg" name="− CapEx" stackId="a" fill="#dc2626" />
              <Line type="monotone" dataKey="fcf" name="FCF" stroke="#0f172a" strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Cumulative NPV</h4>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="t" label={{ value: 'year', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" dataKey="cumNPV" name="cumulative NPV" stroke="#2563eb" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
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
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-40" />
    </label>
  );
}
