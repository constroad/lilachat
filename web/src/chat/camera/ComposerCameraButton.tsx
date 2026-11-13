import { Camera } from 'lucide-react';
import { MAX_VIDEO_SECONDS } from '@lilachat/shared';
import { openWebCamera } from './cameraRequests';
import { cameraEnvironment, liveCameraFits } from './shotStamp';

/**
 * The chat's camera on the web of a phone (José 13/11: the PWA, the iPhone's way in, with the APK's
 * camera): photo or video with the stamp, waiting in the composer like a picked file. A computer has none.
 */
export function ComposerCameraButton(props: { onShot: (file: File) => void }) {
  if (!liveCameraFits(cameraEnvironment(), {})) return null;
  const shoot = () => void openWebCamera({ title: 'Cámara', video: { maxSeconds: MAX_VIDEO_SECONDS } }).then((file) => file && props.onShot(file));
  return (
    <button type="button" data-testid="btn-camara-chat" aria-label="Cámara" onClick={shoot} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background">
      <Camera size={20} />
    </button>
  );
}
