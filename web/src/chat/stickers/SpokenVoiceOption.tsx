import { useState } from 'react';
import { AudioLines, Play } from 'lucide-react';
import { MAX_VOICE_TEXT, STICKER_VOICES, voiceTextOf, type StickerVoiceId } from '@lilachat/shared';
import { SoundOption } from './SoundOption';
import type { StickerVoiceDoor } from './stickerVoiceDoor';
import type { SoundPick, SpokenPick } from './videoSticker';

type Props = { pick: SoundPick | null; door: StickerVoiceDoor; disabled: boolean; onPick: (pick: SoundPick) => void; onNotice: (message: string) => void };

/** Plays what «Escuchar» brought, and lets its address go when it ends. */
function playOnce(audio: Blob): void {
  const url = URL.createObjectURL(audio);
  const player = new Audio(url);
  player.onended = () => URL.revokeObjectURL(url);
  void player.play()?.catch(() => URL.revokeObjectURL(url));
}

/**
 * «Voz» (José 27/11, design sv-01): a phrase said by Valeria or Daniel, latino neutro, only for an admin of the space
 * (Voice Studio is one machine). «Escuchar» asks for it first; when it is not available it says so and can be retried.
 */
export function SpokenVoiceOption({ pick, door, disabled, onPick, onNotice }: Props) {
  const [listening, setListening] = useState(false);
  const spoken: SpokenPick | null = pick?.kind === 'spoken' ? pick : null;
  const choose = (change: Partial<Pick<SpokenPick, 'voiceId' | 'text'>>) =>
    onPick({ kind: 'spoken', voiceId: change.voiceId ?? spoken?.voiceId ?? 'valeria', text: change.text ?? spoken?.text ?? '', spaceId: door.spaceId });
  const listen = async () => {
    const text = spoken ? voiceTextOf(spoken.text) : null;
    if (!spoken || !text) return;
    setListening(true);
    const heard = await door.listen(spoken.voiceId, text);
    setListening(false);
    if (heard.ok) playOnce(heard.audio);
    else onNotice(heard.message);
  };
  return (
    <SoundOption testId="sonido-voz" icon={<AudioLines size={17} />} title="Voz" badge="Solo admins" hint="Una frase dicha por Valeria o Daniel" checked={Boolean(spoken)} disabled={disabled} onSelect={() => choose({})}>
      {spoken ? (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Escribe la frase <span data-testid="voz-contador" className="font-normal tracking-normal">{spoken.text.length}/{MAX_VOICE_TEXT}</span></span>
            <textarea data-testid="voz-frase" rows={2} maxLength={MAX_VOICE_TEXT} disabled={disabled} value={spoken.text} onChange={(event) => choose({ text: event.target.value })} placeholder="¡Buen trabajo, cuadrilla!" className="resize-none rounded-lg border border-outline/30 bg-surface px-3 py-2 text-[14px] text-on-surface outline-none focus:border-primary" />
          </label>
          <div role="radiogroup" aria-label="Voces" className="grid grid-cols-2 gap-2">
            {STICKER_VOICES.map((voice) => (
              <VoiceCard key={voice.id} id={voice.id} label={voice.label} detail={voice.detail} checked={spoken.voiceId === voice.id} disabled={disabled} onSelect={() => choose({ voiceId: voice.id })} />
            ))}
          </div>
          <button type="button" data-testid="voz-escuchar" disabled={disabled || listening || !voiceTextOf(spoken.text)} onClick={() => void listen()} className="flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-primary/40 px-4 text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
            <Play size={13} className="fill-current" /> {listening ? 'Preparando la voz…' : 'Escuchar'}
          </button>
        </div>
      ) : null}
    </SoundOption>
  );
}

function VoiceCard(props: { id: StickerVoiceId; label: string; detail: string; checked: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={props.checked} data-testid={`voz-${props.id}`} disabled={props.disabled} onClick={props.onSelect} className={`flex min-h-[56px] items-center gap-2 rounded-xl border p-2 text-left disabled:opacity-60 ${props.checked ? 'border-primary bg-primary/10' : 'border-outline/20 hover:bg-background'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${props.checked ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>{props.label[0]}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-on-surface">{props.label}</span>
        <span className="block truncate text-[12px] text-on-surface-variant">{props.detail}</span>
      </span>
    </button>
  );
}
