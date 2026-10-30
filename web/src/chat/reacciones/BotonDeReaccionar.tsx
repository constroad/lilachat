import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Plus, SmilePlus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { actsAsMessage, EMOJIS_RAPIDOS, miReaccion } from '@lilachat/shared';
import { useConversacion } from '../contextoDeLaConversacion';
import type { MensajeEnPantalla } from '../types';
import { AddCustomEmojiDialog } from './AddCustomEmojiDialog';
import { SpaceEmojiSection } from './SpaceEmojiSection';
import { lazyChunk } from '../../ui/lazyChunk';

const PanelDeEmojis = lazyChunk(() => import('../PanelDeEmojis'));

/**
 * El botón de reaccionar al pasar el mouse (20/10; diseño
 * `f1-web-reacciones-reenviar`), al costado de la burbuja como WhatsApp Web:
 * los seis rápidos y «+» con todos. El que ya puse va resaltado y quitarlo es
 * tocarlo de nuevo.
 */
export function BotonDeReaccionar({ mensaje, mio }: { mensaje: MensajeEnPantalla; mio: boolean }) {
  const { yo, jwt, chat, onReaccionar } = useConversacion();
  const [todos, setTodos] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!onReaccionar || mensaje.estado || mensaje.deletedAt || !actsAsMessage(mensaje)) return null;
  const mia = miReaccion(mensaje.reacciones, yo);
  const elegir = (emoji: string) => onReaccionar(mensaje.seq, emoji === mia ? null : emoji);
  return (
    <>
    <DropdownMenu.Root modal={false} open={open} onOpenChange={(abierto) => { setOpen(abierto); if (!abierto) setTodos(false); }}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-testid={`reaccionar-${mensaje.clientKey}`}
          aria-label="Reaccionar"
          className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full border border-outline/15 bg-surface text-on-surface-variant opacity-0 shadow-sm transition-opacity hover:text-primary focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <SmilePlus size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align={mio ? 'end' : 'start'} sideOffset={6} onCloseAutoFocus={(evento) => evento.preventDefault()} className="z-40 rounded-full border border-outline/15 bg-surface p-1 shadow-lg data-[todos=true]:rounded-xl" data-todos={todos}>
          {todos ? (
            <div className="w-[340px]">
              <SpaceEmojiSection onPick={(emoji) => { elegir(emoji); setOpen(false); }} onAdd={() => { setOpen(false); setAdding(true); }} />
              <Suspense fallback={<div className="h-[320px]" />}>
                <PanelDeEmojis onElegir={(emoji) => elegir(emoji)} />
              </Suspense>
            </div>
          ) : (
            <div data-testid="barra-reacciones" className="flex items-center gap-0.5">
              {EMOJIS_RAPIDOS.map((emoji) => (
                <DropdownMenu.Item
                  key={emoji}
                  data-testid={`reaccion-rapida-${emoji}`}
                  aria-label={emoji === mia ? `Quitar ${emoji}` : `Reaccionar con ${emoji}`}
                  onSelect={() => elegir(emoji)}
                  className={`grid h-10 w-10 cursor-pointer select-none place-items-center rounded-full text-[22px] outline-none transition-transform data-[highlighted]:scale-110 data-[highlighted]:bg-background ${emoji === mia ? 'bg-primary/15' : ''}`}
                >
                  {emoji}
                </DropdownMenu.Item>
              ))}
              <span className="mx-0.5 h-6 w-px bg-outline/20" />
              <DropdownMenu.Item
                data-testid="reaccion-mas"
                aria-label="Más emojis"
                onSelect={(evento) => {
                  evento.preventDefault();
                  setTodos(true);
                }}
                className="grid h-10 w-10 cursor-pointer select-none place-items-center rounded-full bg-background text-on-surface-variant outline-none data-[highlighted]:text-primary"
              >
                <Plus size={18} />
              </DropdownMenu.Item>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {adding && chat.workspaceId ? <AddCustomEmojiDialog jwt={jwt} spaceId={chat.workspaceId} onClose={() => setAdding(false)} /> : null}
    </>
  );
}
