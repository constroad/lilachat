import { useRef, type ReactNode } from 'react';
import { Mic, Music, Play, Upload, VolumeOff } from 'lucide-react';
import { STICKER_SOUND_PRESETS, type StickerSoundPreset } from '@lilachat/shared';
import { playWinkSound, stopWinkSounds } from '../winkSounds';
import { VoiceRecorder } from './VoiceRecorder';
import { audioFileProblem, clipTime, type SoundPick } from './videoSticker';

const AUDIO_ACCEPT = '.mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav';

type Props = {
  pick: SoundPick;
  clipMs: number;
  voice: Blob | null;
  upload: File | null;
  disabled: boolean;
  onPick: (pick: SoundPick) => void;
  onVoice: (voice: Blob) => void;
  onUpload: (file: File) => void;
  onNotice: (message: string) => void;
};

/**
 * «Sonido del sticker» (José 26/11, designs ss-02 and ss-04): the video's own
 * sound (default), a recorded voice, an uploaded audio, one of Lilachat's
 * sounds or none. Each option is a radio card; only the chosen one opens.
 */
export function StickerSoundPicker(props: Props) {
  const audioInput = useRef<HTMLInputElement>(null);
  const { pick, disabled } = props;
  const pickUpload = () => {
    props.onPick({ kind: 'upload' });
    if (!props.upload) audioInput.current?.click();
  };
  const takeAudio = (file: File | undefined) => {
    if (!file) return;
    const problem = audioFileProblem(file);
    if (problem) return props.onNotice(problem);
    props.onUpload(file);
    props.onPick({ kind: 'upload' });
  };
  return (
    <section role="radiogroup" aria-label="Sonido del sticker" className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">
        Sonido del sticker <span className="text-[12px] font-normal normal-case tracking-normal">Hasta 6 segundos</span>
      </h3>
      <SoundOption testId="sonido-original" icon={<Music size={17} />} title="Sonido original" hint={`El audio del video, en el tramo elegido (${clipTime(props.clipMs)})`} checked={pick.kind === 'original'} disabled={disabled} onSelect={() => props.onPick({ kind: 'original' })} />
      <SoundOption testId="sonido-grabar" icon={<Mic size={17} />} title="Grabar tu voz" hint="Mantén presionado para hablar, o toca para empezar y parar" checked={pick.kind === 'voice'} disabled={disabled} onSelect={() => props.onPick({ kind: 'voice' })}>
        {pick.kind === 'voice' ? <VoiceRecorder voice={props.voice} disabled={disabled} onVoice={props.onVoice} onNotice={props.onNotice} /> : null}
      </SoundOption>
      <SoundOption testId="sonido-subir" icon={<Upload size={17} />} title="Subir un audio" hint={props.upload ? props.upload.name : 'MP3, M4A o WAV'} checked={pick.kind === 'upload'} disabled={disabled} onSelect={pickUpload}>
        {pick.kind === 'upload' && props.upload ? (
          <button type="button" disabled={disabled} onClick={() => audioInput.current?.click()} className="mt-2 text-[12px] font-semibold text-primary disabled:opacity-50">Elegir otro audio</button>
        ) : null}
      </SoundOption>
      <input ref={audioInput} type="file" accept={AUDIO_ACCEPT} hidden data-testid="input-audio-sticker" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; takeAudio(file); }} />
      <PresetSounds pick={pick} disabled={disabled} onPick={props.onPick} />
      <SoundOption testId="sin-sonido" icon={<VolumeOff size={17} />} title="Sin sonido" checked={pick.kind === 'none'} disabled={disabled} onSelect={() => props.onPick({ kind: 'none' })} />
    </section>
  );
}

type OptionProps = { testId: string; icon: ReactNode; title: string; hint?: string; checked: boolean; disabled: boolean; onSelect: () => void; children?: ReactNode };

function SoundOption({ testId, icon, title, hint, checked, disabled, onSelect, children }: OptionProps) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-outline/20'}`}>
      <button type="button" role="radio" aria-checked={checked} data-testid={testId} disabled={disabled} onClick={onSelect} className="flex w-full items-center gap-3 text-left disabled:opacity-60">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${checked ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-on-surface">{title}</span>
          {hint ? <span className="block truncate text-[12px] text-on-surface-variant">{hint}</span> : null}
        </span>
        <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-primary' : 'border-outline/40'}`}>{checked ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}</span>
      </button>
      {children}
    </div>
  );
}

/** «Sonidos de Lilachat»: a click picks it and lets it be heard once. */
function PresetSounds({ pick, disabled, onPick }: { pick: SoundPick; disabled: boolean; onPick: (pick: SoundPick) => void }) {
  const choose = (preset: StickerSoundPreset) => {
    onPick({ kind: 'preset', presetId: preset.id });
    stopWinkSounds();
    playWinkSound(preset.sound);
  };
  const chosen = pick.kind === 'preset' ? pick.presetId : null;
  return (
    <div className={`rounded-xl border p-3 ${chosen ? 'border-primary bg-primary/5' : 'border-outline/20'}`}>
      <p className="text-[14px] font-semibold text-on-surface">Sonidos de Lilachat</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STICKER_SOUND_PRESETS.map((preset) => (
          <button key={preset.id} type="button" role="radio" aria-checked={chosen === preset.id} data-testid={`sonido-preset-${preset.id}`} disabled={disabled} onClick={() => choose(preset)} className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold disabled:opacity-60 ${chosen === preset.id ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface hover:bg-background'}`}>
            <Play size={12} className="fill-current" /> {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
