import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { Contact, ContactGroup } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/**
 * La lista de contactos agrupada por letra, con selección de uno o de varios.
 *
 * El agrupado viene hecho del server (`GET /api/contacts` devuelve `groups`),
 * así que acá solo se filtra y se dibuja. Es el mismo componente para «nuevo
 * chat», «nuevo grupo» e «invitados de un evento»: lo único que cambia es
 * `multiple`.
 */
export function ContactPicker({
  groups,
  selected,
  onToggle,
  loading,
  multiple,
}: {
  groups: ContactGroup[];
  selected: Contact[];
  onToggle: (contact: Contact) => void;
  loading: boolean;
  multiple: boolean;
}) {
  const [query, setQuery] = useState('');

  const visibles = useMemo(() => {
    const aguja = query.trim().toLowerCase();
    if (!aguja) return groups;
    return groups
      .map((grupo) => ({
        ...grupo,
        contacts: grupo.contacts.filter((contacto) =>
          `${contacto.name ?? ''} ${contacto.phone}`.toLowerCase().includes(aguja)
        ),
      }))
      .filter((grupo) => grupo.contacts.length > 0);
  }, [groups, query]);

  const elegido = (contacto: Contact) => selected.some((uno) => uno.id === contacto.id);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-full bg-background px-3 py-2">
        <Search size={16} className="shrink-0 text-on-surface-variant" />
        <input
          data-testid="buscar-contactos"
          value={query}
          onChange={(evento) => setQuery(evento.target.value)}
          placeholder="Buscar contactos"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        />
      </div>

      {multiple && selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((contacto) => (
            <button
              key={contacto.id}
              type="button"
              onClick={() => onToggle(contacto)}
              className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary"
            >
              {contacto.name ?? contacto.phone} ✕
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div data-testid="contactos-cargando">
          {[0, 1, 2, 3].map((indice) => (
            <div key={indice} className="mb-1 flex items-center gap-3 py-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-background" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-background" />
            </div>
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-sm leading-5 text-on-surface-variant">
          {query
            ? 'Nadie coincide con lo que buscas.'
            : 'Todavía no hay nadie más en Lilachat. Invita a tu familia y aparecerán acá.'}
        </p>
      ) : (
        visibles.map((grupo) => (
          <section key={grupo.letter}>
            <h3 className="px-1 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              {grupo.letter}
            </h3>
            {grupo.contacts.map((contacto) => (
              <button
                key={contacto.id}
                type="button"
                data-testid={`contacto-${contacto.id}`}
                aria-pressed={elegido(contacto)}
                onClick={() => onToggle(contacto)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                  elegido(contacto) ? 'bg-primary/10' : 'hover:bg-background'
                }`}
              >
                <Avatar name={contacto.name ?? contacto.phone} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {contacto.name ?? contacto.phone}
                  </span>
                  <span className="block truncate text-[12px] text-on-surface-variant">
                    {contacto.phone}
                  </span>
                </span>
                {elegido(contacto) ? (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
                    <Check size={14} />
                  </span>
                ) : null}
              </button>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
