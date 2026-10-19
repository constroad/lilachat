import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, ArchiveRestore, Bell, BellOff, ChevronDown, LogOut, MessageCircle, MessageSquareDot, Pin, PinOff, Trash2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Overlay } from '../ui/Overlay';
import { opcionesDelMenuDeChat, type AccionDelChat } from './menuDelChat';
import type { ChatSummary } from './types';

/**
 * El menú de una fila de la lista (W3a, diseño `w3-web-lista.png`): la flecha
 * aparece al pasar el mouse o con el foco, como en los mensajes. Eliminar y
 * salir se confirman: no se deshacen.
 */
const ICONOS: Record<AccionDelChat, LucideIcon> = {
  archivar: Archive,
  desarchivar: ArchiveRestore,
  silenciar: BellOff,
  reactivar: Bell,
  fijar: Pin,
  desfijar: PinOff,
  leido: MessageCircle,
  'no-leido': MessageSquareDot,
  salir: LogOut,
  eliminar: Trash2,
};

export function MenuDeChat({ chat, onAccion }: { chat: ChatSummary; onAccion: (chat: ChatSummary, accion: AccionDelChat) => void }) {
  const [confirmando, setConfirmando] = useState<AccionDelChat | null>(null);
  const opciones = opcionesDelMenuDeChat(chat);
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            data-testid={`menu-chat-${chat.id}`}
            aria-label="Opciones del chat"
            className="grid h-7 w-7 place-items-center rounded-full bg-surface/80 text-on-surface-variant opacity-0 transition-opacity hover:bg-background focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <ChevronDown size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            onCloseAutoFocus={(evento) => evento.preventDefault()}
            className="z-40 min-w-[230px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg"
          >
            {opciones.map((opcion) => {
              const Icono = ICONOS[opcion.accion];
              return (
                <div key={opcion.accion}>
                  {opcion.peligro ? <DropdownMenu.Separator className="my-1 h-px bg-outline/15" /> : null}
                  <DropdownMenu.Item
                    data-testid={`accion-chat-${opcion.accion}`}
                    onSelect={() => (opcion.peligro ? setConfirmando(opcion.accion) : onAccion(chat, opcion.accion))}
                    className={`flex min-h-[40px] cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background ${opcion.peligro ? 'text-error' : ''}`}
                  >
                    <Icono size={16} className="shrink-0" />
                    {opcion.etiqueta}
                  </DropdownMenu.Item>
                </div>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {confirmando ? (
        <ConfirmarAccionDeChat
          chat={chat}
          accion={confirmando}
          onConfirmar={() => {
            setConfirmando(null);
            onAccion(chat, confirmando);
          }}
          onCerrar={() => setConfirmando(null)}
        />
      ) : null}
    </>
  );
}

/** Lo que no se deshace, dicho antes: qué pasa y qué no. */
function ConfirmarAccionDeChat(props: { chat: ChatSummary; accion: AccionDelChat; onConfirmar: () => void; onCerrar: () => void }) {
  const nombre = props.chat.name ?? props.chat.phone ?? 'esta conversación';
  const salir = props.accion === 'salir';
  const borrador = props.chat.kind === 'notas';
  return (
    <Overlay
      title={salir ? `¿Salir de ${nombre}?` : borrador ? `¿Eliminar el borrador ${nombre}?` : `¿Eliminar el chat con ${nombre}?`}
      onClose={props.onCerrar}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={props.onCerrar} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
            Cancelar
          </button>
          <button type="button" data-testid="btn-confirmar-accion-chat" onClick={props.onConfirmar} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-error text-sm font-semibold text-white">
            {salir ? 'Salir' : 'Eliminar'}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-on-surface-variant">
        {salir
          ? 'Dejas de recibir sus mensajes. El chat queda en tu lista y lo puedes eliminar después.'
          : borrador
            ? 'Sale de tu lista en este navegador y en tu teléfono, con lo que guardaste en él.'
            : 'Sale de tu lista en este navegador y en tu teléfono. A la otra persona no le cambia nada; si vuelve a escribir, el chat reaparece.'}
      </p>
    </Overlay>
  );
}
