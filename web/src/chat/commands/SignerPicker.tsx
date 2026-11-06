import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { chipLabelOf, filterChoiceOptions, SEARCHABLE_FROM, SIGNER_KICKER, type FormField } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { FieldError } from '../../ui/Overlay';

type ChoiceField = Extract<FormField, { kind: 'choice' }>;

/** The first step of a signing, like Portal's attendance page: a card per person; the camera waits for the name. */
export function SignerPicker(props: { field: ChoiceField; onPick: (value: string) => void }) {
  const { field } = props;
  const [query, setQuery] = useState('');
  const shown = filterChoiceOptions(field.options, query);
  return (
    <section data-testid="quien-firma" className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{SIGNER_KICKER}</p>
      {field.options.length >= SEARCHABLE_FROM ? (
        <label className="flex items-center gap-2 rounded-full bg-background px-3 py-2">
          <Search size={16} className="shrink-0 text-on-surface-variant" />
          <input data-testid="buscar-quien-firma" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca tu nombre" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
      ) : null}
      {shown.map((option) => (
        <button key={option.value} type="button" data-testid={`firmante-${option.value}`} disabled={option.disabled} onClick={() => props.onPick(option.value)} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-outline/15 bg-surface p-3 text-left hover:border-primary/40 disabled:opacity-50">
          <Avatar name={option.label} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{option.label}</span>
            {option.sub ? <span className="block truncate text-[13px] text-on-surface-variant">{option.sub}</span> : null}
          </span>
          <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
        </button>
      ))}
      {shown.length === 0 ? <p data-testid="quien-firma-vacio" className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">Nadie se llama «{query}».</p> : null}
    </section>
  );
}

/** Who is signing, above the camera; «Cambiar» goes back to the cards and turns the camera off. */
export function SignerCard(props: { field: ChoiceField; value: unknown; error?: string; onChange: () => void }) {
  const option = props.field.options.find((one) => one.value === props.value);
  return (
    <div>
      <div data-testid="firmante-elegido" className="flex items-center gap-3 rounded-xl border border-outline/15 p-2.5">
        <Avatar name={option?.label ?? ''} size={36} />
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{option?.label}</p>
        <button type="button" data-testid="cambiar-firmante" onClick={props.onChange} className="min-h-[44px] shrink-0 px-2 text-[13px] font-semibold text-primary">Cambiar</button>
      </div>
      {props.error ? <FieldError>{props.error}</FieldError> : null}
    </div>
  );
}

/** What is signed, as chips in one line (José 06/11: a selector hid it under the camera). */
export function SigningChips(props: { field: ChoiceField; value: unknown; error?: string; onChange: (value: string) => void }) {
  const { field } = props;
  return (
    <div>
      <div data-testid={`chips-${field.name}`} role="radiogroup" aria-label={field.label} className="flex gap-1.5">
        {field.options.map((option) => {
          const picked = props.value === option.value;
          return <button key={option.value} type="button" role="radio" aria-checked={picked} aria-label={option.label} data-testid={`opcion-${field.name}-${option.value}`} onClick={() => props.onChange(option.value)} className={`min-h-[44px] min-w-0 flex-1 truncate rounded-full border px-2 text-[13px] font-semibold ${picked ? 'border-primary bg-primary text-on-primary' : 'border-outline/25 text-on-surface'}`}>{chipLabelOf(option)}</button>;
        })}
      </div>
      {props.error ? <FieldError>{props.error}</FieldError> : null}
    </div>
  );
}
