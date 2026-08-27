import { CalendarDays, MessagesSquare, MessageSquarePlus } from 'lucide-react';

/**
 * El panel derecho sin conversación abierta.
 *
 * Es la primera pantalla de la web, así que lo que ocupe ese espacio importa.
 * Tuvo dos tarjetas de «garantía» y las dos estaban mal:
 *
 * - «Tus mensajes viven en nuestra máquina» le anunciaba a la persona que
 *   guardamos lo que escribe. Es cierto y es exactamente por eso que no va acá:
 *   nadie abre un chat familiar para que le recuerden dónde queda almacenado.
 * - La del diseño prometía cifrado de extremo a extremo para TODO, y eso solo
 *   vale para los chats secretos.
 *
 * En su lugar van las dos cosas que se pueden HACER desde acá. Es lo que
 * faltaba: la web no ofrecía ninguna forma de crear nada.
 */
export function EmptyState({
  name,
  onNewChat,
  onAgenda,
}: {
  name?: string | null;
  onNewChat: () => void;
  onAgenda?: () => void;
}) {
  return (
    <section
      data-testid="panel-vacio"
      className="flex h-full min-w-0 flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10">
        <MessagesSquare size={36} className="text-primary" />
      </div>

      <h2 className="mt-6 text-2xl font-bold tracking-tight">
        {name ? `Hola, ${name}` : 'Te damos la bienvenida a Lilachat'}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
        Elige una conversación de la izquierda, o empieza una nueva. Lo que escribas se sincroniza
        entre el teléfono y esta pestaña.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="btn-vacio-nuevo-chat"
          onClick={onNewChat}
          className="rounded-xl border border-outline/15 bg-surface p-4 text-left transition-shadow hover:shadow-md"
        >
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10">
            <MessageSquarePlus size={18} className="text-primary" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Empezar un chat</h3>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Escríbele a una persona o arma un grupo con tu equipo.
          </p>
        </button>

        <button
          type="button"
          data-testid="btn-vacio-agenda"
          onClick={onAgenda}
          disabled={!onAgenda}
          className="rounded-xl border border-outline/15 bg-surface p-4 text-left transition-shadow hover:shadow-md disabled:opacity-60"
        >
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/10">
            <CalendarDays size={18} className="text-secondary" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Organizar algo</h3>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Un evento para el próximo encuentro, o una encuesta para decidir entre todos.
          </p>
        </button>
      </div>
    </section>
  );
}
