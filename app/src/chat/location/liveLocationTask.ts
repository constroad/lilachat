import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { shouldSendLiveUpdate, LIVE_MIN_INTERVAL_MS, type SharedLocation } from '@lilachat/shared';
import { stopLiveLocation, updateLiveLocation } from '../../api/client';
import { loadCredential } from '../../auth/credentialStore';
import { activeShares, withShare, withoutShare, type LiveShare } from './liveShares';

const TASK = 'lilachat-live-location';
const SHARES_KEY = 'lilachat.liveLocationShares';
const LAST_SENT_KEY = 'lilachat.liveLocationLastSent';
const GONE = 410;
/** Android asks for a notification while the phone shares from the background; it says what is going on. */
const NOTIFICATION = { notificationTitle: 'Compartiendo tu ubicación en tiempo real', notificationBody: 'Toca «Dejar de compartir» en el chat para terminar.' };

async function readShares(): Promise<LiveShare[]> {
  const raw = await AsyncStorage.getItem(SHARES_KEY).catch(() => null);
  try {
    return activeShares(raw ? JSON.parse(raw) : [], new Date());
  } catch {
    return [];
  }
}

const writeShares = (shares: LiveShare[]) => AsyncStorage.setItem(SHARES_KEY, JSON.stringify(shares)).catch(() => undefined);

async function readLastSent(): Promise<(SharedLocation & { at: number }) | null> {
  const raw = await AsyncStorage.getItem(LAST_SENT_KEY).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as SharedLocation & { at: number }) : null;
  } catch {
    return null;
  }
}

const toShared = (fix: Location.LocationObject): SharedLocation => ({
  lat: fix.coords.latitude,
  lng: fix.coords.longitude,
  ...(fix.coords.accuracy !== null ? { accuracy: Math.round(fix.coords.accuracy) } : {}),
});

/** One fix for every live share; the ones the server says ended leave, and with none left the service stops. */
async function sendFix(fix: Location.LocationObject): Promise<void> {
  const shares = await readShares();
  if (shares.length === 0) return void stopUpdates();
  const next = toShared(fix);
  const now = Date.now();
  if (!shouldSendLiveUpdate(await readLastSent(), next, now)) return;
  const credential = await loadCredential().catch(() => null);
  if (!credential) return;
  await AsyncStorage.setItem(LAST_SENT_KEY, JSON.stringify({ ...next, at: now })).catch(() => undefined);
  let left = shares;
  for (const share of shares) {
    const sent = await updateLiveLocation(credential.jwt, share.chatId, share.seq, next);
    if (!sent.ok && sent.status === GONE) left = withoutShare(left, share.chatId, share.seq);
  }
  if (left.length !== shares.length) await writeShares(left);
  if (left.length === 0) await stopUpdates();
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  const latest = data?.locations?.at(-1);
  if (error || !latest) return;
  await sendFix(latest);
});

async function stopUpdates(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TASK).catch(() => undefined);
}

/** Starts following the phone for this message; on Android a foreground service, no «todo el tiempo» needed. */
export async function startLiveSharing(share: LiveShare): Promise<boolean> {
  await writeShares(withShare(await readShares(), share));
  await AsyncStorage.removeItem(LAST_SENT_KEY).catch(() => undefined);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) return true;
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: LIVE_MIN_INTERVAL_MS,
      distanceInterval: 0,
      foregroundService: { ...NOTIFICATION, killServiceOnDestroy: false },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** «Dejar de compartir»: the server ends it for everyone, and this phone stops sending it. */
export async function stopLiveSharing(jwt: string, chatId: string, seq: number): Promise<boolean> {
  const stopped = await stopLiveLocation(jwt, chatId, seq);
  if (!stopped.ok && stopped.status !== GONE) return false;
  const left = withoutShare(await readShares(), chatId, seq);
  await writeShares(left);
  if (left.length === 0) await stopUpdates();
  return true;
}

/** Whether this phone is the one sending this live location (only its author can stop it from here). */
export async function isSharingHere(chatId: string, seq: number): Promise<boolean> {
  return (await readShares()).some((share) => share.chatId === chatId && share.seq === seq);
}
