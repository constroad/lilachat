import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { SEARCHABLE_FROM, filterChoiceOptions, matchSpan, type ChoiceOption, type FormField } from '@lilachat/shared';

type Choice = Extract<FormField, { kind: 'choice' }>;

const initialsOf = (label: string) => label.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('') || '·';

/**
 * A long list (the company's people to mark attendance, agentes 24/10;
 * design e-35): a field with the one picked that opens a panel with a search
 * ignoring accents and capitals. The APK's `SearchableChoice` is its twin.
 */
export function SearchableChoice({ field, value, onChange }: { field: Choice; value: unknown; onChange: (value: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const picked = field.options.find((option) => option.value === value);
  const shown = useMemo(() => filterChoiceOptions(field.options, query), [field.options, query]);
  // A search box over three rows is noise (José, 24/10: the carriers and quarries are dropdowns even when short).
  const withSearch = field.options.length > SEARCHABLE_FROM;
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  const pick = (option: ChoiceOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };
  return (
    <div className="relative">
      <button type="button" data-testid={`campo-${field.name}`} aria-expanded={open} onClick={() => setOpen((was) => !was)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left ${picked ? 'border-primary bg-primary/5' : 'border-outline/25 bg-background'}`}>
        {picked ? <Initials label={picked.label} /> : <Search size={18} className="text-on-surface-variant" />}
        <span className="min-w-0 flex-1">
          <span className={`block ${picked?.sub ? 'truncate' : 'line-clamp-2 break-words'} text-[15px] ${picked ? 'font-semibold' : 'text-on-surface-variant'}`}>{picked ? picked.label : 'Elige de la lista'}</span>
          {picked?.sub ? <span className="block truncate text-[12px] text-on-surface-variant">{picked.sub}</span> : null}
        </span>
        <ChevronDown size={18} className="text-on-surface-variant" />
      </button>
      {open ? (
        <div data-testid={`hoja-${field.name}`} className="absolute left-0 right-0 top-14 z-20 flex max-h-80 flex-col overflow-hidden rounded-2xl border border-outline/15 bg-surface shadow-2xl">
          {withSearch ? (
            <div className="flex items-center gap-2 border-b border-outline/10 px-3 py-2">
              <Search size={16} className="text-on-surface-variant" />
              <input ref={search} data-testid={`buscar-${field.name}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)} placeholder="Busca por nombre" className="h-9 flex-1 bg-transparent text-[15px] outline-none" />
              {query ? <button type="button" aria-label="Borrar la búsqueda" onClick={() => setQuery('')} className="grid h-7 w-7 place-items-center rounded-full hover:bg-background"><X size={14} /></button> : null}
            </div>
          ) : null}
          <p data-testid={`cuenta-${field.name}`} className="px-3 pt-2 text-[12px] text-on-surface-variant">{query.trim() ? `${shown.length} de ${field.options.length}` : `${field.options.length} opciones`}</p>
          <ul role="listbox" aria-label={field.label} className="min-h-0 flex-1 overflow-y-auto p-1">
            {shown.length ? shown.map((option) => (
              <li key={option.value}>
                <button type="button" role="option" aria-selected={option.value === value} data-testid={`opcion-${field.name}-${option.value}`} onClick={() => pick(option)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-background ${option.value === value ? 'bg-primary/10' : ''}`}>
                  <Initials label={option.label} />
                  <span className="min-w-0 flex-1">
                    <Highlighted label={option.label} query={query} clamp={!option.sub} />
                    {option.sub ? <span className="block truncate text-[12px] text-on-surface-variant">{option.sub}</span> : null}
                  </span>
                  {option.value === value ? <Check size={18} className="text-primary" /> : null}
                </button>
              </li>
            )) : <li className="px-3 py-6 text-center text-[14px] text-on-surface-variant">Nada con ese nombre</li>}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A long name (a mix design) takes two lines; with a line under it (a role) it stays on one. */
function Highlighted({ label, query, clamp }: { label: string; query: string; clamp: boolean }) {
  const span = matchSpan(label, query);
  const className = `block ${clamp ? 'line-clamp-2 break-words' : 'truncate'} text-[15px] font-semibold`;
  if (!span) return <span className={className}>{label}</span>;
  return <span className={className}>{label.slice(0, span.start)}<span className="text-primary">{label.slice(span.start, span.end)}</span>{label.slice(span.end)}</span>;
}

function Initials({ label }: { label: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">{initialsOf(label)}</span>;
}
