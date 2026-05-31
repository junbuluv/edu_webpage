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
import BondScenarioView from '@components/viz/BondScenarioView';
import CompareScenarios from '@components/mdx/CompareScenarios';
import {
  BOND_BASELINE,
  BOND_PRESETS,
  type BondSnapshot,
} from '@lib/bonds/presets';
import {
  readBondFromURL,
  shareableURL,
  writeBondToURL,
} from '@lib/bonds/url-state';

// Bond pricing: P = sum_{t=1..N} C/(1+y)^t + F/(1+y)^N
// Macaulay duration = (1/P) * (sum t*C/(1+y)^t + N*F/(1+y)^N)
// Modified duration = Macaulay / (1+y)

type State = BondSnapshot;

function price(s: State, y: number) {
  const c = s.zero ? 0 : s.coupon * s.face;
  let p = 0;
  for (let t = 1; t <= s.maturity; t++) p += c / Math.pow(1 + y, t);
  p += s.face / Math.pow(1 + y, s.maturity);
  return p;
}

function duration(s: State, y: number) {
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

// Drag calibration on the chart: 1 px ≈ 0.0005 YTM (so 200 px = 10 pp).
const DRAG_Y_PER_PX = 0.0005;

export default function BondPriceYield() {
  const [s, setS] = useState<State>(BOND_BASELINE);
  const [pinned, setPinned] = useState<State | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const fromUrl = readBondFromURL();
    if (Object.keys(fromUrl).length > 0) {
      setS((prev) => ({ ...prev, ...fromUrl }));
    }
  }, []);

  useEffect(() => {
    writeBondToURL(s);
  }, [s]);

  const coupon = useAnimatedValue(s.coupon, { durationMs: 220 });
  const face = useAnimatedValue(s.face, { durationMs: 220 });
  const yieldRate = useAnimatedValue(s.yieldRate, { durationMs: 220 });
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

  const baselineP = useMemo(
    () => price(BOND_BASELINE, BOND_BASELINE.yieldRate),
    [],
  );
  const baselineDur = useMemo(
    () => duration(BOND_BASELINE, BOND_BASELINE.yieldRate),
    [],
  );
  const deltaPrice = currentP - baselineP;
  const deltaModified = modified - baselineDur.modified;

  function reset() {
    setS({ ...BOND_BASELINE });
  }

  function applyPreset(presetId: string) {
    const preset = BOND_PRESETS.find((p) => p.id === presetId);
    if (preset) setS({ ...preset.state });
  }

  function pin() {
    setPinned({ ...s });
    setCompareMode(true);
  }
  function unpin() {
    setPinned(null);
    setCompareMode(false);
  }

  async function copyShareLink() {
    const url = shareableURL(s);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // silently ignore
    }
  }

  function onDragYTM(_: unknown, info: PanInfo) {
    const newY = clamp(s.yieldRate + info.delta.x * DRAG_Y_PER_PX, 0.005, 0.2);
    setS((x) => ({ ...x, yieldRate: newY }));
  }

  const activePresetId =
    BOND_PRESETS.find(
      (p) =>
        Math.abs(p.state.coupon - s.coupon) < 0.0005 &&
        Math.abs(p.state.face - s.face) < 0.5 &&
        p.state.maturity === s.maturity &&
        Math.abs(p.state.yieldRate - s.yieldRate) < 0.0005 &&
        p.state.zero === s.zero,
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
          {BOND_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {activePresetId && (
          <p className="flex-1 text-xs text-ink-muted">
            {BOND_PRESETS.find((p) => p.id === activePresetId)?.blurb}
          </p>
        )}
      </div>

      {/* Sliders + number inputs */}
      <div className="flex flex-wrap items-end gap-6">
        <ParamControl
          label="Coupon rate"
          value={s.coupon}
          min={0}
          max={0.15}
          step={0.001}
          decimals={3}
          formatter={(v) => (v * 100).toFixed(2) + '%'}
          parser={(t) => Number(t.replace('%', '')) / 100}
          disabled={s.zero}
          onChange={(v) => setS((x) => ({ ...x, coupon: v }))}
        />
        <ParamControl
          label="Face value"
          value={s.face}
          min={100}
          max={5000}
          step={50}
          decimals={0}
          formatter={(v) => `$${v.toFixed(0)}`}
          parser={(t) => Number(t.replace(/[^0-9.]/g, ''))}
          onChange={(v) => setS((x) => ({ ...x, face: v }))}
        />
        <ParamControl
          label="Maturity (yrs)"
          value={s.maturity}
          min={1}
          max={30}
          step={1}
          decimals={0}
          onChange={(v) => setS((x) => ({ ...x, maturity: Math.round(v) }))}
        />
        <ParamControl
          label="YTM y"
          value={s.yieldRate}
          min={0.005}
          max={0.2}
          step={0.001}
          decimals={3}
          formatter={(v) => (v * 100).toFixed(2) + '%'}
          parser={(t) => Number(t.replace('%', '')) / 100}
          onChange={(v) => setS((x) => ({ ...x, yieldRate: v }))}
        />
        <label className="self-end text-sm">
          <input
            type="checkbox"
            checked={s.zero}
            onChange={(e) => setS((x) => ({ ...x, zero: e.target.checked }))}
          />
          <span className="ml-1">Zero-coupon</span>
        </label>
        <button
          onClick={reset}
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
        >
          Reset
        </button>
      </div>

      {/* Stats with delta callouts */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <StatWithDelta
          label="Price"
          value={`$${currentP.toFixed(2)}`}
          delta={deltaPrice}
          deltaFmt={(d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}`}
        />
        <StatWithDelta
          label="Macaulay duration"
          value={macaulay.toFixed(2)}
          delta={macaulay - baselineDur.macaulay}
          deltaFmt={(d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}`}
        />
        <StatWithDelta
          label="Modified duration"
          value={modified.toFixed(2)}
          delta={deltaModified}
          deltaFmt={(d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}`}
        />
      </div>

      {/* Chart with drag handle on YTM */}
      <div className="relative mt-4 h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="y"
              tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              label={{
                value: 'yield to maturity',
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
              x={yieldRate}
              y={currentP}
              r={5}
              fill="#0f172a"
              stroke="white"
            />
          </LineChart>
        </ResponsiveContainer>
        <DragHandle label="YTM" color="#0f172a" top="45%" onDrag={onDragYTM} />
      </div>

      {/* Pin & compare + share */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        {pinned ? (
          <button
            onClick={unpin}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
          >
            Unpin bond
          </button>
        ) : (
          <button
            onClick={pin}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
          >
            Pin current bond
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
            leftLabel={`Pinned: ${describeBond(pinned)}`}
            rightLabel={`Current: ${describeBond(s)}`}
            left={<BondScenarioView state={pinned} />}
            right={<BondScenarioView state={s} />}
            caption="Compare your bond against the pinned benchmark. Drag YTM on the live chart or tweak the sliders to see how price and duration diverge."
          />
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Price-yield curve is convex. For a small yield change Δy, price changes
        by approximately <code>−D_modified · P · Δy</code>. Longer maturity →
        steeper curve → more interest-rate risk. Drag the YTM pill on the right,
        type values, or pick a preset (Treasury, IG corp, junk, T-bill).
      </p>
    </div>
  );
}

function describeBond(b: BondSnapshot): string {
  const coupon = (b.coupon * 100).toFixed(1);
  const ytm = (b.yieldRate * 100).toFixed(1);
  const z = b.zero ? ' zero' : '';
  return `${coupon}% coupon · ${b.maturity}y · YTM ${ytm}%${z}`;
}

function ParamControl({
  label,
  value,
  min,
  max,
  step,
  decimals,
  formatter,
  parser,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  formatter?: (v: number) => string;
  parser?: (t: string) => number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const fmt = formatter ?? ((v: number) => v.toFixed(decimals));
  const parse = parser ?? ((t: string) => Number(t));
  const [text, setText] = useState<string>(fmt(value));

  useEffect(() => {
    setText(fmt(value));
  }, [value, decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(raw: string) {
    const n = parse(raw);
    if (!Number.isFinite(n)) {
      setText(fmt(value));
      return;
    }
    const clamped = clamp(n, min, max);
    onChange(clamped);
    setText(fmt(clamped));
  }

  return (
    <div className={`flex flex-col text-sm ${disabled ? 'opacity-40' : ''}`}>
      <span className="font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-32"
        />
        <input
          type="text"
          value={text}
          disabled={disabled}
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

function StatWithDelta({
  label,
  value,
  delta,
  deltaFmt,
}: {
  label: string;
  value: string;
  delta: number;
  deltaFmt: (d: number) => string;
}) {
  const showDelta = Math.abs(delta) > 0.005;
  const positive = delta > 0;
  return (
    <div className="rounded border border-slate-200 px-3 py-2">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
      {showDelta && (
        <div
          className={`mt-0.5 text-xs font-medium ${positive ? 'text-emerald-700' : 'text-rose-700'}`}
        >
          {deltaFmt(delta)} vs baseline
        </div>
      )}
    </div>
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
      aria-label={`Drag to change ${label}`}
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
