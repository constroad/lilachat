import { Pause, Play, X } from 'lucide-react';
import { nextPlaybackRate, nowPlayingLabel, nowPlayingProgress, showsNowPlayingBar } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { setVoiceNoteRate, stopVoiceNote, toggleVoiceNote, useNowPlaying } from './voicePlayer';

/**
 * A voice note keeps playing in another chat, with this bar on top of the
 * list, like the app's (backlog 34; design `a-02-audio-en-curso`): who, how
 * far, the speed, pause and the X. Clicking it goes back to its chat.
 */
export function NowPlayingBar(props: { openChatId: string | null; onOpen: (chatId: string) => void }) {
  const now = useNowPlaying();
  if (!now || !showsNowPlayingBar(now, props.openChatId)) return null;
  return (
    <div data-testid="barra-audio-en-curso" className="border-y border-outline/10 bg-primary/[0.06]">
      <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
        <button type="button" data-testid="barra-audio-abrir" onClick={() => props.onOpen(now.chatId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={now.authorName} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{now.authorName}</span>
            <span className="block truncate text-[12px] tabular-nums text-on-surface-variant">{nowPlayingLabel(now)}</span>
          </span>
        </button>
        <button type="button" data-testid="barra-audio-velocidad" onClick={() => setVoiceNoteRate(nextPlaybackRate(now.rate))} className="rounded-full border border-outline/20 bg-surface px-2.5 py-1 text-[12px] font-bold tabular-nums text-primary">
          {`${String(now.rate).replace('.', ',')}×`}
        </button>
        <button type="button" data-testid="barra-audio-pausa" aria-label={now.playing ? 'Pausar' : 'Reproducir'} onClick={toggleVoiceNote} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary">
          {now.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" data-testid="barra-audio-cerrar" aria-label="Cerrar" title="Cerrar" onClick={stopVoiceNote} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <X size={18} />
        </button>
      </div>
      <div className="h-[2px] bg-primary/15">
        <div className="h-full bg-primary" style={{ width: `${nowPlayingProgress(now) * 100}%` }} />
      </div>
    </div>
  );
}
