import type { VistaPreviaDeEnlace } from '@lilachat/shared';

/** La tarjeta de un enlace: imagen, título, descripción y sitio, como WhatsApp. */
export function TarjetaDeEnlace({ vista, mio }: { vista: VistaPreviaDeEnlace; mio: boolean }) {
  return (
    <a
      href={vista.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="tarjeta-enlace"
      className={`mb-1 block overflow-hidden rounded-lg ${mio ? 'bg-black/10' : 'bg-background'}`}
    >
      {vista.imagen ? <img src={vista.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-44 w-full object-cover" /> : null}
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-[13px] font-semibold">{vista.titulo}</p>
        {vista.descripcion ? <p className="line-clamp-2 text-[12px] opacity-80">{vista.descripcion}</p> : null}
        <p className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">{vista.sitio}</p>
      </div>
    </a>
  );
}
