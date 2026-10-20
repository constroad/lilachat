import { Play } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { esMiniaturaCompacta, type VistaPreviaDeEnlace } from '@lilachat/shared';

/** Lado de la miniatura de un logo o un perfil, al costado del texto. */
const LADO_DE_LA_MINIATURA = 72;

/**
 * La tarjeta de un enlace: imagen, título, descripción y sitio, como WhatsApp.
 * Un video (YouTube, TikTok, un reel) lleva el play sobre la miniatura; una
 * imagen que no carga (un `og:image` roto) no deja hueco; un logo o una foto de
 * perfil (cuadrada) va chica al costado, como en la app (20/10).
 */
export function TarjetaDeEnlace({ vista, mio }: { vista: VistaPreviaDeEnlace; mio: boolean }) {
  const [sinImagen, setSinImagen] = useState(false);
  const [compacta, setCompacta] = useState(false);
  const imagen = sinImagen ? undefined : vista.imagen;
  const alCargar = (evento: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = evento.currentTarget;
    setCompacta(esMiniaturaCompacta({ ancho: naturalWidth, alto: naturalHeight, video: vista.video }));
  };
  return (
    <a
      href={vista.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="tarjeta-enlace"
      data-compacta={compacta ? 'true' : undefined}
      className={`mb-1 overflow-hidden rounded-lg ${compacta ? 'flex items-center' : 'block'} ${mio ? 'bg-black/10' : 'bg-background'}`}
    >
      {imagen ? (
        <span className="relative block shrink-0">
          <img
            src={imagen}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={alCargar}
            onError={() => setSinImagen(true)}
            className={compacta ? 'object-cover' : 'max-h-44 w-full object-cover'}
            style={compacta ? { width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA } : undefined}
          />
          {vista.video ? (
            <span data-testid="play-tarjeta" className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white">
                <Play size={22} fill="currentColor" />
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
      <div className="min-w-0 px-3 py-2">
        <p className="line-clamp-2 text-[13px] font-semibold">{vista.titulo}</p>
        {vista.descripcion ? <p className="line-clamp-2 text-[12px] opacity-80">{vista.descripcion}</p> : null}
        <p className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">{vista.sitio}</p>
      </div>
    </a>
  );
}
