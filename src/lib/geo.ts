// Haversine distance between two lat/lng points, in meters.
// Standard great-circle formula on a spherical Earth (R ≈ 6,371 km).

const R = 6_371_000; // Earth mean radius in meters
export const MAX_GEOLOCATION_ACCURACY_METERS = 100;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function withinGeofence(
  lat: number,
  lng: number,
  requiredLat: number,
  requiredLng: number,
  radiusMeters: number,
): boolean {
  const distance = haversineMeters(lat, lng, requiredLat, requiredLng);
  return Number.isFinite(distance) && distance <= radiusMeters;
}

export function acceptableGeolocationAccuracy(
  accuracyMeters: number,
  radiusMeters: number,
): boolean {
  return (
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > 0 &&
    accuracyMeters <= Math.min(radiusMeters, MAX_GEOLOCATION_ACCURACY_METERS)
  );
}

export function withinGeofenceWithAccuracy(
  lat: number,
  lng: number,
  accuracyMeters: number,
  requiredLat: number,
  requiredLng: number,
  radiusMeters: number,
): boolean {
  const distance = haversineMeters(lat, lng, requiredLat, requiredLng);
  return (
    Number.isFinite(distance) &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters >= 0 &&
    distance + accuracyMeters <= radiusMeters
  );
}

// Baruch College — Vertical Campus, 55 Lexington Ave, New York, NY 10010
export const BARUCH_55_LEX = { lat: 40.7411, lng: -73.9837 };
