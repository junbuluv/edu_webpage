import { useEffect, useRef, useState } from 'react';
import type { QuestionT } from '@/content/config';
import { haversineMeters } from '@lib/geo';

interface Geo {
  requiredLat: number | null;
  requiredLng: number | null;
  requiredRadiusMeters: number;
}

interface Exam {
  slug: string;
  title: string;
  durationMinutes: number;
  questions: QuestionT[];
  passingScore: number;
}

interface Props {
  adminId: string;
  exam: Exam;
  geo: Geo;
  closesAt: string;
}

type Phase = 'gatecheck' | 'taking' | 'submitted' | 'error';

interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

interface ApiStartResp {
  ok: boolean;
  reason?: string;
  attemptId?: string;
  deadlineMs?: number;
}

interface ApiSubmitResp {
  ok: boolean;
  reason?: string;
  score?: number;
  maxScore?: number;
}

export default function ExamRunner({ adminId, exam, geo, closesAt }: Props) {
  const [phase, setPhase] = useState<Phase>('gatecheck');
  const [reason, setReason] = useState<string>('');
  const [pos, setPos] = useState<Position | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<ApiSubmitResp | null>(null);

  // Live clock for countdown.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-submit when deadline reached.
  const autoSubmitFiredRef = useRef(false);
  useEffect(() => {
    if (
      phase === 'taking' &&
      deadlineMs &&
      now >= deadlineMs &&
      !autoSubmitFiredRef.current
    ) {
      autoSubmitFiredRef.current = true;
      void submit('deadline');
    }
  }, [phase, deadlineMs, now]); // eslint-disable-line react-hooks/exhaustive-deps

  function geolocate() {
    setReason('');
    if (!('geolocation' in navigator)) {
      setReason('Your browser does not support geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next: Position = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        };
        setPos(next);
        if (geo.requiredLat != null && geo.requiredLng != null) {
          const d = haversineMeters(
            next.lat,
            next.lng,
            geo.requiredLat,
            geo.requiredLng,
          );
          setDistance(d);
          if (d > geo.requiredRadiusMeters) {
            setReason(
              `You appear to be ${Math.round(d)} m from the exam location ` +
                `(required: within ${geo.requiredRadiusMeters} m). ` +
                `Move closer to 55 Lexington Ave, NYC and retry.`,
            );
          }
        }
      },
      (e) => {
        setReason(
          `Could not read your location: ${e.message}. ` +
            'Allow location access in your browser settings and retry.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }

  async function start() {
    if (!pos) {
      setReason('Location not yet read. Click "Check my location" first.');
      return;
    }
    if (
      geo.requiredLat != null &&
      geo.requiredLng != null &&
      distance != null &&
      distance > geo.requiredRadiusMeters
    ) {
      setReason('Still outside the allowed radius. Move closer and recheck.');
      return;
    }
    const resp = await fetch('/api/exams/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adminId, lat: pos.lat, lng: pos.lng }),
    });
    const json: ApiStartResp = await resp.json();
    if (!json.ok) {
      setReason(json.reason ?? 'Could not start exam.');
      return;
    }
    setAttemptId(json.attemptId ?? null);
    setDeadlineMs(json.deadlineMs ?? null);
    setPhase('taking');
  }

  async function submit(reason: 'manual' | 'deadline') {
    let submitLat: number | null = null;
    let submitLng: number | null = null;
    if (navigator.geolocation) {
      try {
        const p = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 4_000,
            maximumAge: 30_000,
          }),
        );
        submitLat = p.coords.latitude;
        submitLng = p.coords.longitude;
      } catch {
        // proceed without; server records null
      }
    }
    try {
      const resp = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminId,
          attemptId,
          answers,
          lat: submitLat,
          lng: submitLng,
          source: reason,
        }),
      });
      const json: ApiSubmitResp = await resp.json();
      setResult(json);
      if (json.ok) {
        setPhase('submitted');
      } else {
        // Allow retry — keep state in 'taking' so answers persist.
        autoSubmitFiredRef.current = false;
        setReason(json.reason ?? 'Submission failed. Click Submit again to retry.');
      }
    } catch (e) {
      autoSubmitFiredRef.current = false;
      setReason(
        `Network error: ${(e as Error).message}. Click Submit again to retry.`,
      );
    }
  }

  // Render

  if (phase === 'gatecheck') {
    return (
      <section className="my-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Before you can start</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
          <li>
            You must be physically at <strong>55 Lexington Ave, New York,
            NY 10010</strong>. Browser geolocation will check.
          </li>
          <li>Once started, you'll have <strong>{exam.durationMinutes} minutes</strong>{' '}
            to submit. The exam auto-submits when the timer runs out.</li>
          <li>Single attempt. No going back to revise after submission.</li>
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={geolocate}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-accent"
          >
            Check my location
          </button>
          {pos && (
            <span className="text-sm text-ink-muted">
              Got your position (±{Math.round(pos.accuracy)} m).
              {distance != null && (
                <> Distance to required point:{' '}
                  <strong>{Math.round(distance)} m</strong>
                  {distance <= geo.requiredRadiusMeters ? ' ✓' : ' ✗'}
                </>
              )}
            </span>
          )}
        </div>

        {reason && (
          <p className="mt-4 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
            {reason}
          </p>
        )}

        <div className="mt-6">
          <button
            onClick={start}
            disabled={
              !pos ||
              (distance != null && distance > geo.requiredRadiusMeters)
            }
            className="rounded bg-accent px-4 py-2 font-medium text-white disabled:opacity-40 hover:bg-blue-700"
          >
            Start exam
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Window closes at {new Date(closesAt).toLocaleString()}. After
          that, the server will reject your submission even if your timer
          hasn't run out.
        </p>
      </section>
    );
  }

  if (phase === 'taking') {
    const remainingMs = Math.max(0, (deadlineMs ?? 0) - now);
    const mins = Math.floor(remainingMs / 60_000);
    const secs = Math.floor((remainingMs % 60_000) / 1000);
    return (
      <section className="my-8 rounded-lg border border-slate-200 bg-white p-6">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <span className="text-sm font-medium">{exam.title}</span>
          <span className={`text-sm font-mono ${remainingMs < 5 * 60_000 ? 'text-rose-700' : 'text-ink-muted'}`}>
            {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')} remaining
          </span>
        </div>

        {reason && (
          <div className="mb-6 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
            {reason}
          </div>
        )}

        <ol className="space-y-8">
          {exam.questions.map((q, idx) => (
            <li key={q.id}>
              <p className="font-medium">
                {idx + 1}. {q.prompt}
              </p>
              <div className="mt-3">
                {renderInput(q, answers[q.id], (v) =>
                  setAnswers((a) => ({ ...a, [q.id]: v })),
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-ink-muted">
            Auto-submits at deadline. Closing this tab does NOT pause the
            timer.
          </p>
          <button
            onClick={() => submit('manual')}
            className="rounded bg-accent px-4 py-2 font-medium text-white"
          >
            Submit exam
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'submitted' && result) {
    const pct =
      result.maxScore && result.maxScore > 0
        ? (result.score ?? 0) / result.maxScore
        : 0;
    const passed = pct >= exam.passingScore;
    return (
      <section className="my-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Submitted</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Your answers were recorded.
        </p>
        <div className="mt-4 rounded bg-slate-50 p-4 text-center">
          <div className="text-3xl font-semibold">
            {result.score} / {result.maxScore}
          </div>
          <div className={`mt-1 text-sm font-medium ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>
            {passed ? `Passed (≥ ${Math.round(exam.passingScore * 100)}%)` : 'Did not pass'}
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Detailed answer review is not shown to preserve exam-bank integrity.
          Contact your instructor for question-level feedback.
        </p>
      </section>
    );
  }

  return (
    <section className="my-8 rounded-lg border border-rose-300 bg-rose-50 p-6">
      <h2 className="text-lg font-semibold text-rose-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-rose-900">{reason || 'Unknown error.'}</p>
    </section>
  );
}

function renderInput(
  q: QuestionT,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  if (q.type === 'multiple_choice') {
    return (
      <div className="space-y-2">
        {q.choices.map((c, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2">
            <input
              type="radio"
              name={q.id}
              checked={value === i}
              onChange={() => onChange(i)}
              className="mt-1"
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.type === 'multi_select') {
    const current = Array.isArray(value) ? (value as number[]) : [];
    function toggle(i: number) {
      onChange(current.includes(i) ? current.filter((v) => v !== i) : [...current, i]);
    }
    return (
      <div className="space-y-2">
        {q.choices.map((c, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2">
            <input
              type="checkbox"
              checked={current.includes(i)}
              onChange={() => toggle(i)}
              className="mt-1"
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
    );
  }
  // numeric
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 rounded border border-slate-300 px-3 py-2"
      />
      {q.unit && <span className="text-sm text-ink-muted">{q.unit}</span>}
    </div>
  );
}
