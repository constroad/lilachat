import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Eye, Pin, PinOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { textoDelFijado } from '@lilachat/shared';
import type { FijadoEnLista } from './types';

/**
 * La franja del mensaje fijado bajo la cabecera (diseño `fm-web-fijado.png`):
 * tocarla lleva al mensaje y pasa al siguiente fijado; la flecha abre «Ir al
 * mensaje» y «Desfijar» (si se puede).
 */
export function FranjaDeFijados(props: {
  fijados: FijadoEnLista[];
  nombreDe: (userId: string) => string;
  /** El texto descifrado de un mensaje cargado (la web no abre chats secretos). */
  textoLocal?: (seq: number) => string | undefined;
  puedeDesfijar: boolean;
  onIr: (seq: number) => void;
  onDesfijar: (seq: number) => void;
}) {
  const [indice, setIndice] = useState(0);
  const total = props.fijados.length;
  useEffect(() => {
    if (indice >= total) setIndice(0);
  }, [indice, total]);
  // Un fijado nuevo se muestra primero (va al principio de la lista).
  const primero = props.fijados[0]?.seq;
  useEffect(() => setIndice(0), [primero]);
  const actual = props.fijados[indice % Math.max(total, 1)];
  if (!actual) return null;
  const texto = textoDelFijado(actual.vista, props.textoLocal?.(actual.seq));

  return (
    <div data-testid="franja-fijados" className="relative flex min-h-[52px] items-center gap-3 border-b border-outline/15 bg-surface pr-3">
      <span className="w-[3px] self-stretch bg-primary" />
      <button
        type="button"
        data-testid="btn-ir-fijado"
        onClick={() => {
          props.onIr(actual.seq);
          setIndice((anterior) => (anterior + 1) % total);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Pin size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-primary">Mensaje fijado · {props.nombreDe(actual.vista.senderId)}</span>
          <span data-testid="texto-fijado" className="block truncate text-[13px] text-on-surface-variant">
            {texto}
          </span>
        </span>
        {total > 1 ? (
          <span data-testid="contador-fijados" className="text-xs tabular-nums text-on-surface-variant">
            {(indice % total) + 1}/{total}
          </span>
        ) : null}
      </button>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" data-testid="menu-fijado" aria-label="Opciones del mensaje fijado" className="grid h-9 w-9 place-items-center rounded-full border border-outline/15 text-on-surface-variant hover:bg-background">
            <ChevronDown size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} onCloseAutoFocus={(evento) => evento.preventDefault()} className="z-40 min-w-[200px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
            <DropdownMenu.Item data-testid="accion-ir-fijado" onSelect={() => props.onIr(actual.seq)} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background">
              <Eye size={16} /> Ir al mensaje
            </DropdownMenu.Item>
            {props.puedeDesfijar ? (
              <DropdownMenu.Item data-testid="accion-desfijar" onSelect={() => props.onDesfijar(actual.seq)} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background">
                <PinOff size={16} /> Desfijar
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
