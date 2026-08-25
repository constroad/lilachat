import { MessagesSquare, MonitorSmartphone, ShieldCheck } from 'lucide-react';

/**
 * El panel derecho sin conversación abierta.
 *
 * El diseño lo trae completo —ilustración, bienvenida y dos tarjetas de
 * garantía— y no como un hueco. Es la primera pantalla que ve alguien que abre
 * la web, así que dejarla en blanco desperdicia el único momento en que hay
 * atención para explicar qué es esto.
 *
 * Las dos tarjetas dicen lo que HOY es cierto. La del diseño prometía «cifrado
 * de extremo a extremo», que es F9 y todavía no existe: shipearla sería mentir
 * sobre seguridad, que es la mentira más cara de todas.
 */
export function EmptyState({ name }: { name?: string | null }) {
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
        Elige una conversación de la izquierda para empezar. Tus mensajes se
        sincronizan entre el teléfono y esta pestaña.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-outline/15 bg-surface p-4 text-left">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10">
            <ShieldCheck size={18} className="text-primary" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Servidor propio</h3>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Tus mensajes viven en nuestra máquina, no en la de un tercero.
          </p>
        </article>

        <article className="rounded-xl border border-outline/15 bg-surface p-4 text-left">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/10">
            <MonitorSmartphone size={18} className="text-secondary" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Multidispositivo</h3>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Sigue donde lo dejaste: el teléfono y la web comparten el historial.
          </p>
        </article>
      </div>
    </section>
  );
}
