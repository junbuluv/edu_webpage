import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import data from '@lib/factors/regressions.json';
import ChartFrame from './ChartFrame';

// Factor regressions on real data (Ken French Data Library, July 1963 on):
//   R_p - R_f = alpha + beta_M (R_m - R_f) + sum_k beta_k F_k + e.
// The numbers come from scripts/factor-regressions.ts, which runs the tested
// OLS in src/lib/factors/ols.ts and writes src/lib/factors/regressions.json.
//
// The scatter shows one dimension of a multi-factor fit: the vertical axis is
// the excess return minus the part the non-market factors explain, so the dots
// scatter around the line alpha + beta_M x under every model. Adding factors
// that matter for a portfolio visibly tightens the cloud (higher R-squared).

type Portfolio = (typeof data.portfolios)[number];
type ModelId = keyof Portfolio['models'];

const PORTFOLIO_LABELS: Record<string, string> = {
  'small-value': 'Small value stocks',
  'small-growth': 'Small growth stocks',
  'big-value': 'Big value stocks',
  'big-growth': 'Big growth stocks',
  utilities: 'Utilities industry',
  'high-tech': 'High-tech industry',
};

const MODEL_LABELS: Record<ModelId, string> = {
  capm: '1-factor (CAPM)',
  ff3: '3-factor',
  ff5: '5-factor',
};

const TERM_LABELS: Record<string, string> = {
  'Mkt-RF': 'Market (Mkt-RF)',
  SMB: 'Size (SMB)',
  HML: 'Value (HML)',
  RMW: 'Profitability (RMW)',
  CMA: 'Investment (CMA)',
};

// Fixed axes for every portfolio and model, so clouds can be compared.
const X_DOMAIN = [-25, 20];
const Y_DOMAIN = [-35, 35];

const [startYear, startMonth] = data.sample.start.split('-').map(Number);
const monthName = (index: number, month: 'short' | 'long') =>
  new Date(Date.UTC(startYear, startMonth - 1 + index)).toLocaleString(
    'en-US',
    { month, year: 'numeric', timeZone: 'UTC' },
  );
const SAMPLE = `${monthName(0, 'long')} to ${monthName(data.sample.months - 1, 'long')}`;

const signed = (v: number, digits: number) =>
  (v < 0 ? '−' : '') + Math.abs(v).toFixed(digits);

interface Point {
  x: number;
  y: number;
  month: string;
}

export default function FactorRegressionExplorer() {
  const [portfolioId, setPortfolioId] = useState(data.portfolios[0].id);
  const [modelId, setModelId] = useState<ModelId>('capm');

  const portfolio =
    data.portfolios.find((p) => p.id === portfolioId) ?? data.portfolios[0];
  const model = data.models.find((m) => m.id === modelId) ?? data.models[0];
  const fit = portfolio.models[modelId];
  const [alpha, beta] = fit.coef;

  const points = useMemo<Point[]>(
    () =>
      fit.y.map((y, i) => ({
        x: model.market[i],
        y,
        month: monthName(i, 'short'),
      })),
    [fit, model],
  );

  const alphaIsSignificant = Math.abs(fit.t[0]) >= 1.96;
  const yLabel =
    modelId === 'capm'
      ? 'portfolio excess return (%)'
      : 'excess return net of other factors (%)';
  const portfolioLabel = PORTFOLIO_LABELS[portfolio.id];

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-6">
        <label className="flex flex-col text-sm">
          <span className="font-medium">Portfolio</span>
          <select
            value={portfolio.id}
            onChange={(e) => setPortfolioId(e.target.value)}
            className="mt-1 max-w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {data.portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {PORTFOLIO_LABELS[p.id]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium">Model</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value as ModelId)}
            className="mt-1 max-w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {data.models.map((m) => (
              <option key={m.id} value={m.id}>
                {MODEL_LABELS[m.id as ModelId]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 max-w-measure text-sm">
        Alpha ={' '}
        <strong className="text-accent">{signed(alpha, 3)}% per month</strong>{' '}
        (about {signed(alpha * 12, 1)}% per year), t = {signed(fit.t[0], 2)}:{' '}
        {alphaIsSignificant
          ? 'statistically different from zero at the 5% level.'
          : 'not statistically different from zero at the 5% level.'}{' '}
        Market beta = <strong>{beta.toFixed(2)}</strong>. R² ={' '}
        <strong>{fit.r2.toFixed(2)}</strong>.
      </p>

      <ChartFrame
        description={`Scatter of monthly returns, ${SAMPLE}. Horizontal axis: market excess return in percent. Vertical axis: the portfolio's excess return in percent, minus the part explained by the model's non-market factors. Each dot is one month. The line is the fitted regression line: its intercept is alpha and its slope is the market beta.`}
        summary={`${portfolioLabel}, ${MODEL_LABELS[modelId]} model: alpha ${signed(alpha, 3)} percent per month with t-statistic ${signed(fit.t[0], 2)}, ${alphaIsSignificant ? 'statistically' : 'not statistically'} different from zero; market beta ${beta.toFixed(2)}; R-squared ${fit.r2.toFixed(2)}.`}
      >
        <div className="mt-3 h-80">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={X_DOMAIN}
                ticks={[-20, -10, 0, 10, 20]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'market excess return (%)',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={Y_DOMAIN}
                ticks={[-30, -20, -10, 0, 10, 20, 30]}
                tickFormatter={(v) => `${v}%`}
                width={72}
                label={{
                  value: yLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                  fontSize: 12,
                }}
              />
              <ZAxis range={[14, 14]} />
              <ReferenceLine x={0} stroke="var(--chart-ref)" />
              <ReferenceLine y={0} stroke="var(--chart-ref)" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={
                  <PointTooltip
                    yName={
                      modelId === 'capm' ? 'Portfolio' : 'Net of other factors'
                    }
                  />
                }
              />
              <Scatter
                data={points}
                fill="var(--chart-1)"
                fillOpacity={0.4}
                isAnimationActive={false}
              />
              <ReferenceLine
                segment={X_DOMAIN.map((x) => ({ x, y: alpha + beta * x }))}
                stroke="var(--chart-2)"
                strokeWidth={2}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* Inside a lesson the .prose table rules add padding and let a wide
          table scroll sideways on a phone. */}
      <div className="mt-4 overflow-x-auto">
        <table className="text-sm tabular-nums">
          <caption className="sr-only">
            Regression output: {portfolioLabel}, {MODEL_LABELS[modelId]} model
          </caption>
          <thead className="text-left text-ink-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Term
              </th>
              <th scope="col" className="text-right font-medium">
                Coefficient
              </th>
              <th scope="col" className="text-right font-medium">
                Std. error
              </th>
              <th scope="col" className="text-right font-medium">
                t-statistic
              </th>
            </tr>
          </thead>
          <tbody>
            {['Alpha (% per month)', ...model.factors].map((term, j) => (
              <tr key={term} className="border-t border-slate-100">
                <th scope="row" className="py-1 text-left font-normal">
                  {TERM_LABELS[term] ?? term}
                </th>
                <td className="text-right">{signed(fit.coef[j], 3)}</td>
                <td className="text-right">{fit.se[j].toFixed(3)}</td>
                <td className="text-right">{signed(fit.t[j], 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 text-ink-muted">
              <td colSpan={4} className="py-1">
                R² = {fit.r2.toFixed(3)}, {data.sample.months} months
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 max-w-measure text-xs text-ink-muted">
        Each dot is one month, {SAMPLE}. The line is the fitted regression line:
        it crosses the vertical axis at alpha and its slope is the market beta.
        Under the 3-factor and 5-factor models the vertical axis is the excess
        return minus the part the other factors explain (each beta times that
        factor&apos;s return), so a tighter cloud means the added factors
        explain more of the portfolio. Returns are value-weighted, in percent
        per month.{' '}
        <span className="italic">
          Source:{' '}
          <a
            href={data.sourceUrl}
            className="underline"
            rel="noopener"
            target="_blank"
          >
            {data.source}
          </a>
          . Data {data.copyright}.
        </span>
      </p>
    </div>
  );
}

// Recharts clones this element and adds `active` and `payload` on hover.
function PointTooltip({
  yName,
  active,
  payload,
}: {
  yName: string;
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-ink">
      <div className="font-medium">{p.month}</div>
      <div>Market: {signed(p.x, 2)}%</div>
      <div>
        {yName}: {signed(p.y, 2)}%
      </div>
    </div>
  );
}
