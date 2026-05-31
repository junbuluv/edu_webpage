import { useMemo } from 'react';
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
import type { BondSnapshot } from '@lib/bonds/presets';

// Presentational variant of BondPriceYield: no sliders, no internal
// state. Used in compare mode (pinned snapshot vs live bond).

interface Props {
  state: BondSnapshot;
}

function price(s: BondSnapshot, y: number) {
  const c = s.zero ? 0 : s.coupon * s.face;
  let p = 0;
  for (let t = 1; t <= s.maturity; t++) p += c / Math.pow(1 + y, t);
  p += s.face / Math.pow(1 + y, s.maturity);
  return p;
}

function duration(s: BondSnapshot, y: number) {
  const c = s.zero ? 0 : s.coupon * s.face;
  let weighted = 0;
  let p = 0;
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

export default function BondScenarioView({ state }: Props) {
  const data = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => {
        const y = i * 0.005;
        return { y, p: price(state, y) };
      }),
    [state],
  );
  const currentP = price(state, state.yieldRate);
  const { macaulay, modified } = duration(state, state.yieldRate);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Price" value={`$${currentP.toFixed(2)}`} />
        <Stat label="Macaulay D" value={macaulay.toFixed(2)} />
        <Stat label="Modified D" value={modified.toFixed(2)} />
      </div>
      <div className="mt-2 h-64">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="y"
              tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{
                value: 'YTM',
                position: 'insideBottom',
                offset: -4,
                fontSize: 11,
              }}
            />
            <YAxis
              label={{
                value: 'price ($)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(v: number) => `$${v.toFixed(2)}`}
              labelFormatter={(l: number) => `y = ${(l * 100).toFixed(1)}%`}
            />
            <Legend verticalAlign="top" height={24} />
            <Line
              type="monotone"
              dataKey="p"
              name="Price(y)"
              stroke="#2563eb"
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={state.yieldRate}
              y={currentP}
              r={5}
              fill="#0f172a"
              stroke="white"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
