import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Copy, CornerUpLeft, Forward, Info, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { accionesDeMensaje, puedeEditar } from '@lilachat/shared';
import { useConversacion, type AccionSobreMensaje } from './contextoDeLaConversacion';
import type { MensajeEnPantalla } from './types';

/**
 * El menú de un mensaje (W2), como WhatsApp Web: una flecha que aparece al
 * pasar el mouse (o con el foco del teclado) y despliega las acciones. Qué
 * acciones hay lo decide el motor compartido con la app (`accionesDeMensaje`).
 * Lo pendiente o fallido no tiene menú: todavía no existe en el server.
 */
export function MenuDelMensaje({ mensaje, mio }: { mensaje: MensajeEnPantalla; mio: boolean }) {
  const { chat, yo, onAccion, puedeFijar, fijados } = useConversacion();
  if (mensaje.estado) return null;
  const secreto = Boolean(chat.encrypted);
  const acciones = accionesDeMensaje({
    mio,
    eliminado: Boolean(mensaje.deletedAt),
    conTexto: Boolean(mensaje.body),
    esMedia: Boolean(mensaje.media),
    chatSecreto: secreto,
    editable: puedeEditar({ yo, autor: mensaje.senderId, kind: mensaje.kind, eliminado: Boolean(mensaje.deletedAt), secreto, enviadoEn: mensaje.at, ahora: Date.now() }).permitido,
    puedeFijar,
    fijado: fijados.has(mensaje.seq),
  });
  const item = (accion: AccionSobreMensaje, icono: ReactNode, etiqueta: string, peligro = false) => (
    <DropdownMenu.Item
      data-testid={`accion-${accion}`}
      onSelect={() => onAccion(mensaje, accion)}
      className={`flex min-h-[40px] cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background ${peligro ? 'text-error' : ''}`}
    >
      {icono}
      {etiqueta}
    </DropdownMenu.Item>
  );
  return (
    // No modal: uno modal atrapa el foco mientras se cierra y el campo no lo recibe.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-testid={`menu-${mensaje.clientKey}`}
          aria-label="Opciones del mensaje"
          className="grid h-7 w-7 place-items-center rounded-full text-on-surface-variant opacity-0 transition-opacity hover:bg-background focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <ChevronDown size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={mio ? 'end' : 'start'}
          sideOffset={4}
          // Al cerrar, Radix devuelve el foco a la flecha: pisaba el foco que
          // «Responder» y «Editar» ponen en el campo, y lo tecleado (y el
          // Enter) iba a la flecha, que volvía a abrir el menú (E2E, 19/10).
          onCloseAutoFocus={(evento) => evento.preventDefault()}
          className="z-40 min-w-[200px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg"
        >
          {acciones.responder ? item('responder', <CornerUpLeft size={16} />, 'Responder') : null}
          {acciones.copiar ? item('copiar', <Copy size={16} />, 'Copiar') : null}
          {acciones.reenviar ? item('reenviar', <Forward size={16} />, 'Reenviar') : null}
          {acciones.fijar === 'fijar' ? item('fijar', <Pin size={16} />, 'Fijar') : null}
          {acciones.fijar === 'desfijar' ? item('desfijar', <PinOff size={16} />, 'Desfijar') : null}
          {acciones.editar ? item('editar', <Pencil size={16} />, 'Editar') : null}
          {acciones.info ? item('info', <Info size={16} />, 'Info') : null}
          {acciones.eliminarParaMi ? item('eliminar', <Trash2 size={16} />, 'Eliminar', true) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
