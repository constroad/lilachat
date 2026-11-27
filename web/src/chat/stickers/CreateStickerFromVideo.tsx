import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Info, Loader2, Play, Save, SendHorizontal, Square } from 'lucide-react';
import type { LibrarySticker } from '@lilachat/shared';
import type { ApiResult } from '../../api';
import { Overlay } from '../../ui/Overlay';
import { stopWinkSounds } from '../winkSounds';
import type { VideoStickerRequest } from './stickersApi';
import { StickerSoundPicker } from './StickerSoundPicker';
import { VideoTrimStrip } from './VideoTrimStrip';
import { clipFileProblem, clipIsGif, clipSeconds, clipTime, GIF_TRIM, initialTrim, lostItsSound, soundPickForClip, soundRequestOf, trimLengthMs, type SoundPick, type TrimWindow } from './videoSticker';

type Phase = 'idle' | 'saving' | 'sending' | 'done';
type Props = {
  chatName: string;
  onClose: () => void;
  onSave: (request: VideoStickerRequest) => Promise<ApiResult<{ sticker: LibrarySticker }>>;
  onSend: (sticker: LibrarySticker) => Promise<boolean>;
  /** The video or GIF already chosen (under «Crear», or a chat's GIF): no second picker (design sc-01a). */
  initialClip?: File;
};

const MS_PER_SECOND = 1_000;
/** timeupdate fires a few times per second: a little slack before the start counts as outside the window. */
const LOOP_SLACK_MS = 100;
const CHECKERBOARD = 'bg-[conic-gradient(rgb(0_0_0/0.06)_25%,transparent_0_50%,rgb(0_0_0/0.06)_0_75%,transparent_0)] bg-[length:20px_20px]';

const usableClip = (file: File | undefined) => (file && !clipFileProblem(file) ? file : null);

/**
 * The chosen clip: its local URL, its length and the window the sticker keeps.
 * A GIF has no trim: it goes whole from its start (the server stops at 6 s).
 */
function useVideoClip(initialClip: File | undefined, onNotice: (message: string) => void) {
  const [video, setVideo] = useState<File | null>(() => usableClip(initialClip));
  const [videoUrl, setVideoUrl] = useState('');
  const [videoMs, setVideoMs] = useState(0);
  const [trim, setTrim] = useState<TrimWindow | null>(() => (video && clipIsGif(video) ? GIF_TRIM : null));
  useEffect(() => {
    if (!video) return undefined;
    const url = URL.createObjectURL(video);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);
  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = clipFileProblem(file);
    if (problem) return onNotice(problem);
    onNotice('');
    setVideo(file);
    setVideoMs(0);
    setTrim(clipIsGif(file) ? GIF_TRIM : null);
  };
  const loaded = (durationSeconds: number) => {
    const ms = Math.round(durationSeconds * MS_PER_SECOND);
    const first = initialTrim(ms);
    if (!first) return onNotice(Number.isFinite(ms) && ms > 0 ? 'Ese video dura menos de medio segundo.' : 'No se pudo leer ese video: prueba con otro.');
    setVideoMs(ms);
    setTrim(first);
  };
  return { video, videoUrl, videoMs, trim, setTrim, pick, loaded, isGif: video ? clipIsGif(video) : false };
}

/**
 * Saving (and sending) the sticker: the server converts it, a refusal comes back
 * as it is, and «Enviar» after a «Guardar» reuses the sticker already saved.
 */
function useSaveVideoSticker(props: Props, setNotice: (message: string) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [saved, setSaved] = useState<LibrarySticker | null>(null);
  const [info, setInfo] = useState('');
  const persist = async (request: VideoStickerRequest): Promise<LibrarySticker | null> => {
    if (saved) return saved;
    const response = await props.onSave(request);
    if (!response.ok) {
      setNotice(response.message);
      return null;
    }
    setSaved(response.data.sticker);
    return response.data.sticker;
  };
  const finish = async (request: VideoStickerRequest, alsoSend: boolean) => {
    setNotice('');
    setInfo('');
    setPhase(alsoSend ? 'sending' : 'saving');
    const sticker = await persist(request);
    if (!sticker) return setPhase('idle');
    if (alsoSend && !(await props.onSend(sticker))) {
      setNotice('Se guardó en Mis stickers, pero no se pudo mandar.');
      return setPhase('idle');
    }
    if (!lostItsSound(request.sound, sticker)) return props.onClose();
    setInfo(alsoSend ? 'El video no tenía sonido: se envió sin sonido.' : 'El video no tenía sonido: se guardó en Mis stickers sin sonido.');
    setPhase(alsoSend ? 'done' : 'idle');
  };
  return { phase, info, finish, forget: () => setSaved(null), busy: phase === 'saving' || phase === 'sending' };
}

/**
 * «Crear sticker desde un video» (José 26/11, design ss-04), like the
 * stickers with sound WhatsApp started on 25/11: a window of up to 6 s of the
 * video, and its sound (the video's, a voice, an audio, one of ours or none).
 * A GIF goes the same way, whole and without a sound of its own (design
 * sc-01a). The server converts it; «Enviar» saves it first and then sends it here.
 */
export function CreateStickerFromVideo(props: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState(() => (props.initialClip ? (clipFileProblem(props.initialClip) ?? '') : ''));
  const clip = useVideoClip(props.initialClip, setNotice);
  const [pick, setPick] = useState<SoundPick>({ kind: 'original' });
  const sound = soundPickForClip(pick, !clip.isGif);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const { phase, info, finish, forget, busy } = useSaveVideoSticker(props, setNotice);

  // Without a clip already chosen, the file picker opens by itself: the click that opened this still counts as a gesture.
  useEffect(() => {
    if (!props.initialClip) videoInput.current?.click();
  }, []);
  useEffect(() => stopWinkSounds, []);
  // Anything changed after saving makes a new sticker.
  useEffect(forget, [clip.video, clip.trim, pick, voice, upload]);

  const submit = (alsoSend: boolean) => {
    if (!clip.video || !clip.trim) return setNotice('Elige un video o un GIF.');
    const request = soundRequestOf(sound, voice, upload);
    if ('problem' in request) return setNotice(request.problem);
    void finish({ video: clip.video, trim: clip.trim, ...request }, alsoSend);
  };
  const close = busy ? () => undefined : props.onClose;
  const ready = Boolean(clip.trim) && !busy;
  const title = clip.isGif ? 'Crear sticker desde un GIF' : 'Crear sticker desde un video';
  return (
    <Overlay title={title} wide onClose={close} header={<Heading title={title} />} footer={<Footer phase={phase} ready={ready} chatName={props.chatName} onCancel={close} onSave={() => submit(false)} onSend={() => submit(true)} />}>
      {/* gates-allow: camara the video or GIF is only the source of a 512 sticker the server cuts: no stamp, no chat compression */}
      <input ref={videoInput} type="file" accept="video/*,image/gif" hidden data-testid="input-video-sticker" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; clip.pick(file); }} />
      <div data-testid="crear-sticker-video" className="grid gap-4 sm:grid-cols-2">
        <div>
          <ClipPreview videoUrl={clip.videoUrl} isGif={clip.isGif} trim={clip.trim} canHear={sound.kind === 'original'} disabled={busy} onLoaded={clip.loaded} onError={() => setNotice('No se pudo leer ese archivo: prueba con otro.')} onPickVideo={() => videoInput.current?.click()} />
          <ClipLength trim={clip.trim} isGif={clip.isGif} />
        </div>
        <div className="flex flex-col gap-4">
          {clip.trim && !clip.isGif ? <TrimSection videoMs={clip.videoMs} trim={clip.trim} disabled={busy} onChange={clip.setTrim} /> : null}
          <StickerSoundPicker pick={sound} hasOwnSound={!clip.isGif} clipMs={clip.trim ? trimLengthMs(clip.trim) : 0} voice={voice} upload={upload} disabled={busy} onPick={setPick} onVoice={setVoice} onUpload={setUpload} onNotice={setNotice} />
        </div>
      </div>
      <Status busy={busy} notice={notice} info={info} />
    </Overlay>
  );
}

/** How long the sticker lasts; a GIF goes whole from its start (its length is the server's to read). */
function ClipLength({ trim, isGif }: { trim: TrimWindow | null; isGif: boolean }) {
  if (isGif) return <p data-testid="gif-entero-sticker" className="mt-2 text-[13px] text-on-surface-variant">El GIF va completo desde el inicio, hasta 6 segundos.</p>;
  if (!trim) return null;
  return (
    <p className="mt-2 flex items-center justify-between text-[13px] text-on-surface-variant">
      Duración del sticker <span data-testid="duracion-sticker-video" className="font-mono font-semibold text-primary">{clipSeconds(trimLengthMs(trim))} segundos</span>
    </p>
  );
}

function TrimSection({ videoMs, trim, disabled, onChange }: { videoMs: number; trim: TrimWindow; disabled: boolean; onChange: (trim: TrimWindow) => void }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">
        Recorte del video <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] normal-case tracking-normal text-primary">{clipSeconds(trimLengthMs(trim))} s seleccionados</span>
      </h3>
      <VideoTrimStrip videoMs={videoMs} trim={trim} disabled={disabled} onChange={onChange} />
    </section>
  );
}

function Heading({ title }: { title: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Sticker en movimiento</p>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
    </div>
  );
}

/** Converting takes seconds: a moving bar; a refusal of the server is shown as it comes. */
function Status({ busy, notice, info }: { busy: boolean; notice: string; info: string }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {busy ? (
        <div data-testid="progreso-sticker-video" role="status" className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-on-surface"><Loader2 size={15} className="animate-spin text-primary" /> Convirtiendo… tarda unos segundos.</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-primary/15"><span className="block h-full w-full animate-pulse rounded-full bg-primary" /></span>
        </div>
      ) : null}
      {notice ? <p role="alert" data-testid="aviso-sticker-video" className="text-[13px] text-error">{notice}</p> : null}
      {info ? <p role="status" data-testid="info-sticker-video" className="text-[13px] font-semibold text-on-surface">{info}</p> : null}
      <p className="flex items-start gap-2 rounded-xl border border-outline/15 bg-background p-3 text-[12px] text-on-surface-variant">
        <Info size={15} className="mt-0.5 shrink-0 text-primary" />
        <span>Toca <b className="text-on-surface">Guardar en Mis stickers</b> para usarlo en otros chats, o elige <b className="text-on-surface">Enviar</b> para mandarlo a este chat.</span>
      </p>
    </div>
  );
}

type PreviewProps = { videoUrl: string; isGif: boolean; trim: TrimWindow | null; canHear: boolean; disabled: boolean; onLoaded: (durationSeconds: number) => void; onError: () => void; onPickVideo: () => void };

/** The chosen window plays over and over, muted; with «Sonido original» it can be heard. */
function ClipPreview({ videoUrl, isGif, trim, canHear, disabled, onLoaded, onError, onPickVideo }: PreviewProps) {
  const player = useRef<HTMLVideoElement>(null);
  const [hearing, setHearing] = useState(false);
  const startMs = trim?.startMs ?? 0;
  const endMs = trim?.endMs ?? 0;
  const restart = () => {
    const element = player.current;
    if (!element) return;
    element.currentTime = startMs / MS_PER_SECOND;
    element.play()?.catch((error: unknown) => console.warn('[stickers] video preview did not play:', error instanceof Error ? error.message : error));
  };
  // The preview starts over each time the window moves.
  useEffect(() => {
    if (endMs > 0) restart();
  }, [startMs, endMs]);
  useEffect(() => {
    if (!canHear) setHearing(false);
  }, [canHear]);
  useEffect(() => {
    if (player.current) player.current.muted = !hearing;
  }, [hearing]);
  const keepInWindow = () => {
    const atMs = (player.current?.currentTime ?? 0) * MS_PER_SECOND;
    if (trim && (atMs >= endMs || atMs < startMs - LOOP_SLACK_MS)) restart();
  };
  const toggleHearing = () => {
    setHearing((before) => !before);
    restart();
  };
  return (
    <div className={`relative mx-auto grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden rounded-xl border border-outline/15 ${CHECKERBOARD}`}>
      {videoUrl && isGif ? (
        // A <video> cannot play a GIF: it is an image, and it loops by itself.
        <img data-testid="gif-sticker-preview" src={videoUrl} alt="" onError={onError} className="h-full w-full object-contain" />
      ) : videoUrl ? (
        <video ref={player} data-testid="video-sticker-preview" src={videoUrl} muted playsInline autoPlay onLoadedMetadata={(event) => onLoaded(event.currentTarget.duration)} onError={onError} onTimeUpdate={keepInWindow} onEnded={restart} className="h-full w-full object-contain" />
      ) : (
        <button type="button" data-testid="elegir-video-sticker" onClick={onPickVideo} className="flex flex-col items-center gap-2 text-sm text-on-surface-variant"><Clapperboard size={28} /> Elige un video o un GIF</button>
      )}
      {videoUrl ? <button type="button" data-testid="cambiar-video-sticker" disabled={disabled} onClick={onPickVideo} className="absolute right-2 top-2 rounded-full border border-outline/15 bg-surface px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50">Cambiar</button> : null}
      {trim && canHear ? (
        <button type="button" data-testid="escuchar-original-sticker" aria-pressed={hearing} aria-label={hearing ? 'Silenciar el video' : 'Escuchar el sonido original'} onClick={toggleHearing} className="absolute bottom-2 right-2 flex h-8 items-center gap-1 rounded-full border border-outline/15 bg-surface px-3 font-mono text-[13px] font-semibold text-primary shadow-sm">
          {hearing ? <Square size={11} className="fill-current" /> : <Play size={12} className="fill-current" />} {clipTime(endMs - startMs)}
        </button>
      ) : null}
    </div>
  );
}

type FooterProps = { phase: Phase; ready: boolean; chatName: string; onCancel: () => void; onSave: () => void; onSend: () => void };

function Footer({ phase, ready, chatName, onCancel, onSave, onSend }: FooterProps) {
  if (phase === 'done') {
    return <div className="flex justify-end"><button type="button" data-testid="listo-sticker-video" onClick={onCancel} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary">Listo</button></div>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={phase === 'saving' || phase === 'sending'} onClick={onCancel} className="h-10 rounded-lg border border-outline/20 px-4 text-sm font-semibold text-on-surface hover:bg-background disabled:opacity-50">Cancelar</button>
      <span className="mr-auto hidden min-w-0 truncate text-[12px] text-on-surface-variant sm:inline">Para: <b className="text-on-surface">{chatName}</b></span>
      <button type="button" data-testid="guardar-sticker-video" disabled={!ready} onClick={onSave} className="flex h-10 items-center gap-2 rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
        {phase === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar en Mis stickers
      </button>
      <button type="button" data-testid="enviar-sticker-video" disabled={!ready} onClick={onSend} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
        {phase === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <SendHorizontal size={15} />} Enviar
      </button>
    </div>
  );
}
