import { useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Search, Video } from 'lucide-react';
import {
  DELIVERY_GLYPH,
  formatClock,
  formatDayLabel,
  groupsWithPrevious,
  resolveDeliveryState,
  startsNewDay,
} from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { Composer } from './Composer';
import type { ChatMessage, ChatSummary } from './types';

/**
 * El panel derecho: cabecera, mensajes y composer.
 *
 * UNA sola cabecera, no dos. El diseño de Stitch dibuja arriba una banda con
 * «Selected Conversation / typing…» en inglés: es la etiqueta con la que el
 * generador rotula el ESTADO de la pantalla, no una pieza del producto —
 * shipearla pondría un nombre de estado en la interfaz. Los tres iconos que
 * vivían ahí (videollamada, llamada, buscar) sí son producto y se mudan a la
 * cabecera real, inertes hasta F6/F10, como se hizo con la cámara en la app.
 */
export function Conversation({
  chat,
  messages,
  myUserId,
  typingName,
  onBack,
  onSend,
  showBack,
  loading,
  onCreateEvent,
  onCreatePoll,
  onEnviarArchivo,
}: {
  chat: ChatSummary;
  messages: ChatMessage[];
  myUserId: string;
  typingName: string | null;
  onBack: () => void;
  onSend: (text: string) => void;
  showBack: boolean;
  loading: boolean;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  onEnviarArchivo: (file: File) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Al fondo en cada mensaje nuevo. Sin esto la conversación abre arriba de
  // todo y hay que scrollear para ver lo último, que es lo único que importa.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, typingName]);

  return (
    <section data-testid="panel-conversacion" className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-primary/5 px-4 py-3">
        {showBack ? (
          <button
            type="button"
            data-testid="btn-volver"
            aria-label="Volver"
            onClick={onBack}
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface"
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <Avatar name={chat.name} kind={chat.kind} online={chat.online} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">{chat.name ?? 'Conversación'}</h2>
          {/* La línea de estado NO desaparece cuando nadie escribe: si el alto
              cambiara, la cabecera saltaría con cada tecla del otro. */}
          <p
            data-testid="estado-chat"
            className={`truncate text-[13px] ${typingName ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            {typingName ? 'Escribiendo…' : chat.online ? 'En línea' : ' '}
          </p>
        </div>
        {/* Inertes hasta F10 (llamadas) y la búsqueda en conversación. Se
            muestran atenuados para no prometer lo que todavía no hace. */}
        {/* Se ESCONDEN en pantalla angosta: son acciones que todavía no hacen
            nada, y ahí el ancho lo necesita el nombre del chat —con los tres
            visibles, «QA-F6 — borrar» quedaba en «QA-F6…»—. Lo secundario cede
            primero; el volver y el nombre, nunca. */}
        <div className="hidden items-center gap-1 text-on-surface-variant/40 sm:flex">
          <span className="grid h-9 w-9 place-items-center" title="Videollamada (próximamente)">
            <Video size={18} />
          </span>
          <span className="grid h-9 w-9 place-items-center" title="Llamada (próximamente)">
            <Phone size={18} />
          </span>
          <span className="grid h-9 w-9 place-items-center" title="Buscar (próximamente)">
            <Search size={18} />
          </span>
        </div>
        <button
          type="button"
          className="ml-1 shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-background"
        >
          Ver perfil
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div data-testid="mensajes-cargando" className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`h-10 animate-pulse rounded-xl bg-surface ${
                  index % 2 ? 'ml-auto w-1/3' : 'w-1/2'
                }`}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-on-surface-variant">
            Todavía no hay mensajes. Escribe el primero.
          </p>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const mine = message.senderId === myUserId;
            const grouped = groupsWithPrevious({
              senderId: message.senderId,
              at: message.createdAt,
              previousSenderId: previous?.senderId,
              previousAt: previous?.createdAt,
            });
            // El avatar va en el ÚLTIMO del grupo, como en el diseño: pegado a
            // la burbuja más baja, no repetido en cada una.
            const lastOfGroup =
              !next ||
              !groupsWithPrevious({
                senderId: next.senderId,
                at: next.createdAt,
                previousSenderId: message.senderId,
                previousAt: message.createdAt,
              });

            return (
              <div key={message.clientKey || message.seq}>
                {startsNewDay(message.createdAt, previous?.createdAt) ? (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-on-surface-variant">
                      {formatDayLabel(message.createdAt)}, {formatClock(message.createdAt)}
                    </span>
                  </div>
                ) : null}

                <div
                  data-testid={`mensaje-${message.seq}`}
                  className={`flex items-end gap-2 ${grouped ? 'mt-1' : 'mt-4'} ${
                    mine ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className="w-8 shrink-0">
                    {!mine && lastOfGroup ? <Avatar name={chat.name} size={32} /> : null}
                  </div>
                  <div className={`max-w-[68%] min-w-0 ${mine ? 'items-end' : ''}`}>
                    <div
                      className={`rounded-xl px-3 py-2 text-sm ${
                        mine
                          ? 'bg-primary text-on-primary'
                          : 'border border-outline/15 bg-surface text-on-surface'
                      }`}
                    >
                      {message.media?.url ? (
                        // La miniatura si está —pesa mucho menos— y la original
                        // si no. Tocarla abre el archivo completo.
                        <a href={message.media.url} target="_blank" rel="noreferrer">
                          <img
                            src={message.media.thumbUrl || message.media.url}
                            alt={message.body ?? 'Adjunto'}
                            className="mb-1 max-h-64 w-full rounded-lg object-cover"
                          />
                        </a>
                      ) : null}
                      {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
                    </div>
                    {lastOfGroup ? (
                      <p
                        className={`mt-1 text-[11px] text-on-surface-variant ${
                          mine ? 'text-right' : ''
                        }`}
                      >
                        {formatClock(message.createdAt)}
                        {mine ? (
                          <span className="ml-1">
                            {
                              DELIVERY_GLYPH[
                                resolveDeliveryState({
                                  // `null` = todavía sin `seq` del server, que
                                  // es exactamente el estado «pendiente».
                                  seq: message.pending ? null : message.seq,
                                  otherReadSeq: chat.othersReadSeq,
                                  otherDeliveredSeq: chat.othersDeliveredSeq,
                                })
                              ]
                            }
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingName ? (
          <div data-testid="escribiendo" className="mt-4 flex items-end gap-2">
            <Avatar name={typingName} size={32} />
            <span className="rounded-xl border border-outline/15 bg-surface px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline"
                    style={{ animationDelay: `${dot * 120}ms` }}
                  />
                ))}
              </span>
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <Composer
        onSend={onSend}
        onCreateEvent={onCreateEvent}
        onCreatePoll={onCreatePoll}
        onEnviarArchivo={onEnviarArchivo}
      />
    </section>
  );
}
