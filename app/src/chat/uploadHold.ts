/**
 * Uploads with the app in the back (José 26/11: he locks the phone at the site and the photos must
 * still go up when signal comes). Without «Conexión permanente» the socket pauses in the back, and
 * every queue drains only with it. So, going to the back with something pending, the socket is held
 * (with the foreground service Android demands for it) until the queues are empty; then it pauses as
 * always, so the server marks the person offline and the next message comes by push. PURE.
 */
export type UploadHoldStep = 'hold' | 'release' | 'none';

/**
 * The service starts as soon as something is pending, with the app in front: Android refuses to start a
 * foreground service from the back. It stops when nothing is left; «Conexión permanente» has its own.
 */
export function uploadHoldStep(input: { permanent: boolean; pending: number; holding: boolean }): UploadHoldStep {
  if (input.permanent) return input.holding ? 'release' : 'none';
  if (input.pending > 0) return input.holding ? 'none' : 'hold';
  return input.holding ? 'release' : 'none';
}
