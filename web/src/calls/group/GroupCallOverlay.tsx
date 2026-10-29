import { useCallback, useEffect, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Users, Video, VideoOff } from 'lucide-react';
import { groupCallBanner, gridOf, type GroupCallRoom } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import type { WebGroupCall } from './useWebGroupCall';

/** «2 personas · 04:12», like the phone's (`groupCallView.ts`). */
export function groupCaption(count: number, seconds: number | null): string {
  const people = `${count} ${count === 1 ? 'persona' : 'personas'}`;
  if (seconds === null) return `${people} · Conectando…`;
  return `${people} · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function useSecondsSince(startedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? null : Math.max(0, Math.floor((now - startedAt) / 1000));
}

function Tile(props: { name: string; stream: MediaStream | null; mine: boolean; video: boolean }) {
  // A callback ref, like `CallOverlay`: `srcObject` does not go through JSX.
  const attach = useCallback((element: HTMLMediaElement | null) => {
    if (element && element.srcObject !== props.stream) element.srcObject = props.stream;
  }, [props.stream]);
  const hasVideo = props.video && Boolean(props.stream?.getVideoTracks().some((track) => track.enabled));
  return (
    <div data-testid={props.mine ? 'mosaico-yo' : 'mosaico'} className="relative grid min-h-0 place-items-center overflow-hidden rounded-xl bg-on-surface/80">
      {props.mine ? null : <audio ref={attach} autoPlay />}
      {hasVideo ? <video ref={attach} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${props.mine ? '[transform:scaleX(-1)]' : ''}`} /> : <Avatar name={props.name} size={72} />}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-on-surface/70 px-2.5 py-0.5 text-[12px] font-semibold text-background">{props.name}</span>
    </div>
  );
}

function RoundButton(props: { testId: string; label: string; danger?: boolean; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  const tone = props.danger ? 'bg-error text-background' : props.pressed ? 'bg-on-surface text-background' : 'bg-surface-variant text-on-surface';
  return (
    <button type="button" data-testid={props.testId} aria-label={props.label} title={props.label} aria-pressed={props.pressed} onClick={props.onClick} className={`grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95 ${tone}`}>
      {props.children}
    </button>
  );
}

/** The group call window (pending 56): up to 2×2 tiles and the same round controls as the 1:1. */
export function GroupCallOverlay(props: { group: WebGroupCall; me: string }) {
  const { group } = props;
  const seconds = useSecondsSince(group.call?.startedAt ?? null);
  if (!group.call) return null;
  const { call } = group;
  const others = call.participants.filter((userId) => userId !== props.me);
  const tiles = [{ key: props.me, name: 'Tú', stream: group.localStream, mine: true }, ...others.map((userId) => ({ key: userId, name: group.names[userId] || 'Participante', stream: group.streams.get(userId) ?? null, mine: false }))];
  const { columns } = gridOf(tiles.length);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-on-surface/50 p-4" data-testid="pantalla-llamada-grupal">
      <div role="dialog" aria-label={`Llamada grupal en ${call.chatName}`} className="flex h-[min(680px,calc(100dvh-32px))] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-outline/15 bg-surface shadow-2xl">
        <div className="flex flex-col items-center gap-0.5 px-6 pb-3 pt-5 text-center">
          <h2 className="max-w-full truncate text-xl font-bold">{call.chatName}</h2>
          <p data-testid="leyenda-llamada-grupal" role="status" className="text-sm tabular-nums text-on-surface-variant">{groupCaption(call.participants.length, seconds)}</p>
        </div>
        <div className="grid min-h-0 flex-1 gap-2 px-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {tiles.map((tile) => <Tile key={tile.key} name={tile.name} stream={tile.stream} mine={tile.mine} video={call.video && (!tile.mine || group.cameraOn)} />)}
        </div>
        <div className="mx-4 my-4 flex items-center justify-center gap-4 rounded-3xl border border-outline/15 bg-background px-4 py-3">
          {call.video ? (
            <RoundButton testId="btn-camara-grupal" label={group.cameraOn ? 'Apagar la cámara' : 'Prender la cámara'} pressed={!group.cameraOn} onClick={group.toggleCamera}>{group.cameraOn ? <Video size={22} /> : <VideoOff size={22} />}</RoundButton>
          ) : null}
          <RoundButton testId="btn-silenciar-grupal" label={group.muted ? 'Activar el micrófono' : 'Silenciar'} pressed={group.muted} onClick={group.toggleMute}>{group.muted ? <MicOff size={22} /> : <Mic size={22} />}</RoundButton>
          <RoundButton testId="btn-colgar-grupal" label="Salir de la llamada" danger onClick={group.leave}><PhoneOff size={24} /></RoundButton>
        </div>
      </div>
    </div>
  );
}

/** Someone started a call in one of my groups: join or ignore, in a corner, without covering the chat. */
export function GroupRingCard(props: { title: string; subtitle: string; video: boolean; onJoin: () => void; onIgnore: () => void }) {
  return (
    <div data-testid="aviso-llamada-grupal" role="alertdialog" aria-label={props.title} className="fixed right-4 top-4 z-50 flex w-[min(380px,calc(100vw-32px))] items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-3 shadow-2xl">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-en-linea/15 text-en-linea"><Users size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{props.title}</span>
        <span className="block text-[13px] text-on-surface-variant">{props.subtitle}</span>
      </span>
      <RoundButton testId="btn-ignorar-llamada-grupal" label="Ignorar" danger onClick={props.onIgnore}><PhoneOff size={20} /></RoundButton>
      <button type="button" data-testid="btn-unirse-llamada-grupal" aria-label="Unirse" title="Unirse" onClick={props.onJoin} className="grid h-14 w-14 place-items-center rounded-full bg-en-linea text-background">{props.video ? <Video size={20} /> : <Phone size={20} />}</button>
    </div>
  );
}

/** Over a group chat while its call goes on: who is in it, and «Unirse». */
export function GroupCallStrip(props: { room: GroupCallRoom | null; me: string; busy: boolean; onJoin: () => void }) {
  const banner = groupCallBanner(props.room, props.me);
  if (!banner) return null;
  return (
    <div data-testid="franja-llamada-grupal" className="flex items-center gap-3 border-b border-outline/15 bg-en-linea/10 px-4 py-2">
      <Users size={18} className="text-en-linea" />
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{banner.text}</span>
      {banner.canJoin && !props.busy ? (
        <button type="button" data-testid="btn-unirse-franja" onClick={props.onJoin} className="rounded-full bg-en-linea px-4 py-1.5 text-[14px] font-bold text-background">Unirse</button>
      ) : null}
    </div>
  );
}
