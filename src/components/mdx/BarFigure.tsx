import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { resolveSeriesColor } from '@lib/chart/series-color';

interface Series {
  key: string;
  name: string;
  /** A theme slot ('chart-1' to 'chart-4') or a hex color. Defaults to the series' slot. */
  color?: string;
}

interface Props {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: Series[];
  yAxisLabel?: string;
  caption?: string;
  credit?: string;
  creditHref?: string;
  maxWidth?: 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl';
  /** Height in pixels for the chart area. Default 360. */
  height?: number;
}

export default function BarFigure({
  data,
  xKey,
  series,
  yAxisLabel,
  caption,
  credit,
  creditHref,
  maxWidth = 'max-w-2xl',
  height = 360,
}: Props) {
  return (
    <figure className={`mx-auto my-8 ${maxWidth}`}>
      <div
        className="rounded border border-slate-200 bg-white p-3"
        style={{ width: '100%', height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey={xKey} fontSize={11} />
            <YAxis
              fontSize={11}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 11,
                    }
                  : undefined
              }
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={resolveSeriesColor(s.color, i)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(caption || credit) && (
        <figcaption className="mt-2 text-xs text-ink-muted">
          {caption && <span className="block">{caption}</span>}
          {credit && (
            <span className="mt-1 block italic">
              Source:{' '}
              {creditHref ? (
                <a
                  href={creditHref}
                  className="underline"
                  rel="noopener"
                  target="_blank"
                >
                  {credit}
                </a>
              ) : (
                credit
              )}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
