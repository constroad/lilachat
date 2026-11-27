import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Mic, Play, Square } from 'lucide-react';
import { VIDEO_STICKER_MAX_MS } from '@lilachat/shared';
import { useGrabadoraDeVoz } from '../useGrabadoraDeVoz';
import { clipTime, releaseStopsRecording } from './videoSticker';

type Props = { voice: Blob | null; disabled: boolean; onVoice: (voice: Blob) => void; onNotice: (message: string) => void };

/** Plays the recorded voice once, from memory. */
function playBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play().catch((error: unknown) => {
    URL.revokeObjectURL(url);
    console.warn('[stickers] voice preview did not play:', error instanceof Error ? error.message : error);
  });
}

/**
 * «Grabar tu voz» (José 26/11, design ss-02): hold the button to talk and let
 * go, or tap to start and tap again to stop. It stops by itself at 6 s. The
 * microphone is asked for on the first press, never before.
 */
export function VoiceRecorder({ voice, disabled, onVoice, onNotice }: Props) {
  const recorder = useGrabadoraDeVoz();
  const holdStart = useRef<number | null>(null);
  const stopping = useRef(false);
  const [voiceMs, setVoiceMs] = useState(0);
  const recording = recorder.estado.fase === 'grabando';
  const elapsedMs = recorder.estado.fase === 'grabando' ? recorder.estado.ms : 0;

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    const note = await recorder.terminar();
    stopping.current = false;
    if (!note) return onNotice('Muy corto: graba al menos medio segundo.');
    setVoiceMs(Math.min(note.ms, VIDEO_STICKER_MAX_MS));
    onVoice(note.file);
  };
  useEffect(() => {
    if (recording && elapsedMs >= VIDEO_STICKER_MAX_MS) void stop();
  });

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    if (recording) {
      holdStart.current = null;
      return void stop();
    }
    holdStart.current = Date.now();
    void recorder.empezar();
  };
  const release = () => {
    const heldSince = holdStart.current;
    holdStart.current = null;
    if (recording && heldSince !== null && releaseStopsRecording(Date.now() - heldSince)) void stop();
  };
  // The keyboard (Enter or Space) has no press and release: it toggles.
  const keyboardToggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || disabled) return;
    if (recording) void stop();
    else void recorder.empezar();
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-background p-2">
      <button type="button" data-testid="grabar-voz-sticker" aria-pressed={recording} aria-label={recording ? 'Detener la grabación' : 'Grabar'} disabled={disabled} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onClick={keyboardToggle} className={`grid h-12 w-12 shrink-0 touch-none place-items-center rounded-full text-on-primary shadow-md disabled:opacity-60 ${recording ? 'animate-pulse bg-error' : 'bg-primary'}`}>
        {recording ? <Square size={18} className="fill-current" /> : <Mic size={20} />}
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-on-surface">{recording ? 'Grabando…' : voice ? 'Tu voz está lista' : 'Mantén para grabar'}</span>
        <span className="block font-mono text-[12px] text-on-surface-variant">{clipTime(recording ? elapsedMs : voiceMs)} / {clipTime(VIDEO_STICKER_MAX_MS)}</span>
      </span>
      {voice && !recording ? (
        <button type="button" data-testid="escuchar-voz-sticker" disabled={disabled} onClick={() => playBlob(voice)} className="flex h-8 items-center gap-1 rounded-full bg-primary/10 px-3 text-[12px] font-semibold text-primary disabled:opacity-60"><Play size={12} className="fill-current" /> Escuchar</button>
      ) : null}
      {recorder.estado.fase === 'error' ? <p role="alert" data-testid="error-microfono" className="basis-full text-[12px] text-error">{recorder.estado.motivo}</p> : null}
    </div>
  );
}
