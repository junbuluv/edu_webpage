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
import ChartFrame from './ChartFrame';

// Presentational variant of ISLMChart: no sliders, no internal state.
// Designed to be driven by ScenarioPlayer (or any parent that wants
// to animate IS-LM curves between named stages).

interface State {
  G: number;
  M: number;
  A0: number;
}

interface Props {
  state: State;
}

const params = { c: 0.6, t: 0.2, b: 20, k: 0.5, h: 10, P: 1 };

function solve(s: State) {
  const { c, t, b, k, h, P } = params;
  const alpha = 1 / (1 - c * (1 - t));
  const A = s.A0 + s.G;
  const Yeq = (A * alpha * h + alpha * b * (s.M / P)) / (h + alpha * b * k);
  const req = (k * Yeq - s.M / P) / h;
  return { alpha, A, Yeq, req };
}

function buildSeries(s: State, Yeq: number) {
  const { alpha, A } = solve(s);
  const { b, k, h, P } = params;
  const lo = Math.max(0, Yeq - 200);
  const hi = Yeq + 200;
  const n = 41;
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const Y = lo + i * step;
    return {
      Y,
      rIS: (alpha * A - Y) / (alpha * b),
      rLM: (k * Y - s.M / P) / h,
    };
  });
}

export default function ISLMScenarioView({ state }: Props) {
  const eq = useMemo(() => solve(state), [state]);
  const data = useMemo(() => buildSeries(state, eq.Yeq), [state, eq.Yeq]);

  return (
    <div>
      <div className="text-sm text-ink-muted">
        Equilibrium: <strong>Y* = {eq.Yeq.toFixed(1)}</strong>,{' '}
        <strong>r* = {eq.req.toFixed(2)}%</strong>
      </div>
      <ChartFrame
        description={
          'IS-LM diagram: interest rate r (vertical axis, percent) against output Y (horizontal axis). The IS curve (goods market) slopes down, the LM curve (money market) slopes up, and they cross at equilibrium.'
        }
        summary={`Equilibrium output Y* = ${eq.Yeq.toFixed(1)}, interest rate r* = ${eq.req.toFixed(2)}%.`}
      >
        <div className="mt-2 h-72">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="Y"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => v.toFixed(0)}
                label={{
                  value: 'Output (Y)',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toFixed(0) + '%'}
                label={{
                  value: 'Interest rate (r)',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                }}
              />
              <Tooltip
                formatter={(v: number) => `${v.toFixed(2)}%`}
                labelFormatter={(label: number) => `Y = ${label.toFixed(0)}`}
              />
              <Legend verticalAlign="top" height={28} />
              <Line
                type="linear"
                dataKey="rIS"
                name="IS"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="rLM"
                name="LM"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceDot
                x={eq.Yeq}
                y={eq.req}
                r={5}
                fill="var(--chart-ink)"
                stroke="white"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}
