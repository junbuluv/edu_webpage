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
import type { ADASSnapshot } from '@lib/adas/presets';

// Presentational variant of ADASChart: no sliders, no internal state.
// Designed for compare mode (pinned snapshot side-by-side with live).

interface Props {
  state: ADASSnapshot;
}

const params = { a: 800, b: 40, g: 1.5, m: 0.4, c: 0.05 };

function solve(s: ADASSnapshot) {
  const { a, b, g, m, c } = params;
  const P = (c * a + c * g * s.G + c * m * s.M + s.Pe - c * s.Yn) / (1 + c * b);
  const Y = a - b * P + g * s.G + m * s.M;
  return { Y, P };
}

function buildSeries(s: ADASSnapshot) {
  const { a, b, g, m, c } = params;
  const Ys = Array.from({ length: 41 }, (_, i) => 600 + i * 20);
  return Ys.map((Y) => ({
    Y,
    AD: (a - Y + g * s.G + m * s.M) / b,
    SRAS: s.Pe + c * (Y - s.Yn),
  }));
}

export default function ADASScenarioView({ state }: Props) {
  const data = useMemo(() => buildSeries(state), [state]);
  const eq = useMemo(() => solve(state), [state]);

  return (
    <div>
      <div className="text-sm text-ink-muted">
        Equilibrium: <strong>Y* = {eq.Y.toFixed(0)}</strong>,{' '}
        <strong>P* = {eq.P.toFixed(2)}</strong>
      </div>
      <div className="mt-2 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="Y"
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Output (Y)',
                position: 'insideBottom',
                offset: -4,
                fontSize: 11,
              }}
            />
            <YAxis
              label={{
                value: 'Price level (P)',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
              }}
            />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Legend verticalAlign="top" height={24} />
            <Line
              type="monotone"
              dataKey="AD"
              name="AD"
              stroke="#2563eb"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="SRAS"
              name="SRAS"
              stroke="#dc2626"
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={eq.Y}
              y={eq.P}
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
