import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptableGeolocationAccuracy,
  haversineMeters,
  withinGeofence,
  withinGeofenceWithAccuracy,
} from './geo.ts';

test('geofence accepts inside and exact boundary, then rejects outside', () => {
  const center = { lat: 40.7411, lng: -73.9837 };
  const point = { lat: 40.742, lng: -73.9837 };
  const distance = haversineMeters(
    center.lat,
    center.lng,
    point.lat,
    point.lng,
  );
  assert.equal(
    withinGeofence(center.lat, center.lng, center.lat, center.lng, 1),
    true,
  );
  assert.equal(
    withinGeofence(point.lat, point.lng, center.lat, center.lng, distance),
    true,
  );
  assert.equal(
    withinGeofence(
      point.lat,
      point.lng,
      center.lat,
      center.lng,
      distance - 0.001,
    ),
    false,
  );
});

test('geofence conservatively includes reported location accuracy', () => {
  const center = { lat: 40.7411, lng: -73.9837 };
  assert.equal(
    withinGeofenceWithAccuracy(
      center.lat,
      center.lng,
      100,
      center.lat,
      center.lng,
      100,
    ),
    true,
  );
  assert.equal(
    withinGeofenceWithAccuracy(
      center.lat,
      center.lng,
      100.001,
      center.lat,
      center.lng,
      100,
    ),
    false,
  );
});

test('accuracy policy is finite, positive, and capped by radius and 100 meters', () => {
  assert.equal(acceptableGeolocationAccuracy(50, 200), true);
  assert.equal(acceptableGeolocationAccuracy(101, 200), false);
  assert.equal(acceptableGeolocationAccuracy(51, 50), false);
  assert.equal(acceptableGeolocationAccuracy(0, 200), false);
  assert.equal(acceptableGeolocationAccuracy(Infinity, 200), false);
});
