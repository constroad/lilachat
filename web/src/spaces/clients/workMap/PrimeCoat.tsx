import { useMemo } from 'react';
import { ClipboardCheck, MapPin } from 'lucide-react';
import { PRIME_COAT_HOW, PRIME_COAT_TITLE, primeCoatDraftOf, primeCoatExplain, primeCoatGaps, primeCoatLength, suggestPrimeCoat, type ManualProgressDraft, type MapPhoto, type WorkMap } from '@lilachat/shared';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';

/**
 * #253: the stretches the photos of the prime coat report mark. Its button opens the manual
 * progress form of that street already filled; nothing counts until the person sends it.
 */
export function PrimeCoatSuggestions(props: { map: WorkMap; photos: MapPhoto[]; onRecord: (streetId: string, draft: ManualProgressDraft) => void }) {
  const suggestion = useMemo(() => suggestPrimeCoat(props.map, props.photos), [props.map, props.photos]);
  if (!suggestion.stretches.length) return null;
  const gaps = primeCoatGaps(suggestion);
  return (
    <div data-testid="imprimacion-sugerida" className="space-y-3">
      <header>
        <p className={KICKER}>Control de imprimación</p>
        <p className="text-[15px] font-semibold text-on-surface">{PRIME_COAT_TITLE}</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-[12px] text-on-surface-variant"><MapPin size={13} className="mt-0.5 shrink-0" />{PRIME_COAT_HOW}</p>
      </header>
      {gaps ? <p data-testid="imprimacion-sin-ubicar" className="rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[12px] text-on-surface-variant">No suman: {gaps}.</p> : null}
      {suggestion.stretches.map((stretch) => (
        <section key={stretch.id} data-testid={`imprimacion-tramo-${stretch.streetId}`} className="rounded-xl border border-outline/15 bg-surface p-3">
          <p className="text-[15px] font-semibold text-on-surface">{stretch.streetName}</p>
          <p className="font-mono text-[22px] font-bold tabular-nums text-on-surface">{primeCoatLength(stretch)}</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">{primeCoatExplain(stretch)}</p>
          <button type="button" data-testid={`imprimacion-registrar-${stretch.streetId}`} onClick={() => props.onRecord(stretch.streetId, primeCoatDraftOf(props.map, stretch))} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-on-primary"><ClipboardCheck size={16} /> Revisar y registrar</button>
        </section>
      ))}
    </div>
  );
}
