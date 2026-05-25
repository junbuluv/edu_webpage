import { useMemo, useState } from 'react';
import { useAnimatedValue } from '@lib/animation/useAnimatedValue';
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

// Bond pricing: P = sum_{t=1..N} C/(1+y)^t + F/(1+y)^N
// Macaulay duration (continuous-ish proxy):
//   D = (1/P) * sum_{t} t*C/(1+y)^t + N*F/(1+y)^N
// Modified duration = D / (1+y)

interface State {
  coupon: number;   // annual coupon rate
  face: number;     // face value
  maturity: number; // years
  yieldRate: number;
  zero: boolean;    // zero-coupon bond toggle
}

const baseline: State = {
  coupon: 0.05,
  face: 1000,
  maturity: 10,
  yieldRate: 0.05,
  zero: false,
};

function price(s: State, y: number) {
  const c = s.zero ? 0 : s.coupon * s.face;
  let p = 0;
  for (let t = 1; t <= s.maturity; t++) p += c / Math.pow(1 + y, t);
  p += s.face / Math.pow(1 + y, s.maturity);
  return p;
}

function duration(s: State, y: number) {
  const c = s.zero ? 0 : s.coupon * s.face;
  let weighted = 0,
    p = 0;
  for (let t = 1; t <= s.maturity; t++) {
    const pv = c / Math.pow(1 + y, t);
    p += pv;
    weighted += t * pv;
  }
  const fvPV = s.face / Math.pow(1 + y, s.maturity);
  p += fvPV;
  weighted += s.maturity * fvPV;
  return { macaulay: weighted / p, modified: weighted / p / (1 + y) };
}

export default function BondPriceYield() {
  const [s, setS] = useState<State>(baseline);
  // Tween numeric values for smooth transitions. maturity stays snapped
  // because the pricing loop bounds it as an integer.
  const coupon = useAnimatedValue(s.coupon, { durationMs: 200 });
  const face = useAnimatedValue(s.face, { durationMs: 200 });
  const yieldRate = useAnimatedValue(s.yieldRate, { durationMs: 200 });
  const animated: State = {
    coupon,
    face,
    maturity: s.maturity,
    yieldRate,
    zero: s.zero,
  };
  const data = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => {
        const y = i * 0.005;
        return { y, p: price(animated, y) };
      }),
    [coupon, face, s.maturity, yieldRate, s.zero],
  );
  const currentP = useMemo(
    () => price(animated, yieldRate),
    [coupon, face, s.maturity, yieldRate, s.zero],
  );
  const { macaulay, modified } = useMemo(
    () => duration(animated, yieldRate),
    [coupon, face, s.maturity, yieldRate, s.zero],
  );

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <Slider label="Coupon rate" v={s.coupon} min={0} max={0.15} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          disabled={s.zero}
          onChange={(v) => setS((x) => ({ ...x, coupon: v }))} />
        <Slider label="Face value" v={s.face} min={100} max={5000} step={50}
          fmt={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => setS((x) => ({ ...x, face: v }))} />
        <Slider label="Maturity (years)" v={s.maturity} min={1} max={30} step={1}
          fmt={(v) => v.toFixed(0)}
          onChange={(v) => setS((x) => ({ ...x, maturity: v }))} />
        <Slider label="YTM y" v={s.yieldRate} min={0.005} max={0.20} step={0.005}
          fmt={(v) => (v * 100).toFixed(1) + '%'}
          onChange={(v) => setS((x) => ({ ...x, yieldRate: v }))} />
        <label className="self-end text-sm">
          <input type="checkbox" checked={s.zero}
            onChange={(e) => setS((x) => ({ ...x, zero: e.target.checked }))} />
          <span className="ml-1">Zero-coupon bond</span>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <Stat label="Price" value={`$${currentP.toFixed(2)}`} />
        <Stat label="Macaulay duration" value={macaulay.toFixed(2)} />
        <Stat label="Modified duration" value={modified.toFixed(2)} />
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="y" tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{ value: 'yield to maturity', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis
              label={{ value: 'price ($)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`}
              labelFormatter={(l: number) => `y = ${(l * 100).toFixed(1)}%`} />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="p" name="Price(y)" stroke="#2563eb" dot={false} />
            <ReferenceDot x={s.yieldRate} y={currentP} r={5} fill="#0f172a" stroke="white" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Price-yield curve is convex (longer maturity ⇒ more convex). For a
        small yield change Δy, price changes by approximately
        <code> −D_modified · P · Δy</code>. Try lengthening maturity and
        watch the curve steepen — that's interest-rate risk.
      </p>
    </div>
  );
}

function Slider({
  label, v, min, max, step, fmt, onChange, disabled,
}: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; disabled?: boolean; }) {
  return (
    <label className={`flex flex-col text-sm ${disabled ? 'opacity-40' : ''}`}>
      <span className="font-medium">
        {label}: <span className="text-accent">{fmt(v)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-44" />
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
