import { ChevronRight } from 'lucide-react';
import { textoDelChipDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';

/**
 * Under a thread's root (E3, 20/10): who answered last, the reply count with
 * the time of the last one, and the arrow. With unread replies it gets a border and a «Nuevo» pill
 * (José 16/11: the purple dot did not stand out). It opens the thread panel on the right. Big and easy to tap
 * (José, 21/10: the threads showed, but too small). Design `e3-web-hilo`.
 */
export function ChipDeHilo(props: { seq: number; hilo: ResumenDeHiloEnCliente; nombres: ReadonlyMap<string, string>; photos?: ReadonlyMap<string, string>; nuevas: boolean; onAbrir: (seq: number) => void }) {
  const texto = textoDelChipDeHilo(props.hilo);
  if (!texto) return null;
  return (
    <button
      type="button"
      data-testid={`chip-hilo-${props.seq}`}
      onClick={() => props.onAbrir(props.seq)}
      aria-label={`${texto}${props.nuevas ? '. Hay respuestas sin leer' : ''}. Abrir el hilo`}
      className={`mt-1 flex min-h-[44px] max-w-full items-center gap-2.5 rounded-xl border px-3 text-left text-[14px] ${
        props.nuevas ? 'border-primary/50 bg-primary/[0.08] hover:bg-primary/[0.12]' : 'border-outline/15 bg-surface hover:bg-background'
      }`}
    >
      <span className="flex -space-x-2">
        {(props.hilo.autores ?? []).map((autor) => (
          <Avatar key={autor} name={props.nombres.get(autor) ?? '?'} foto={props.photos?.get(autor)} kind="direct" size={26} />
        ))}
      </span>
      <span className={`truncate font-bold ${props.nuevas ? 'text-primary' : 'text-on-surface-variant'}`}>{texto}</span>
      {props.nuevas ? (
        <span data-testid={`hilo-nuevas-${props.seq}`} className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-on-primary">
          Nuevo
        </span>
      ) : null}
      <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
    </button>
  );
}
