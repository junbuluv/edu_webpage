import { useState } from 'react';
import { haversineMeters } from '@lib/geo';

interface Props {
  administrationId: string;
  section: string;
  requiredLat: number | null;
  requiredLng: number | null;
  requiredRadiusMeters: number;
}

type Phase =
  | 'idle'
  | 'locating'
  | 'submitting'
  | 'success'
  | 'error';

interface StampResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  section?: string;
  stamped_at?: string;
}

export default function StampInButton({
  administrationId,
  section,
  requiredLat,
  requiredLng,
  requiredRadiusMeters,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stampedAt, setStampedAt] = useState<string | null>(null);

  const geoRequired = requiredLat != null && requiredLng != null;

  async function getPosition(): Promise<{ lat: number; lng: number } | null> {
    if (!('geolocation' in navigator)) {
      setError('Your browser does not support geolocation. Open this page in a different browser.');
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => {
          setError(
            `Could not read your location: ${e.message}. Allow location access in your browser settings, then try again.`,
          );
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

    if (geoRequired) {
      const pos = await getPosition();
      if (!pos) {
        setPhase('error');
        return;
      }
      lat = pos.lat;
      lng = pos.lng;
      const dist = haversineMeters(lat, lng, requiredLat!, requiredLng!);
      if (dist > requiredRadiusMeters) {
        setError(
          `You appear to be ${Math.round(dist)} m from the workshop location (within ${requiredRadiusMeters} m required). Move closer and retry.`,
        );
        setPhase('error');
        return;
      }
    }

    setPhase('submitting');
    try {
      const resp = await fetch('/api/workshops/stamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ administration_id: administrationId, lat, lng }),
      });
      const data = (await resp.json()) as StampResult;
      if (data.ok) {
        setStampedAt(data.stamped_at ?? new Date().toISOString());
        setPhase('success');
      } else {
        setError(data.detail ?? data.reason ?? 'Stamp failed.');
        setPhase('error');
      }
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
      setPhase('error');
    }
  }

  if (phase === 'success') {
    return (
      <div className="rounded border border-emerald-300 bg-emerald-50 p-4">
        <p className="font-medium text-emerald-900">
          ✓ Stamped in for section {section}.
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          {stampedAt && `Recorded at ${new Date(stampedAt).toLocaleTimeString()}.`}{' '}
          Discussion questions will be revealed by your instructor during class.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
            : `Stamp in for ${section}`}
      </button>
      {error && (
        <p className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
          {error}
        </p>
      )}
    </div>
  );
}
