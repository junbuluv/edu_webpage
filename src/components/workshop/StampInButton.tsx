import { useEffect, useRef, useState } from 'react';

interface Props {
  administrationId: string;
  section: string | null;
  geoRequired: boolean;
}

type Phase = 'idle' | 'locating' | 'submitting' | 'success' | 'error';

interface StampResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  section?: string;
  stamped_at?: string;
}

const STAMP_ERRORS: Record<string, string> = {
  unauthenticated: 'Your session expired. Sign in again and retry.',
  role_not_student:
    'Attendance stamping is only available to student accounts.',
  missing_device_id: 'Refresh this page before retrying the attendance check.',
  invalid_json: 'Attendance could not be submitted. Refresh and retry.',
  invalid_administration_id: 'This workshop window is invalid or unavailable.',
  not_found: 'This workshop window is no longer available.',
  window_not_open: 'Stamping has not opened yet.',
  window_closed: 'This workshop window has closed.',
  window_cancelled: 'This workshop window was cancelled.',
  not_enrolled: 'You are not enrolled in this workshop class.',
  wrong_instructor: 'This workshop belongs to a different class roster.',
  wrong_section: 'This window is for a different section.',
  section_assignment_required:
    'Your roster does not have a section assignment. Ask your instructor to update it.',
  location_accuracy_insufficient:
    'Your location reading is not accurate enough. Move near a window, retry, or ask your instructor for manual verification.',
};

export default function StampInButton({
  administrationId,
  section,
  geoRequired,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stampedAt, setStampedAt] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (phase === 'success') successButtonRef.current?.focus();
  }, [phase]);

  async function getPosition(): Promise<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null> {
    if (!('geolocation' in navigator)) {
      setError(
        'Your browser does not support geolocation. Open this page in a different browser.',
      );
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        (e) => {
          const message =
            e.code === e.PERMISSION_DENIED
              ? 'Location access is off. Enable it in browser settings or ask your instructor for manual verification.'
              : 'We could not get a reliable location. Retry or ask your instructor for manual verification.';
          setError(message);
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
      );
    });
  }

  async function stamp() {
    setError(null);
    setPhase('locating');

    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;

    if (geoRequired) {
      const pos = await getPosition();
      if (!pos) {
        setPhase('error');
        return;
      }
      lat = pos.lat;
      lng = pos.lng;
      accuracy = pos.accuracy;
    }

    setPhase('submitting');
    try {
      const resp = await fetch('/api/workshops/stamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          administration_id: administrationId,
          lat,
          lng,
          accuracy,
        }),
      });
      const data = (await resp.json()) as StampResult;
      if (data.ok) {
        setStampedAt(data.stamped_at ?? new Date().toISOString());
        setPhase('success');
      } else {
        setError(
          data.detail ??
            (data.reason ? STAMP_ERRORS[data.reason] : null) ??
            'Attendance was not recorded. Retry or ask your instructor for help.',
        );
        setPhase('error');
      }
    } catch {
      setError(
        'Attendance was not recorded. Check your connection and try again.',
      );
      setPhase('error');
    }
  }

  if (phase === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded border border-emerald-300 bg-emerald-50 p-4"
      >
        <p className="font-medium text-emerald-900">
          {section
            ? `✓ Stamped in for section ${section}.`
            : '✓ Stamped in for this workshop.'}
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          {stampedAt &&
            `Recorded at ${new Date(stampedAt).toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
            })} ET.`}{' '}
          Discussion questions will be revealed by your instructor during class.
        </p>
        <button
          ref={successButtonRef}
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded border border-emerald-400 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-100"
        >
          Refresh to check discussion questions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {geoRequired && (
        <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p className="font-medium">Location check for attendance</p>
          <p className="mt-1">
            We check your location once for this workshop and do not track it in
            the background. The reading must be accurate enough that its
            uncertainty still fits inside the workshop radius. Coordinates and
            accuracy are not retained. If location is unavailable, ask your
            instructor for manual verification.
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={phase === 'locating' || phase === 'submitting'}
        onClick={stamp}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {phase === 'locating'
          ? 'Checking location…'
          : phase === 'submitting'
            ? 'Recording…'
            : section
              ? `${geoRequired ? 'Use location and stamp in' : 'Stamp in'} for ${section}`
              : geoRequired
                ? 'Use location and stamp in'
                : 'Stamp in'}
      </button>
      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900"
        >
          {error}
        </p>
      )}
    </div>
  );
}
