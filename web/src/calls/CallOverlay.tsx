import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { callCaption } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import type { WebCall } from './useWebCall';

const CLOCK_TICK_MS = 1_000;

/** The second hand of the call clock, only while it is active. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

/**
 * A stream into a media element: `srcObject` cannot go through JSX. A callback
 * ref, not an effect: the other's video arrives while it rings and its element
 * mounts only on answering; an effect on `[stream]` never saw that element
 * (in the E2E the web got the phone's video and showed black).
 */
function useStreamRef(stream: MediaStream | null) {
  return useCallback((element: HTMLMediaElement | null) => {
    if (element && element.srcObject !== stream) element.srcObject = stream;
  }, [stream]);
}

function RoundButton(props: { testId: string; label: string; tone: 'answer' | 'end' | 'plain'; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  const tones = { answer: 'bg-en-linea text-background', end: 'bg-error text-background', plain: props.pressed ? 'bg-on-surface text-background' : 'bg-surface-variant text-on-surface' };
  return (
    <button type="button" data-testid={props.testId} aria-label={props.label} title={props.label} aria-pressed={props.pressed} onClick={props.onClick} className={`grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95 ${tones[props.tone]}`}>
      {props.children}
    </button>
  );
}

/**
 * The call window over the web (José, 21/10), like WhatsApp Web's: who and
 * how it goes, the video when there is one, and the controls. Esc does not
 * hang up: a call is not closed by accident.
 */
export function CallOverlay({ call }: { call: WebCall }) {
  const { state, session, media, muted, cameraOn, localStream, remoteStream, error } = call;
  const active = state?.fase === 'activa';
  const now = useNow(active);
  const remoteMedia = useStreamRef(remoteStream);
  const localVideo = useStreamRef(localStream);
  if (!state || !session) return null;
  const showVideo = session.videoCall && (active || state.fase === 'llamando');
  const caption = error ?? callCaption({ state, media, video: session.videoCall, now });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-on-surface/50 p-4" data-testid="pantalla-llamada">
      <div role="dialog" aria-label={`Llamada con ${session.peerName}`} className="relative flex h-[min(620px,calc(100dvh-32px))] w-full max-w-[440px] flex-col items-center overflow-hidden rounded-2xl border border-outline/15 bg-surface shadow-2xl">
        <audio ref={remoteMedia} autoPlay />
        {showVideo ? (
          <>
            <video ref={remoteMedia} autoPlay playsInline muted className="absolute inset-0 h-full w-full bg-on-surface object-cover" />
            <video ref={localVideo} autoPlay playsInline muted data-testid="video-propio" className={`absolute bottom-28 right-4 h-28 w-20 rounded-lg border border-outline/20 bg-on-surface object-cover [transform:scaleX(-1)] ${cameraOn ? '' : 'invisible'}`} />
          </>
        ) : null}
        <div className={`relative mt-16 flex flex-col items-center gap-3 px-6 text-center ${showVideo ? 'rounded-xl bg-surface/80 py-3' : ''}`}>
          {showVideo ? null : <Avatar name={session.peerName} size={112} />}
          <h2 className="max-w-full truncate text-2xl font-bold">{session.peerName}</h2>
          <p data-testid="leyenda-llamada" role="status" className={`text-sm ${error ? 'text-error' : 'text-on-surface-variant'} tabular-nums`}>{caption}</p>
        </div>
        <div className="relative mt-auto mb-8 flex items-center gap-5">
          {state.fase === 'sonando' ? (
            <>
              <RoundButton testId="btn-rechazar-llamada" label="Rechazar" tone="end" onClick={call.hangUp}><PhoneOff size={24} /></RoundButton>
              <RoundButton testId="btn-contestar-llamada" label="Contestar" tone="answer" onClick={() => void call.answer()}>{session.videoCall ? <Video size={24} /> : <Phone size={24} />}</RoundButton>
            </>
          ) : state.fase === 'terminada' ? null : (
            <>
              <RoundButton testId="btn-silenciar" label={muted ? 'Activar micrófono' : 'Silenciar'} tone="plain" pressed={muted} onClick={call.toggleMute}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</RoundButton>
              {session.videoCall && localStream?.getVideoTracks().length ? (
                <RoundButton testId="btn-camara" label={cameraOn ? 'Apagar cámara' : 'Encender cámara'} tone="plain" pressed={!cameraOn} onClick={call.toggleCamera}>{cameraOn ? <Video size={22} /> : <VideoOff size={22} />}</RoundButton>
              ) : null}
              <RoundButton testId="btn-colgar" label="Colgar" tone="end" onClick={call.hangUp}><PhoneOff size={24} /></RoundButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
