import { useEffect, useState } from 'react';
import { Check, RefreshCw, RotateCcw, X } from 'lucide-react';
import { precisionLabel, recordingLabel, type GeoPoint, type Timemark } from '@lilachat/shared';
import { useWebCameraAsk, type WebCameraAsk } from './cameraRequests';
import { frameOf, useCameraStream, useWebLiveStamp, useWebRecorder, type CameraMode } from './useWebCamera';
import { shotNameOf, withStamp } from './shotStamp';
import { useCurrentSpaceLogo } from '../../spaces/currentSpace';

const LOGO_KEY = 'lilachat.camara.logo';
const MS_PER_SECOND = 1000;
type Taken = { blob: Blob; url: string; takenAt: string; seconds?: number };

function readLogoPref(): boolean {
  try {
    return localStorage.getItem(LOGO_KEY) !== '0';
  } catch {
    return true;
  }
}

function saveLogoPref(on: boolean): void {
  try {
    localStorage.setItem(LOGO_KEY, on ? '1' : '0');
  } catch {
    // A private window keeps no preference: the chip still works for this shot.
  }
}

/** Mounted once beside the shell: it opens when someone asks for a shot. */
export function WebCameraHost() {
  const ask = useWebCameraAsk();
  return ask ? <WebCamera ask={ask} onDone={ask.finish} /> : null;
}

/**
 * The camera of the web on a phone (José 12/11, designs cam-01/03/04/05/06): the APK's camera in a
 * browser. The stamp shows live (hour, date, weekday and address, never the person's name), the
 * shot is reviewed before it is used, and the server burns the same stamp once while it compresses.
 */
export function WebCamera(props: { ask: WebCameraAsk; onDone: (file: File | null) => void }) {
  const [mode, setMode] = useState<CameraMode>(props.ask.video?.first ? 'video' : 'picture');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [logo, setLogo] = useState(readLogoPref);
  const spaceLogo = useCurrentSpaceLogo();
  const [taken, setTaken] = useState<Taken | null>(null);
  const camera = useCameraStream(mode, facing);
  const live = useWebLiveStamp();
  const recorder = useWebRecorder(camera.stream, props.ask.video?.maxSeconds ?? 0);
  useEffect(() => () => void (taken && URL.revokeObjectURL(taken.url)), [taken]);
  const keep = (blob: Blob, takenAt: string, seconds?: number) => setTaken({ blob, url: URL.createObjectURL(blob), takenAt, ...(seconds ? { seconds } : {}) });
  const shoot = async () => {
    const takenAt = new Date().toISOString();
    if (mode === 'picture') {
      const blob = camera.video.current ? await frameOf(camera.video.current) : null;
      return blob && keep(blob, takenAt);
    }
    if (recorder.recording) return recorder.stop();
    const began = Date.now();
    const blob = await recorder.start();
    if (blob) keep(blob, takenAt, Math.round((Date.now() - began) / MS_PER_SECOND));
  };
  const use = () => {
    if (!taken) return;
    const file = new File([taken.blob], shotNameOf(taken.blob.type, Date.now()), { type: taken.blob.type.split(';')[0] });
    props.onDone(withStamp(file, { timemark: true, point: live.point, logo, takenAt: taken.takenAt }));
  };
  const clock = recorder.recording ? recordingLabel(recorder.elapsedMs, props.ask.video?.maxSeconds) : null;
  return (
    <div data-testid="camara-web" role="dialog" aria-label={props.ask.title} className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <ShotOrLive camera={camera} taken={taken} facing={facing} />
      <TopBar title={props.ask.title} clock={clock} onClose={() => props.onDone(null)} />
      {taken || recorder.recording || camera.state !== 'live' ? null : <Chips point={live.point} logo={logo} onLogo={() => (saveLogoPref(!logo), setLogo(!logo))} />}
      {logo && spaceLogo && camera.state !== 'denied' ? <img data-testid="sello-logo" src={spaceLogo} alt="" className="pointer-events-none absolute right-4 top-[calc(max(12px,env(safe-area-inset-top))+104px)] h-16 w-16 rounded-xl object-cover" /> : null}
      {camera.state === 'denied' ? <Denied onClose={() => props.onDone(null)} /> : <StampOverlay stamp={live.stamp} lifted={Boolean(props.ask.video) && !taken} />}
      {taken ? <ReviewBar video={taken.blob.type.startsWith('video/')} onRetake={() => setTaken(null)} onUse={use} /> : null}
      {taken || camera.state === 'denied' ? null : <ShutterBar mode={mode} canVideo={Boolean(props.ask.video)} recording={recorder.recording} onMode={setMode} onShoot={() => void shoot()} onFlip={() => setFacing(facing === 'environment' ? 'user' : 'environment')} />}
    </div>
  );
}

function ShotOrLive(props: { camera: ReturnType<typeof useCameraStream>; taken: Taken | null; facing: 'environment' | 'user' }) {
  const mirror = props.facing === 'user' ? '-scale-x-100' : '';
  return (
    <div className="absolute inset-0">
      <video ref={props.camera.video} autoPlay playsInline muted className={`h-full w-full object-cover ${mirror} ${props.taken ? 'hidden' : ''}`} />
      {props.taken?.blob.type.startsWith('video/') ? <video data-testid="revision-video" src={props.taken.url} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : null}
      {props.taken && !props.taken.blob.type.startsWith('video/') ? <img data-testid="revision-foto" src={props.taken.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
    </div>
  );
}

function TopBar(props: { title: string; clock: string | null; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-3 pt-[max(12px,env(safe-area-inset-top))]">
      <button type="button" data-testid="cerrar-camara" aria-label="Cerrar la cámara" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full bg-black/45"><X size={22} /></button>
      <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">
        {props.clock ? <span className="inline-flex items-center gap-2 rounded-full border border-red-500 bg-black/55 px-3 py-1 tabular-nums"><span className="h-2 w-2 rounded-full bg-red-600" />{props.clock}</span> : props.title}
      </p>
      <span className="h-11 w-11" />
    </div>
  );
}

function Chips(props: { point: GeoPoint | null; logo: boolean; onLogo: () => void }) {
  return (
    <div className="absolute inset-x-0 top-[calc(max(12px,env(safe-area-inset-top))+56px)] flex justify-center gap-2">
      <button type="button" data-testid="chip-logo" aria-pressed={props.logo} onClick={props.onLogo} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${props.logo ? 'bg-white text-black' : 'bg-black/45 text-white'}`}>Logo</button>
      {props.point ? <span className="flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3 text-[13px] font-semibold"><span className="h-2 w-2 rounded-full bg-en-linea" />GPS {precisionLabel(props.point)}</span> : null}
    </div>
  );
}

/** Bottom left, above the controls: the same lines the server burns. */
function StampOverlay(props: { stamp: Timemark; lifted: boolean }) {
  return (
    <div data-testid="sello-en-vivo" className={`pointer-events-none absolute left-4 right-4 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)] ${props.lifted ? 'bottom-[200px]' : 'bottom-[150px]'}`}>
      <div className="flex items-center gap-3">
        <span className="text-[44px] font-bold leading-none tabular-nums">{props.stamp.hour}</span>
        <span className="w-1 self-stretch rounded bg-primary" />
        <span className="text-[15px] leading-tight"><b>{props.stamp.date}</b><br /><span className="opacity-85">{props.stamp.weekday}</span></span>
      </div>
      {props.stamp.address ? <p className="mt-1 truncate text-[15px] font-semibold">{props.stamp.address}</p> : null}
      {props.stamp.coords ? <p className="truncate text-[12px] opacity-85">{props.stamp.coords}</p> : null}
    </div>
  );
}

function ShutterBar(props: { mode: CameraMode; canVideo: boolean; recording: boolean; onMode: (mode: CameraMode) => void; onShoot: () => void; onFlip: () => void }) {
  const label = props.mode === 'video' ? (props.recording ? 'Detener el video' : 'Grabar video') : 'Tomar la foto';
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
      {props.canVideo && !props.recording ? (
        <div role="tablist" className="flex gap-6 text-[15px] font-bold tracking-widest">
          {(['picture', 'video'] as const).map((mode) => <button key={mode} type="button" role="tab" data-testid={`modo-${mode}`} aria-selected={props.mode === mode} onClick={() => props.onMode(mode)} className={props.mode === mode ? 'opacity-100' : 'opacity-55'}>{mode === 'picture' ? 'FOTO' : 'VIDEO'}</button>)}
        </div>
      ) : null}
      <div className="flex w-full items-center justify-around">
        <span className="h-12 w-12" />
        <button type="button" data-testid="disparador" aria-label={label} onClick={props.onShoot} className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white">
          <span className={props.recording ? 'h-7 w-7 rounded-md bg-red-600' : `h-[60px] w-[60px] rounded-full ${props.mode === 'video' ? 'bg-red-600' : 'bg-white'}`} />
        </button>
        {props.recording ? <span className="h-12 w-12" /> : <button type="button" data-testid="girar-camara" aria-label="Cambiar de cámara" onClick={props.onFlip} className="grid h-12 w-12 place-items-center rounded-full bg-black/45"><RefreshCw size={22} /></button>}
      </div>
    </div>
  );
}

function ReviewBar(props: { video: boolean; onRetake: () => void; onUse: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex gap-3 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
      <button type="button" data-testid="repetir-toma" onClick={props.onRetake} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white text-[16px] font-bold"><RotateCcw size={20} />Repetir</button>
      <button type="button" data-testid="usar-toma" onClick={props.onUse} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-on-primary"><Check size={20} />{props.video ? 'Usar video' : 'Usar foto'}</button>
    </div>
  );
}

function Denied(props: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-8 text-center">
      <div>
        <p className="text-[16px]">Para tomar la foto, la cámara tiene que estar prendida. Permite la cámara en el navegador.</p>
        <button type="button" onClick={props.onClose} className="mt-4 h-12 rounded-2xl bg-white px-6 text-[15px] font-bold text-black">Cerrar</button>
      </div>
    </div>
  );
}
