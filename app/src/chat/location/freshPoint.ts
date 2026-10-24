import * as Location from 'expo-location';
import { geoPointOf, type GeoPoint } from '@lilachat/shared';

/** How long the phone gets to read where it is when signing (ms). */
const FIX_TIMEOUT_MS = 15_000;
/** A reading older than this is the phone's cache, not «now». */
const FRESH_FIX_MS = 30_000;

/**
 * Where the person is RIGHT NOW, read when they sign (José, 24/10: «la
 * ubicación debe ser en tiempo real, no la guardada en caché»). Never the
 * last known position: without a fresh reading it gives null and the signing
 * waits. `age` goes with it so the server can judge it with no clock to trust.
 */
export async function freshPoint(): Promise<(GeoPoint & { readAt: number }) | null> {
  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (permission?.status !== 'granted') return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
  const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null), timeout]);
  if (!fix || Date.now() - fix.timestamp > FRESH_FIX_MS) return null;
  return { ...geoPointOf({ latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? 0 }), readAt: fix.timestamp };
}

/** The point as it is sent: how old the reading is at that moment. */
export const withAge = (point: GeoPoint & { readAt: number }): GeoPoint => ({ lat: point.lat, lng: point.lng, precision: point.precision, age: Math.max(0, Date.now() - point.readAt) });
