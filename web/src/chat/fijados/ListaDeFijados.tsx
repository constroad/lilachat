import { PinOff } from 'lucide-react';
import { formatChatTimestamp, MAXIMO_DE_FIJADOS, textoDelFijado, textoDelVencimiento } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';
import type { FijadoEnLista } from '../types';

/**
 * Todos los fijados del chat (20/10; diseño `f1-app-fijados`, en la web como
 * diálogo): autor y texto, quién lo fijó y cuánto le queda. Clic lleva al
 * mensaje; quien puede, desfija desde la fila.
 */
export function ListaDeFijados(props: {
  fijados: FijadoEnLista[];
  nombreDe: (userId: string) => string;
  textoLocal?: (seq: number) => string | undefined;
  puedeDesfijar: boolean;
  onIr: (seq: number) => void;
  onDesfijar: (seq: number) => void;
  onCerrar: () => void;
}) {
  const ahora = Date.now();
  return (
    <Overlay title={`Mensajes fijados · ${props.fijados.length}`} onClose={props.onCerrar}>
      <ul data-testid="lista-fijados" className="-mx-4">
        {props.fijados.map((fijado) => {
          const autor = props.nombreDe(fijado.vista.senderId);
          return (
            <li key={fijado.seq} className="flex items-center gap-1 border-b border-outline/10 pr-2">
              <button
                type="button"
                data-testid={`fila-fijado-${fijado.seq}`}
                onClick={() => {
                  props.onCerrar();
                  props.onIr(fijado.seq);
                }}
                className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-background"
              >
                <Avatar name={autor} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-semibold">{autor}</span> · {textoDelFijado(fijado.vista, props.textoLocal?.(fijado.seq))}
                  </span>
                  <span className="block truncate text-[12px] text-on-surface-variant">
                    Fijado por {props.nombreDe(fijado.por)} · {textoDelVencimiento(fijado.hasta, ahora)}
                  </span>
                </span>
                <span className="text-[12px] text-on-surface-variant">{formatChatTimestamp(fijado.en)}</span>
              </button>
              {props.puedeDesfijar ? (
                <button type="button" data-testid={`desfijar-${fijado.seq}`} aria-label="Desfijar" onClick={() => props.onDesfijar(fijado.seq)} className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant hover:bg-background hover:text-error">
                  <PinOff size={16} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-center text-[12px] text-on-surface-variant">Se fijan hasta {MAXIMO_DE_FIJADOS} mensajes. Todos los ven.</p>
    </Overlay>
  );
}

/** «Mensajes fijados · 5» en el panel de «Info.»: los tres más recientes y «Ver los N». */
export function TarjetaDeFijados(props: { fijados: FijadoEnLista[]; nombreDe: (userId: string) => string; textoLocal?: (seq: number) => string | undefined; onVerTodos: () => void }) {
  if (props.fijados.length === 0) return null;
  return (
    <section data-testid="tarjeta-fijados" className="mt-2 bg-surface px-4 py-3">
      <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
        Mensajes fijados <span className="rounded-full bg-primary/10 px-2 text-primary">{props.fijados.length}</span>
      </h3>
      <ul className="mt-1">
        {props.fijados.slice(0, 3).map((fijado) => (
          <li key={fijado.seq} className="flex min-h-[44px] items-center gap-2 border-b border-outline/10 text-sm">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{props.nombreDe(fijado.vista.senderId)}: </span>
              {textoDelFijado(fijado.vista, props.textoLocal?.(fijado.seq))}
            </span>
            <span className="text-[12px] text-on-surface-variant">{formatChatTimestamp(fijado.en)}</span>
          </li>
        ))}
      </ul>
      <button type="button" data-testid="btn-ver-todos-fijados" onClick={props.onVerTodos} className="mt-1 min-h-[40px] w-full text-sm font-semibold text-primary">
        {props.fijados.length > 3 ? `Ver los ${props.fijados.length}` : 'Ver fijados'}
      </button>
    </section>
  );
}
