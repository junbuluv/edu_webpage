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
import {
  loanableFundsEquilibrium,
  loanableFundsRateDomain,
} from '@lib/viz/model-math';

// Loanable funds market:
//   Demand for loanable funds (investment): I(r) = I0 - bI * r
//   Supply of loanable funds (private saving + government surplus):
//     S(r) = S0 + bS * r - deficit
// Equilibrium real interest rate r* clears S(r) = I(r).
// A larger deficit shifts S left, raising r* and lowering I* (crowding out).

interface State {
  deficit: number; // government budget deficit (positive = deficit)
  privSavingRate: number; // shifts private saving up if higher
  expReturn: number; // shifts investment demand up if higher
}

const baseline: State = { deficit: 0, privSavingRate: 1.0, expReturn: 1.0 };

const params = {
  I0_base: 1200,
  S0_base: 1000,
  bI: 30, // slope of I curve
  bS: 25, // slope of S curve
};

function solve(s: State) {
  const I0 = params.I0_base * s.expReturn;
  const S0 = params.S0_base * s.privSavingRate;
  const result = loanableFundsEquilibrium(
    I0,
    S0,
    params.bI,
    params.bS,
    s.deficit,
  );
  return { rStar: result.realRate, iStar: result.quantity, I0, S0 };
}

function buildSeries(s: State, rateMinimum: number, rateMaximum: number) {
  const I0 = params.I0_base * s.expReturn;
  const S0 = params.S0_base * s.privSavingRate;
  return Array.from({ length: 61 }, (_, i) => {
    const r = rateMinimum + (i / 60) * (rateMaximum - rateMinimum);
    return {
      r,
      I: I0 - params.bI * r,
      S: S0 + params.bS * r - s.deficit,
      Sprivate: S0 + params.bS * r,
    };
  });
}

export default function LoanableFunds() {
  const [s, setS] = useState<State>(baseline);
  const eq = useMemo(() => solve(s), [s]);
  const rateDomain = useMemo(
    () =>
      loanableFundsRateDomain(
        eq.I0,
        eq.S0,
        params.bI,
        params.bS,
        s.deficit,
        eq.rStar,
      ),
    [eq, s.deficit],
  );
  const data = useMemo(
    () => buildSeries(s, rateDomain.minimum, rateDomain.maximum),
    [s, rateDomain],
  );
  const noDeficitEq = useMemo(() => solve({ ...s, deficit: 0 }), [s]);
  const crowdOut = noDeficitEq.iStar - eq.iStar;
  const quantityDomain = useMemo(() => {
    const quantities = data.flatMap((row) => [row.I, row.S, row.Sprivate]);
    const minimum = Math.min(eq.iStar, ...quantities);
    const maximum = Math.max(eq.iStar, ...quantities);
    const padding = Math.max(25, (maximum - minimum) * 0.05);
    return [Math.max(0, minimum - padding), maximum + padding] as [
      number,
      number,
    ];
  }, [data, eq.iStar]);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Govt budget deficit"
          v={s.deficit}
          min={-300}
          max={500}
          step={10}
          fmt={(v) => `$${v.toFixed(0)}B`}
          onChange={(v) => setS((x) => ({ ...x, deficit: v }))}
        />
        <Slider
          label="Private saving multiplier"
          v={s.privSavingRate}
          min={0.5}
          max={1.5}
          step={0.05}
          fmt={(v) => v.toFixed(2) + 'x'}
          onChange={(v) => setS((x) => ({ ...x, privSavingRate: v }))}
        />
        <Slider
          label="Expected return on capital"
          v={s.expReturn}
          min={0.5}
          max={1.5}
          step={0.05}
          fmt={(v) => v.toFixed(2) + 'x'}
          onChange={(v) => setS((x) => ({ ...x, expReturn: v }))}
        />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end text-sm text-ink-muted underline"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 text-sm text-ink-muted">
        Equilibrium: r* = <strong>{eq.rStar.toFixed(2)}%</strong>, Investment I*
        = <strong>${eq.iStar.toFixed(0)}B</strong>
        {Math.abs(crowdOut) > 1 && (
          <>
            ,{' '}
            <span
              className={crowdOut > 0 ? 'text-rose-700' : 'text-emerald-700'}
            >
              deficit effect on investment: ${crowdOut.toFixed(0)}B
            </span>
          </>
        )}
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="I"
              type="number"
              domain={quantityDomain}
              tickFormatter={(v) => `$${v.toFixed(0)}B`}
              label={{
                value: 'Loanable funds quantity',
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
              }}
            />
            <YAxis
              dataKey="r"
              type="number"
              domain={[rateDomain.minimum, rateDomain.maximum]}
              label={{
                value: 'Real interest rate r (%)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Legend verticalAlign="top" height={24} />
            <Line
              type="monotone"
              data={data}
              dataKey="r"
              name="Demand (Investment)"
              stroke="#dc2626"
              dot={false}
            />
            <Line
              type="monotone"
              data={data.map((d) => ({ ...d, I: d.S }))}
              dataKey="r"
              name="Supply (Saving - Deficit)"
              stroke="#2563eb"
              dot={false}
            />
            {s.deficit !== 0 && (
              <Line
                type="monotone"
                data={data.map((d) => ({ ...d, I: d.Sprivate }))}
                dataKey="r"
                name="Private saving alone"
                stroke="#94a3b8"
                strokeDasharray="4 4"
                dot={false}
              />
            )}
            <ReferenceDot
              x={eq.iStar}
              y={eq.rStar}
              r={5}
              fill="#0f172a"
              stroke="white"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Current parameters: deficit = ${s.deficit.toFixed(0)}B, private-saving
        multiplier = {s.privSavingRate.toFixed(2)}x, and investment-demand
        multiplier = {s.expReturn.toFixed(2)}x. The calibrated slopes are bI ={' '}
        {params.bI} and bS = {params.bS} billion dollars per percentage point.
        The axes expand to include the clearing rate, including a negative real
        rate when strong saving or a surplus requires one. A government budget
        deficit (positive value) means the government is borrowing from the same
        pool of saving that firms use to invest. That shifts the supply of
        loanable funds left, raises the real rate, and reduces equilibrium
        investment — <strong>crowding out</strong>.
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
