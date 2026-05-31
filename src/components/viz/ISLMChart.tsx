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
import ISLMScenarioView from '@components/viz/ISLMScenarioView';
import CompareScenarios from '@components/mdx/CompareScenarios';
import {
  ISLM_BASELINE,
  ISLM_PRESETS,
  type ISLMSnapshot,
} from '@lib/islm/presets';
import {
  readISLMFromURL,
  shareableURL,
  writeISLMToURL,
} from '@lib/islm/url-state';

// Closed-economy IS-LM in (Y, r).
//   IS: r_IS(Y) = (alpha*A - Y) / (alpha*b),   A = A0 + G,  alpha = 1/(1 - c(1-t))
//   LM: r_LM(Y) = (k*Y - M/P) / h
// Equilibrium: Y* = (alpha*A*h + alpha*b*(M/P)) / (h + alpha*b*k)
//              r* = (k*Y* - M/P) / h

type State = ISLMSnapshot;

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

// Drag-on-chart calibration: how many units of G or M does a 1-pixel
// horizontal drag correspond to. Tuned so a 200 px drag spans roughly
// the natural slider range.
const DRAG_G_PER_PX = 0.5;
const DRAG_M_PER_PX = 0.5;

export default function ISLMChart() {
  const [state, setState] = useState<State>(ISLM_BASELINE);
  const [pinned, setPinned] = useState<State | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Read URL state on first mount so a shareable link lands you on the
  // sender's exact parameters.
  useEffect(() => {
    const fromUrl = readISLMFromURL();
    if (Object.keys(fromUrl).length > 0) {
      setState((s) => ({ ...s, ...fromUrl }));
    }
  }, []);

  // Mirror state back to the URL so refresh + share both work.
  useEffect(() => {
    writeISLMToURL(state);
  }, [state]);

  // Tween underlying parameters for smooth jumps (preset selection,
  // Reset, drag release). Scrubbing a slider remains snappy.
  const G = useAnimatedValue(state.G, { durationMs: 220 });
  const M = useAnimatedValue(state.M, { durationMs: 220 });
  const A0 = useAnimatedValue(state.A0, { durationMs: 220 });
  const animated: State = { G, M, A0 };

  const eq = useMemo(() => solve(animated), [G, M, A0]);
  const data = useMemo(() => buildSeries(animated, eq.Yeq), [G, M, A0, eq.Yeq]);

  const baseline = useMemo(() => solve(ISLM_BASELINE), []);
  const deltaY = eq.Yeq - baseline.Yeq;
  const deltaR = eq.req - baseline.req;

  function reset() {
    setState({ ...ISLM_BASELINE });
  }

  function applyPreset(presetId: string) {
    const preset = ISLM_PRESETS.find((p) => p.id === presetId);
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
      // Clipboard API unavailable; fall back silently.
    }
  }

  function onDragIS(_: unknown, info: PanInfo) {
    const newG = clamp(state.G + info.delta.x * DRAG_G_PER_PX, 0, 250);
    setState((s) => ({ ...s, G: newG }));
  }
  function onDragLM(_: unknown, info: PanInfo) {
    const newM = clamp(state.M + info.delta.x * DRAG_M_PER_PX, 50, 250);
    setState((s) => ({ ...s, M: newM }));
  }

  const activePresetId =
    ISLM_PRESETS.find(
      (p) =>
        Math.abs(p.state.G - state.G) < 0.5 &&
        Math.abs(p.state.M - state.M) < 0.5 &&
        Math.abs(p.state.A0 - state.A0) < 0.5,
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
          {ISLM_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {activePresetId && (
          <p className="flex-1 text-xs text-ink-muted">
            {ISLM_PRESETS.find((p) => p.id === activePresetId)?.blurb}
          </p>
        )}
      </div>

      {/* Sliders + number inputs */}
      <div className="flex flex-wrap items-end gap-6">
        <ParamControl
          label="Government spending G"
          value={state.G}
          min={0}
          max={250}
          step={1}
          onChange={(v) => setState((s) => ({ ...s, G: v }))}
        />
        <ParamControl
          label="Money supply M"
          value={state.M}
          min={50}
          max={250}
          step={1}
          onChange={(v) => setState((s) => ({ ...s, M: v }))}
        />
        <ParamControl
          label="Autonomous spending C₀+I₀"
          value={state.A0}
          min={50}
          max={250}
          step={1}
          onChange={(v) => setState((s) => ({ ...s, A0: v }))}
        />
        <button
          onClick={reset}
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
        >
          Reset
        </button>
      </div>

      {/* Live readouts: equilibrium + deltas from baseline */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Equilibrium:</span>
        <span>
          <strong>Y* = {eq.Yeq.toFixed(1)}</strong>
          {Math.abs(deltaY) > 0.1 && <DeltaBadge value={deltaY} unit="" />}
        </span>
        <span>
          <strong>r* = {eq.req.toFixed(2)}%</strong>
          {Math.abs(deltaR) > 0.01 && <DeltaBadge value={deltaR} unit="pp" />}
        </span>
      </div>

      {/* Chart: shows current state, with drag handles on each curve */}
      <div className="relative mt-4 h-80">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
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
              name="IS (goods market)"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="rLM"
              name="LM (money market)"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={eq.Yeq}
              y={eq.req}
              r={5}
              fill="#0f172a"
              stroke="white"
              strokeWidth={2}
              label={{
                value: 'eq',
                position: 'top',
                fontSize: 11,
                offset: 8,
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Drag overlays: capture horizontal pan and translate to ΔG / ΔM.
            Positioned to roughly hug each curve label area on the right
            edge of the chart so they don't collide with the equilibrium
            dot in the middle. */}
        <DragHandle label="IS" color="#2563eb" top="20%" onDrag={onDragIS} />
        <DragHandle label="LM" color="#dc2626" top="65%" onDrag={onDragLM} />
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

      {/* Side-by-side comparison when pinned and toggled on */}
      {compareMode && pinned && (
        <div className="mt-4">
          <CompareScenarios
            leftLabel={`Pinned snapshot: G=${pinned.G.toFixed(0)}, M=${pinned.M.toFixed(0)}, A₀=${pinned.A0.toFixed(0)}`}
            rightLabel={`Current: G=${state.G.toFixed(0)}, M=${state.M.toFixed(0)}, A₀=${state.A0.toFixed(0)}`}
            left={<ISLMScenarioView state={pinned} />}
            right={<ISLMScenarioView state={state} />}
            caption="Drag the IS or LM curve on the live chart above, or use the sliders, to see how the equilibrium shifts relative to your pinned snapshot."
          />
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Closed-economy IS-LM. Parameters: c = 0.6, t = 0.2, b = 20, k = 0.5, h =
        10, P = 1. The IS curve slopes down (lower r ⇒ more investment ⇒ higher
        Y). The LM curve slopes up (higher Y ⇒ more money demand ⇒ higher r to
        clear the money market at fixed M). They cross at equilibrium. Drag
        sliders, type values, drag the IS or LM label directly, or pick a
        historical preset.
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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string>(value.toFixed(0));

  // Keep the number input in sync when the value changes externally
  // (preset, Reset, drag).
  useEffect(() => {
    setText(value.toFixed(value % 1 === 0 ? 0 : 1));
  }, [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(value.toFixed(0));
      return;
    }
    const clamped = clamp(n, min, max);
    onChange(clamped);
    setText(clamped.toFixed(clamped % 1 === 0 ? 0 : 1));
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
          className="w-40"
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
          className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
        />
      </div>
    </div>
  );
}

function DeltaBadge({ value, unit }: { value: number; unit: string }) {
  const positive = value > 0;
  const cls = positive
    ? 'bg-emerald-50 text-emerald-800'
    : 'bg-rose-50 text-rose-800';
  const sign = positive ? '+' : '';
  return (
    <span className={`ml-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {sign}
      {value.toFixed(2)}
      {unit && ` ${unit}`}{' '}
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
      style={{ top, color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold shadow hover:shadow-md"
      // The border color matches the curve. Tailwind doesn't know the
      // dynamic color, so we set it inline via the wrapper style.
    >
      <span style={{ borderColor: color }}>{label} ↔</span>
    </motion.button>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
