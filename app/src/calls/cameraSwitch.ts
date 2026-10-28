import { cameraSwitchAllowed, isBenignCameraSwitchError, otherFacing, type CameraFacing } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';

type VideoTrack = { enabled: boolean; readyState: string; applyConstraints: (constraints: { facingMode: CameraFacing }) => Promise<void> };

/**
 * The other camera on the same track (pending 97): no renegotiation, the other
 * side keeps receiving. A tap with the camera off or mid-switch is skipped: the
 * native side threw for both (0.1.172 reports, 28/10).
 */
export function switchCameraTrack(params: { track: VideoTrack | undefined; facing: CameraFacing; switching: { current: boolean }; onSwitched: (facing: CameraFacing) => void }): void {
  const { track, switching } = params;
  if (!track || !cameraSwitchAllowed({ track, switching: switching.current })) return;
  switching.current = true;
  const next = otherFacing(params.facing);
  void track
    .applyConstraints({ facingMode: next })
    .then(() => params.onSwitched(next))
    .catch((error: unknown) => {
      if (!isBenignCameraSwitchError(error)) reportarError('call.camera', error);
    })
    .finally(() => {
      switching.current = false;
    });
}
