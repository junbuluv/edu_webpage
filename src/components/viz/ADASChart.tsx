import { useEffect, useMemo, useState } from 'react';
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
import { motion, type PanInfo } from 'motion/react';
import { useAnimatedValue } from '@lib/animation/useAnimatedValue';
import ADASScenarioView from '@components/viz/ADASScenarioView';
import CompareScenarios from '@components/mdx/CompareScenarios';
import {
  ADAS_BASELINE,
  ADAS_PRESETS,
  type ADASSnapshot,
} from '@lib/adas/presets';
import {
  readADASFromURL,
  shareableURL,
  writeADASToURL,
} from '@lib/adas/url-state';

// Short-run AD-AS in (Y, P).
//   AD:   Y = a - b*P + g*G + m*M
//   SRAS: P = Pe + c*(Y - Yn)

type State = ADASSnapshot;

const params = { a: 800, b: 40, g: 1.5, m: 0.4, c: 0.05 };

function solve(s: State) {
  const { a, b, g, m, c } = params;
  const P =
    (c * a + c * g * s.G + c * m * s.M + s.Pe - c * s.Yn) / (1 + c * b);
  const Y = a - b * P + g * s.G + m * s.M;
  return { Y, P };
}

function buildSeries(s: State) {
  const { a, b, g, m, c } = params;
  const Ys = Array.from({ length: 41 }, (_, i) => 600 + i * 20);
  return Ys.map((Y) => ({
    Y,
    AD: (a - Y + g * s.G + m * s.M) / b,
    SRAS: s.Pe + c * (Y - s.Yn),
  }));
}

// Drag calibration. AD shifts via G (slider range 0-300, 1 px ≈ 1 unit G).
// SRAS shifts via Pe (range 1-5, finer). Roughly 1 px = 0.01 Pe.
const DRAG_G_PER_PX = 1.0;
const DRAG_PE_PER_PX = 0.01;

export default function ADASChart() {
  const [state, setState] = useState<State>(ADAS_BASELINE);
  const [pinned, setPinned] = useState<State | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const fromUrl = readADASFromURL();
    if (Object.keys(fromUrl).length > 0) {
      setState((s) => ({ ...s, ...fromUrl }));
    }
  }, []);

  useEffect(() => {
    writeADASToURL(state);
  }, [state]);

  const G = useAnimatedValue(state.G, { durationMs: 220 });
  const M = useAnimatedValue(state.M, { durationMs: 220 });
  const Pe = useAnimatedValue(state.Pe, { durationMs: 220 });
  const Yn = useAnimatedValue(state.Yn, { durationMs: 220 });
  const animated: State = { G, M, Pe, Yn };

  const data = useMemo(() => buildSeries(animated), [G, M, Pe, Yn]);
  const eq = useMemo(() => solve(animated), [G, M, Pe, Yn]);

  const baseline = useMemo(() => solve(ADAS_BASELINE), []);
  const deltaY = eq.Y - baseline.Y;
  const deltaP = eq.P - baseline.P;

  function reset() {
    setState({ ...ADAS_BASELINE });
  }

  function applyPreset(presetId: string) {
    const preset = ADAS_PRESETS.find((p) => p.id === presetId);
    if (preset) setState({ ...preset.state });
  }

  function pin() {
    setPinned({ ...state });
    setCompareMode(true);
  }
  function unpin() {
    setPinned(null);
    setCompareMode(false);
  }

  async function copyShareLink() {
    const url = shareableURL(state);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // silently ignore
    }
  }

  function onDragAD(_: unknown, info: PanInfo) {
    const newG = clamp(state.G + info.delta.x * DRAG_G_PER_PX, 0, 300);
    setState((s) => ({ ...s, G: newG }));
  }
  function onDragSRAS(_: unknown, info: PanInfo) {
    const newPe = clamp(state.Pe + info.delta.x * DRAG_PE_PER_PX, 1, 5);
    setState((s) => ({ ...s, Pe: newPe }));
  }

  const activePresetId =
    ADAS_PRESETS.find(
      (p) =>
        Math.abs(p.state.G - state.G) < 0.5 &&
        Math.abs(p.state.M - state.M) < 0.5 &&
        Math.abs(p.state.Pe - state.Pe) < 0.05 &&
        Math.abs(p.state.Yn - state.Yn) < 0.5,
    )?.id ?? '';

  return (
    <div className="my-8 rounded-lg border border-slate-200 bg-white p-5">
      {/* Preset menu */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Preset</label>
        <select
          value={activePresetId}
          onChange={(e) => applyPreset(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">— Custom —</option>
          {ADAS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {activePresetId && (
          <p className="flex-1 text-xs text-ink-muted">
            {ADAS_PRESETS.find((p) => p.id === activePresetId)?.blurb}
          </p>
        )}
      </div>

      {/* Sliders + number inputs */}
      <div className="flex flex-wrap items-end gap-6">
        <ParamControl
          label="G"
          value={state.G}
          min={0}
          max={300}
          step={1}
          decimals={0}
          onChange={(v) => setState((s) => ({ ...s, G: v }))}
        />
        <ParamControl
          label="M"
          value={state.M}
          min={200}
          max={1200}
          step={1}
          decimals={0}
          onChange={(v) => setState((s) => ({ ...s, M: v }))}
        />
        <ParamControl
          label="Expected price Pᵉ"
          value={state.Pe}
          min={1}
          max={5}
          step={0.05}
          decimals={2}
          onChange={(v) => setState((s) => ({ ...s, Pe: v }))}
        />
        <ParamControl
          label="Natural output Yₙ"
          value={state.Yn}
          min={800}
          max={1200}
          step={5}
          decimals={0}
          onChange={(v) => setState((s) => ({ ...s, Yn: v }))}
        />
        <button
          onClick={reset}
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
        >
          Reset
        </button>
      </div>

      {/* Live readouts + deltas */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Equilibrium:</span>
        <span>
          <strong>Y* = {eq.Y.toFixed(0)}</strong>
          {Math.abs(deltaY) > 0.5 && <DeltaBadge value={deltaY} />}
        </span>
        <span>
          <strong>P* = {eq.P.toFixed(2)}</strong>
          {Math.abs(deltaP) > 0.02 && <DeltaBadge value={deltaP} />}
        </span>
      </div>

      {/* Chart with drag handles */}
      <div className="relative mt-4 h-80">
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

        <DragHandle label="AD" color="#2563eb" top="25%" onDrag={onDragAD} />
        <DragHandle label="SRAS" color="#dc2626" top="60%" onDrag={onDragSRAS} />
      </div>

      {/* Pin & compare + share */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        {pinned ? (
          <button
            onClick={unpin}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
          >
            Unpin snapshot
          </button>
        ) : (
          <button
            onClick={pin}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
          >
            Pin current as snapshot
          </button>
        )}
        {pinned && (
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            <span>Show side-by-side</span>
          </label>
        )}
        <button
          onClick={copyShareLink}
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
        >
          {shareCopied ? 'Copied!' : 'Copy share link'}
        </button>
      </div>

      {compareMode && pinned && (
        <div className="mt-4">
          <CompareScenarios
            leftLabel={`Pinned: G=${pinned.G.toFixed(0)}, M=${pinned.M.toFixed(0)}, Pᵉ=${pinned.Pe.toFixed(2)}, Yₙ=${pinned.Yn.toFixed(0)}`}
            rightLabel={`Current: G=${state.G.toFixed(0)}, M=${state.M.toFixed(0)}, Pᵉ=${state.Pe.toFixed(2)}, Yₙ=${state.Yn.toFixed(0)}`}
            left={<ADASScenarioView state={pinned} />}
            right={<ADASScenarioView state={state} />}
            caption="Drag AD or SRAS on the live chart, tweak sliders, or pick another preset to see how equilibrium moves relative to your pinned snapshot."
          />
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Short-run AD-AS. AD slopes down in (Y, P); SRAS slopes up around Yₙ.
        Demand shocks shift AD; supply shocks change Pᵉ or Yₙ. Drag the AD
        or SRAS pill on the right edge, use sliders, or pick a preset.
      </p>
    </div>
  );
}

function ParamControl({
  label,
  value,
  min,
  max,
  step,
  decimals,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string>(value.toFixed(decimals));

  useEffect(() => {
    setText(value.toFixed(decimals));
  }, [value, decimals]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(value.toFixed(decimals));
      return;
    }
    const clamped = clamp(n, min, max);
    onChange(clamped);
    setText(clamped.toFixed(decimals));
  }

  return (
    <div className="flex flex-col text-sm">
      <span className="font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-32"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
        />
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value > 0;
  const cls = positive
    ? 'bg-emerald-50 text-emerald-800'
    : 'bg-rose-50 text-rose-800';
  const sign = positive ? '+' : '';
  return (
    <span className={`ml-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {sign}
      {value.toFixed(2)}{' '}
      <span className="font-normal opacity-70">vs baseline</span>
    </span>
  );
}

function DragHandle({
  label,
  color,
  top,
  onDrag,
}: {
  label: string;
  color: string;
  top: string;
  onDrag: (e: unknown, info: PanInfo) => void;
}) {
  return (
    <motion.button
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0}
      dragMomentum={false}
      onPan={onDrag}
      type="button"
      aria-label={`Drag to shift ${label} curve horizontally`}
      style={{ top, color, borderColor: color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold shadow hover:shadow-md"
    >
      {label} ↔
    </motion.button>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
