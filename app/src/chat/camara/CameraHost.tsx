import { FormCamera } from './FormCamera';
import { useCameraAsk } from './cameraRequests';

/** Mounted once at the root: the camera that `openCamera` asks for, over whatever screen is open. */
export function CameraHost() {
  const ask = useCameraAsk();
  if (!ask) return null;
  return <FormCamera title={ask.title} video={ask.video} onShot={(shot, stamp) => ask.finish({ ...shot, stamp })} onClose={() => ask.finish(null)} />;
}
