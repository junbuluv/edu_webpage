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
import { operatingIncome } from '@lib/viz/model-math';

// Project FCF waterfall:
//   Revenue       = R0 * (1+gR)^(t-1)
//   COGS          = Revenue * (1 - gross margin)
//   Cash OpEx     = Revenue * cash OpEx rate
//   EBITDA        = Revenue - COGS - Cash OpEx
//   D&A           = capex0 / horizon (straight-line)
//   EBIT          = EBITDA - D&A
//   Tax           = max(0, EBIT * tax), so current losses create no tax refund
//   NOPAT         = EBIT - Tax
//   t = 0 FCF     = -initial CapEx - initial working capital
//   ΔWC           = wcRate * (Revenue - prior-year Revenue)
//   Operating FCF = NOPAT + D&A - ΔWC - maintenance CapEx
//   Terminal value = FCF_(T+1) / (r - g), with terminal D&A equal to
//                    maintenance CapEx and terminal CapEx grown by (1 + g)
//
// A Gordon terminal value represents a continuing business, so its working
// capital remains invested. A working-capital release belongs only to a
// finite-life project with no going-concern terminal value.

interface State {
  revenue0: number;
  growth: number;
  grossMargin: number;
  cashOpexRate: number;
  tax: number;
  wcRate: number;
  capex0: number;
  maintCapex: number;
  horizon: number;
  discount: number;
  terminalGrowth: number;
}

const baseline: State = {
  revenue0: 1000,
  growth: 0.05,
  grossMargin: 0.3,
  cashOpexRate: 0.12,
  tax: 0.25,
  wcRate: 0.1,
  capex0: 800,
  maintCapex: 100,
  horizon: 8,
  discount: 0.1,
  terminalGrowth: 0.02,
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
    terminalValue: number;
    fcf: number;
    pv: number;
    cumNPV: number;
    dWCNeg: number;
    capexNeg: number;
  }> = [];
  let prevRev = s.revenue0;
  const initialWC = s.wcRate * s.revenue0;
  const initialFcf = -s.capex0 - initialWC;
  let cum = initialFcf;
  rows.push({
    t: 0,
    revenue: 0,
    cogs: 0,
    da: 0,
    ebit: 0,
    taxAmt: 0,
    nopat: 0,
    dWC: initialWC,
    capex: s.capex0,
    terminalValue: 0,
    fcf: initialFcf,
    pv: initialFcf,
    cumNPV: cum,
    dWCNeg: -initialWC,
    capexNeg: -s.capex0,
  });

  for (let t = 1; t <= s.horizon; t++) {
    const revenue = s.revenue0 * Math.pow(1 + s.growth, t - 1);
    const da = s.capex0 / s.horizon;
    const { cogs, ebit } = operatingIncome(
      revenue,
      s.grossMargin,
      s.cashOpexRate,
      da,
    );
    const taxAmt = Math.max(0, ebit * s.tax);
    const nopat = ebit - taxAmt;
    const dWC = t === 1 ? 0 : s.wcRate * (revenue - prevRev);
    const capex = s.maintCapex;
    const operatingFcf = nopat + da - dWC - capex;
    let terminalValue = 0;
    if (t === s.horizon) {
      const revenueNext = revenue * (1 + s.terminalGrowth);
      // Continuing-period D&A equals maintenance CapEx, while terminal CapEx
      // grows with the business. This keeps the terminal asset base intact
      // rather than depreciating the initial project asset forever.
      const terminalDA = s.maintCapex;
      const terminalCapex = s.maintCapex * (1 + s.terminalGrowth);
      const { ebit: terminalEbit } = operatingIncome(
        revenueNext,
        s.grossMargin,
        s.cashOpexRate,
        terminalDA,
      );
      const terminalTax = Math.max(0, terminalEbit * s.tax);
      const terminalNopat = terminalEbit - terminalTax;
      const terminalDWC = s.wcRate * (revenueNext - revenue);
      const terminalFcf =
        terminalNopat + terminalDA - terminalCapex - terminalDWC;
      terminalValue = terminalFcf / (s.discount - s.terminalGrowth);
    }
    const fcf = operatingFcf + terminalValue;
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
      terminalValue,
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
        <Slider
          label="Year-1 revenue"
          v={s.revenue0}
          min={100}
          max={5000}
          step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, revenue0: v }))}
        />
        <Slider
          label="Revenue growth"
          v={s.growth}
          min={-0.05}
          max={0.2}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, growth: v }))}
        />
        <Slider
          label="Gross margin"
          v={s.grossMargin}
          min={0.05}
          max={0.7}
          step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, grossMargin: v }))}
        />
        <Slider
          label="Cash operating expenses / sales"
          v={s.cashOpexRate}
          min={0}
          max={0.4}
          step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, cashOpexRate: v }))}
        />
        <Slider
          label="Tax rate"
          v={s.tax}
          min={0}
          max={0.5}
          step={0.01}
          fmt={(v) => (v * 100).toFixed(0) + '%'}
          onChange={(v) => setS((x) => ({ ...x, tax: v }))}
        />
        <Slider
          label="Working capital / sales"
          v={s.wcRate}
          min={0}
          max={0.3}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, wcRate: v }))}
        />
        <Slider
          label="Initial CapEx"
          v={s.capex0}
          min={0}
          max={3000}
          step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, capex0: v }))}
        />
        <Slider
          label="Maintenance CapEx"
          v={s.maintCapex}
          min={0}
          max={500}
          step={25}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, maintCapex: v }))}
        />
        <Slider
          label="Discount rate"
          v={s.discount}
          min={0.06}
          max={0.25}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, discount: v }))}
        />
        <Slider
          label="Terminal growth"
          v={s.terminalGrowth}
          min={0}
          max={0.04}
          step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, terminalGrowth: v }))}
        />
        <Slider
          label="Horizon"
          v={s.horizon}
          min={3}
          max={15}
          step={1}
          fmt={(v) => `${v.toFixed(0)} yrs`}
          onChange={(v) => setS((x) => ({ ...x, horizon: v }))}
        />
        <button
          type="button"
          onClick={() => setS({ ...baseline })}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
        <div className="self-end text-sm text-ink-muted">
          NPV ={' '}
          <strong className={npv >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            ${npv.toFixed(0)}
          </strong>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">
          Project cash flow and terminal proceeds by year
        </h4>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={rows} stackOffset="sign">
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
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="nopat" name="NOPAT" stackId="a" fill="#059669" />
              <Bar dataKey="da" name="+ D&A" stackId="a" fill="#10b981" />
              <Bar
                dataKey="terminalValue"
                name="Terminal value"
                stackId="a"
                fill="#2563eb"
              />
              <Bar dataKey="dWCNeg" name="− ΔWC" stackId="a" fill="#f97316" />
              <Bar
                dataKey="capexNeg"
                name="− CapEx"
                stackId="a"
                fill="#dc2626"
              />
              <Line
                type="monotone"
                dataKey="fcf"
                name="Total cash flow incl. terminal value"
                stroke="#0f172a"
                strokeWidth={2}
                dot
              />
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
              <Line
                type="monotone"
                dataKey="cumNPV"
                name="cumulative NPV"
                stroke="#2563eb"
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="md:col-span-2 text-xs text-ink-muted">
        Current parameters: year-1 revenue ${s.revenue0.toFixed(0)}, revenue
        growth {(s.growth * 100).toFixed(1)}%, gross margin{' '}
        {(s.grossMargin * 100).toFixed(0)}%, cash operating expenses{' '}
        {(s.cashOpexRate * 100).toFixed(0)}% of sales, tax{' '}
        {(s.tax * 100).toFixed(0)}%, working capital{' '}
        {(s.wcRate * 100).toFixed(1)}% of sales, initial CapEx $
        {s.capex0.toFixed(0)}, maintenance CapEx ${s.maintCapex.toFixed(0)}, T ={' '}
        {s.horizon}, r = {(s.discount * 100).toFixed(1)}%, and terminal g ={' '}
        {(s.terminalGrowth * 100).toFixed(1)}%. Initial CapEx and working
        capital are invested at t = 0. The final year includes a Gordon terminal
        value; because the business continues, working capital is not released.
        Terminal sustaining CapEx grows at g so the fixed-asset base can also
        support continuing growth. Cash flows, r, and g are all stated on the
        same basis, with r &gt; g throughout the slider range.
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
        className="mt-1 w-40"
      />
    </label>
  );
}
