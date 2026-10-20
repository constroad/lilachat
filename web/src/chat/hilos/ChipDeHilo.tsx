import { ChevronRight } from 'lucide-react';
import { textoDelChipDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';

/**
 * Debajo de la raíz de un hilo (E3, 20/10; diseño `e3-web-hilo`): los últimos
 * que respondieron, «4 respuestas · última 10:42», un punto si hay nuevas y la
 * flecha. Abre el panel del hilo a la derecha.
 */
export function ChipDeHilo(props: { seq: number; hilo: ResumenDeHiloEnCliente; nombres: ReadonlyMap<string, string>; photos?: ReadonlyMap<string, string>; nuevas: boolean; onAbrir: (seq: number) => void }) {
  const texto = textoDelChipDeHilo(props.hilo);
  if (!texto) return null;
  return (
    <button
      type="button"
      data-testid={`chip-hilo-${props.seq}`}
      onClick={() => props.onAbrir(props.seq)}
      aria-label={`${texto}. Abrir el hilo`}
      className="mt-1 flex min-h-[32px] max-w-full items-center gap-2 rounded-lg border border-outline/15 bg-surface px-2.5 text-left text-[12px] hover:bg-background"
    >
      <span className="flex -space-x-1.5">
        {(props.hilo.autores ?? []).map((autor) => (
          <Avatar key={autor} name={props.nombres.get(autor) ?? '?'} foto={props.photos?.get(autor)} kind="direct" size={20} />
        ))}
      </span>
      <span className="truncate font-semibold text-primary">{texto}</span>
      {props.nuevas ? <span data-testid={`hilo-nuevas-${props.seq}`} className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
      <ChevronRight size={14} className="shrink-0 text-on-surface-variant" />
    </button>
  );
}
