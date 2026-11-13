import { useSyncExternalStore } from 'react';
import type { TimemarkStampAsked } from '@lilachat/shared';
import { cameraAllowed, type CameraShot } from './FormCamera';

export type CapturedShot = CameraShot & { stamp: TimemarkStampAsked };
export type CameraAsk = { title: string; /** FOTO / VIDEO with this ceiling; `first` opens on VIDEO. */ video?: { maxSeconds: number; first?: boolean } };
type Pending = CameraAsk & { finish: (shot: CapturedShot | null) => void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

/**
 * The new camera from anywhere in the APK (José 12/11: «usar ahora la nueva cámara en toda la apk»):
 * the observations, «Registrar avance» and the Drive tab ask for a shot and wait for it, like they
 * waited for the system camera. Null when the person closes it; 'denied' without the permission.
 */
export async function openCamera(ask: CameraAsk): Promise<CapturedShot | null | 'denied'> {
  if (!(await cameraAllowed())) return 'denied';
  pending?.finish(null);
  return new Promise((resolve) => {
    pending = {
      ...ask,
      finish: (shot) => {
        pending = null;
        tell();
        resolve(shot);
      },
    };
    tell();
  });
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));

export const useCameraAsk = (): Pending | null => useSyncExternalStore(subscribe, () => pending);

/** What the camera is asked right now; for tests. */
export const pendingForTest = (): Pending | null => pending;
