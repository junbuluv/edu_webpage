import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { callableBondValue } from '@lib/bonds/callable';
import ChartFrame from './ChartFrame';

// Callable bond = straight bond minus the issuer's call option. Both prices
// come from one binomial rate tree (src/lib/bonds/callable.ts) that reprices
// the straight bond at its flat-yield value, so the gap between the two curves
// is the option. Prices are per 100 of face value.

interface State {
  coupon: number;
  maturity: number; // years
  firstCall: number; // year, always before maturity
  callPrice: number;
  yieldRate: number;
  vol: number; // yearly up/down move of the one-year rate, as a share of its level
}

const baseline: State = {
  coupon: 0.06,
  maturity: 10,
  firstCall: 3,
  callPrice: 102,
  yieldRate: 0.05,
  vol: 0.15,
};

const Y_MIN = 0.01;
const Y_MAX = 0.12;
const Y_STEP = 0.0025;

export default function CallableBondExplorer() {
  const [s, setS] = useState<State>(baseline);

  const bond = useMemo(
    () => ({
      couponRate: s.coupon,
      maturity: s.maturity,
      firstCall: s.firstCall,
      callPrice: s.callPrice,
    }),
    [s.coupon, s.maturity, s.firstCall, s.callPrice],
  );

  const data = useMemo(() => {
    const pts: { y: number; straight: number; callable: number }[] = [];
    for (let i = 0; i <= Math.round((Y_MAX - Y_MIN) / Y_STEP); i += 1) {
      const y = Y_MIN + i * Y_STEP;
      const v = callableBondValue(bond, y, s.vol);
      pts.push({
        y: +(y * 100).toFixed(2),
        straight: +v.straight.toFixed(2),
        callable: +v.callable.toFixed(2),
      });
    }
    return pts;
  }, [bond, s.vol]);

  const now = useMemo(
    () => callableBondValue(bond, s.yieldRate, s.vol),
    [bond, s.yieldRate, s.vol],
  );
  const yieldPct = +(s.yieldRate * 100).toFixed(2);
  // Round the two prices first, so the subtraction in the readout adds up.
  const straight = now.straight.toFixed(2);
  const callable = now.callable.toFixed(2);
  const option = (Number(straight) - Number(callable)).toFixed(2);

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider
          label="Coupon rate"
          v={s.coupon}
          min={0.02}
          max={0.1}
          step={0.0025}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, coupon: v }))}
        />
        <Slider
          label="Maturity"
          v={s.maturity}
          min={2}
          max={20}
          step={1}
          fmt={(v) => `${v} years`}
          onChange={(v) =>
            setS((x) => ({
              ...x,
              maturity: v,
              firstCall: Math.min(x.firstCall, v - 1),
            }))
          }
        />
        <Slider
          label="First call date"
          v={s.firstCall}
          min={1}
          max={s.maturity - 1}
          step={1}
          fmt={(v) => `year ${v}`}
          onChange={(v) => setS((x) => ({ ...x, firstCall: v }))}
        />
        <Slider
          label="Call price"
          v={s.callPrice}
          min={100}
          max={110}
          step={0.5}
          fmt={(v) => v.toFixed(1)}
          onChange={(v) => setS((x) => ({ ...x, callPrice: v }))}
        />
        <Slider
          label="Market yield"
          v={s.yieldRate}
          min={Y_MIN}
          max={Y_MAX}
          step={Y_STEP}
          fmt={pct}
          onChange={(v) => setS((x) => ({ ...x, yieldRate: v }))}
        />
        <Slider
          label="Rate volatility"
          v={s.vol}
          min={0}
          max={0.25}
          step={0.01}
          fmt={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setS((x) => ({ ...x, vol: v }))}
        />
        <button
          type="button"
          onClick={() => setS(baseline)}
          className="self-end rounded border border-slate-300 px-2 py-1 text-sm text-ink-muted hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 text-sm">
        Straight bond <strong>{straight}</strong> − issuer's call option{' '}
        <strong className="text-accent">{option}</strong> = callable bond{' '}
        <strong>{callable}</strong>, per 100 of face value.
      </p>

      <ChartFrame
        description={
          'Bond price per 100 of face value (vertical axis) against the market yield in percent (horizontal axis), for a straight bond and for the same bond when the issuer can call it. A dashed horizontal line marks the call price, and a dot on each curve marks the current yield.'
        }
        summary={`At a ${pct(s.yieldRate)} yield the straight bond is worth ${straight}, the callable bond ${callable}, and the issuer's call option ${option}. The call price is ${s.callPrice.toFixed(1)}.`}
      >
        <div className="mt-3 h-80">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 16, left: 8 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="y"
                type="number"
                domain={[Y_MIN * 100, Y_MAX * 100]}
                tickCount={12}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'market yield',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 12,
                }}
              />
              <YAxis
                domain={['auto', 'auto']}
                width={64}
                label={{
                  value: 'price per 100 face',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 12,
                }}
              />
              <Tooltip
                formatter={(v: number) => v.toFixed(2)}
                labelFormatter={(l: number) => `yield = ${l}%`}
              />
              <Legend verticalAlign="top" height={28} />
              <ReferenceLine
                y={s.callPrice}
                stroke="var(--chart-ref)"
                strokeDasharray="4 4"
                label={{
                  value: 'call price',
                  position: 'insideBottomRight',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="straight"
                name="straight bond"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="callable"
                name="callable bond"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceDot
                x={yieldPct}
                y={now.straight}
                r={5}
                fill="var(--chart-1)"
                stroke="none"
              />
              <ReferenceDot
                x={yieldPct}
                y={now.callable}
                r={5}
                fill="var(--chart-2)"
                stroke="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        The vertical gap between the curves is the value of the issuer's call
        option. Below the coupon rate the callable curve flattens: the issuer
        will refinance, so the investor cannot count on more than the coupons up
        to the first call date plus the call price. Rate volatility is the size
        of each yearly up or down move in the one-year rate, as a share of its
        level. At 0% the callable price is the lower of the price to maturity
        and the price to first call. Coupons are annual and the tree has one
        step per year.
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
