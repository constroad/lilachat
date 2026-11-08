import { useState } from 'react';
import { PHOTO_PHASES, PHOTO_STRETCH_HINT, PHOTO_STRETCH_MAX, photoPhaseDraftOf, photoPhaseLabel, savePhotoPhase, type PhotoMark, type PhotoPhase, type WorkProgressResult } from '@lilachat/shared';

export type PhotoPhaseSend = (phase: PhotoPhase | null, stretch: string) => Promise<WorkProgressResult>;

/**
 * «Antes / Después» under a Drive photo in the viewer (José 08/11, Portal 2ef27173): any member of
 * the channel marks it, with the stretch that pairs a «before» with its «after».
 */
export function PhotoPhaseBar(props: { mark: PhotoMark | null; send: PhotoPhaseSend }) {
  const [draft, setDraft] = useState(() => photoPhaseDraftOf(props.mark));
  const { phase, stretch, busy, answer } = draft;
  const save = async () => { setDraft({ ...draft, busy: true }); setDraft(await savePhotoPhase(draft, props.send)); };
  return (
    <div data-testid="foto-fase-barra" className="mx-auto mb-4 flex w-full max-w-md flex-col gap-2 px-4 text-white">
      <p data-testid="foto-fase" className="text-center text-[13px] font-semibold text-white/80">{photoPhaseLabel(props.mark)}</p>
      <div role="radiogroup" aria-label="Antes o después" className="grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1">
        {PHOTO_PHASES.map((one) => (
          <button key={one.label} type="button" role="radio" aria-checked={phase === one.phase} data-testid={`foto-fase-${one.phase ?? 'ninguna'}`} onClick={() => setDraft({ ...draft, phase: one.phase })} className={`h-10 rounded-lg text-[14px] font-semibold ${phase === one.phase ? 'bg-white text-black' : 'text-white'}`}>{one.label}</button>
        ))}
      </div>
      {phase ? <input data-testid="foto-fase-tramo" value={stretch} maxLength={PHOTO_STRETCH_MAX} onChange={(event) => setDraft({ ...draft, stretch: event.target.value })} placeholder={PHOTO_STRETCH_HINT} className="h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-[15px] text-white outline-none placeholder:text-white/50" /> : null}
      <button type="button" data-testid="foto-fase-guardar" disabled={busy} onClick={() => void save()} className="h-11 rounded-xl bg-white text-[15px] font-semibold text-black disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar marca'}</button>
      {answer ? <p role={answer.ok ? 'status' : 'alert'} className={`text-center text-[13px] ${answer.ok ? 'text-white' : 'text-red-300'}`}>{answer.message}</p> : null}
    </div>
  );
}
