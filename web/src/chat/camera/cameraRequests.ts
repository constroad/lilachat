import { useSyncExternalStore } from 'react';
import { cameraEnvironment, liveCameraFits } from './shotStamp';

export type WebCameraAsk = { title: string; /** FOTO / VIDEO with this ceiling; `first` opens on VIDEO. */ video?: { maxSeconds: number; first?: boolean } };
type Pending = WebCameraAsk & { finish: (file: File | null) => void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

/**
 * Lilachat's camera from anywhere in the web on a phone (José 12/11: the same camera everywhere):
 * a form's photo, an observation, «Registrar avance» and the Drive ask for a shot and wait for it.
 * The file comes back with its stamp beside it (`stampOfFile`); null when the person closes it.
 */
export function openWebCamera(ask: WebCameraAsk): Promise<File | null> {
  pending?.finish(null);
  return new Promise((resolve) => {
    pending = {
      ...ask,
      finish: (file) => {
        pending = null;
        tell();
        resolve(file);
      },
    };
    tell();
  });
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));

export const useWebCameraAsk = (): Pending | null => useSyncExternalStore(subscribe, () => pending, () => null);

/** What a «Foto» or «Video» button holds: it opens the camera or the file picker, whichever fits. */
export type PickerHandle = { click: () => void };

/** Lilachat's camera on a phone; the file picker on a computer or for a gallery field. */
export function shootOrPick(ask: WebCameraAsk, field: { gallery?: boolean }, pickFile: () => void, onFile: (file: File) => void): void {
  if (!liveCameraFits(cameraEnvironment(), field)) return pickFile();
  void openWebCamera(ask).then((file) => file && onFile(file));
}

/** What the camera is asked right now; for tests. */
export const pendingForTest = (): Pending | null => pending;
