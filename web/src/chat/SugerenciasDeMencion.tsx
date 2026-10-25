import { Megaphone, Zap } from 'lucide-react';
import { MENTION_HERE } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/** `outsideChat`: of the space but not in this chat; mentioning them offers to add them. */
export type Mencionable = { id: string; nombre: string; foto?: string; outsideChat?: boolean };
/** The list scrolls (`max-h-64`), so it can hold a whole space; this only guards a huge one. */
const MAX_SUGGESTIONS = 100;
/** A suggestion: a member, or a group mention with a `hint` that says what it does (E3b). */
export type MentionSuggestion = Mencionable & { hint?: string };

/** Sin tildes y en minúsculas: nadie escribe «@José» con tilde. */
const clave = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The members that match what follows the «@»: the chat's before the rest of the space's, and prefix matches first. */
export function filtrarMencionables(miembros: readonly Mencionable[], consulta: string): Mencionable[] {
  const aguja = clave(consulta);
  const calzan = miembros.filter((uno) => clave(uno.nombre).includes(aguja));
  const ordenados = (grupo: readonly Mencionable[]) => [...grupo.filter((uno) => clave(uno.nombre).startsWith(aguja)), ...grupo.filter((uno) => !clave(uno.nombre).startsWith(aguja))];
  return [...ordenados(calzan.filter((uno) => !uno.outsideChat)), ...ordenados(calzan.filter((uno) => uno.outsideChat))].slice(0, MAX_SUGGESTIONS);
}

/** La lista sobre el campo al escribir «@», como WhatsApp Web. */
export function SugerenciasDeMencion(props: { opciones: MentionSuggestion[]; activa: number; onElegir: (uno: Mencionable) => void }) {
  if (props.opciones.length === 0) return null;
  return (
    <ul role="listbox" aria-label="Mencionar a" data-testid="sugerencias-mencion" className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
      {props.opciones.map((uno, indice) => (
        <li key={uno.id} role="option" aria-selected={indice === props.activa}>
          <button
            type="button"
            data-testid={`mencionar-${uno.id}`}
            // mousedown y no click: el click llega después del blur del campo.
            onMouseDown={(evento) => {
              evento.preventDefault();
              props.onElegir(uno);
            }}
            className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${indice === props.activa ? 'bg-background' : 'hover:bg-background'}`}
          >
            {uno.hint ? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                {uno.id === MENTION_HERE ? <Zap size={14} /> : <Megaphone size={14} />}
              </span>
            ) : (
              <Avatar name={uno.nombre} foto={uno.foto} size={28} />
            )}
            <span className="min-w-0">
              <span className={`block truncate ${uno.hint ? 'font-semibold text-primary' : ''}`}>{uno.hint ? `@${uno.nombre}` : uno.nombre}</span>
              {uno.hint || uno.outsideChat ? <span className="block truncate text-[12px] text-on-surface-variant">{uno.hint ?? 'No está en este canal'}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
