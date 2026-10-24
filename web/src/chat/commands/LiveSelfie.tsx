import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { precisionLabel, type GeoPoint } from '@lilachat/shared';

const CLOCK_TICK_MS = 15_000;
const JPEG_QUALITY = 0.8;
const COORD_DECIMALS = 5;

export type LiveSelfieHandle = { capture: () => Promise<File | null> };

/** «vie 24/10/2026 · 07:12», as the server will burn it (its own clock decides the real one). */
function stampDateLine(now: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  const weekday = now.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${two(now.getDate())}/${two(now.getMonth() + 1)}/${now.getFullYear()} · ${two(now.getHours())}:${two(now.getMinutes())}`;
}

/**
 * The selfie of a signing on the web (pending 94, design e-32): the front
 * camera live in the form, the face guide, the GPS precision and the two
 * lines the server will burn into it. The form's button takes the frame.
 */
export const LiveSelfie = forwardRef<LiveSelfieHandle, { label: string; location: GeoPoint | null; error?: string; testId?: string }>(function LiveSelfie(props, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'asking' | 'live' | 'denied'>('asking');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    void navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then((opened) => {
      if (!alive) return opened.getTracks().forEach((track) => track.stop());
      stream = opened;
      if (video.current) video.current.srcObject = opened;
      setState('live');
    }).catch(() => alive && setState('denied'));
    if (!navigator.mediaDevices) setState('denied');
    return () => {
      alive = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useImperativeHandle(ref, () => ({
    capture: async () => {
      const element = video.current;
      if (!element || state !== 'live' || !element.videoWidth) return null;
      const canvas = document.createElement('canvas');
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      canvas.getContext('2d')?.drawImage(element, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      return blob ? new File([blob], 'selfie.jpg', { type: 'image/jpeg' }) : null;
    },
  }), [state]);
  const place = props.location ? `${props.location.lat.toFixed(COORD_DECIMALS)}, ${props.location.lng.toFixed(COORD_DECIMALS)} · ${precisionLabel(props.location)}` : 'Buscando tu ubicación…';
  return (
    <div data-testid={props.testId}>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{props.label}</p>
      <div className="relative aspect-[3/4] max-h-[380px] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {state === 'denied' ? <p className="absolute inset-0 grid place-items-center px-6 text-center text-[14px] text-white">Para marcar, la cámara tiene que estar prendida. Permite la cámara en el navegador.</p> : null}
        {state === 'live' ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-[62%] w-[55%] rounded-[50%] border-2 border-dashed border-white" />
            <span className="absolute bottom-[27%] rounded-full bg-black/60 px-3 py-1 text-[13px] text-white">Mira a la cámara</span>
          </div>
        ) : null}
        {props.location ? <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-en-linea px-2.5 py-1 text-[12px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />GPS {precisionLabel(props.location)}</span> : null}
        <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/70 px-3 py-2 font-mono text-[12px] text-white">
          <p className="flex items-center gap-2"><Clock size={13} />{stampDateLine(now)}</p>
          <p className="flex items-center gap-2"><MapPin size={13} />{place}</p>
        </div>
      </div>
      {props.error ? <p role="alert" className="mt-1 text-[13px] text-error">{props.error}</p> : null}
    </div>
  );
});
