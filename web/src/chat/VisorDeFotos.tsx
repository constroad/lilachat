import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, PictureInPicture2, Sticker, X } from 'lucide-react';
import { formatClock, formatDayLabel } from '@lilachat/shared';
import type { MensajeEnPantalla } from './types';
import { openMiniPlayer } from '../media/miniPlayer';

/**
 * Las fotos del chat a pantalla completa (W2), como WhatsApp Web: flechas (y
 * las del teclado) para pasar a la anterior o la siguiente, Escape para salir y
 * un botón para bajarla. Antes la foto se abría en otra pestaña.
 */
export function PhotoViewer(props: { fotos: MensajeEnPantalla[]; indice: number; onCambiar: (indice: number) => void; onCerrar: () => void; /** A GIF of the chat becomes my animated sticker (pending 37); absent in a secret chat. */ onMakeSticker?: (foto: MensajeEnPantalla) => void }) {
  const { fotos, indice, onCambiar, onCerrar } = props;
  const foto = fotos[indice];
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
      if (evento.key === 'ArrowLeft' && indice > 0) onCambiar(indice - 1);
      if (evento.key === 'ArrowRight' && indice < fotos.length - 1) onCambiar(indice + 1);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [indice, fotos.length, onCambiar, onCerrar]);
  if (!foto?.media?.url) return null;
  const boton = 'grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10';
  return (
    <div data-testid="visor-fotos" role="dialog" aria-label="Foto" className="fixed inset-0 z-40 flex flex-col bg-black/95">
      <header className="flex items-center gap-2 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm">{`${formatDayLabel(foto.at)}, ${formatClock(foto.at)}`}</p>
        {props.onMakeSticker && foto.media.mime === 'image/gif' ? (
          <button type="button" data-testid="visor-gif-a-sticker" onClick={() => props.onMakeSticker?.(foto)} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white hover:bg-white/10">
            <Sticker size={18} />
            Convertir en sticker animado
          </button>
        ) : null}
        {foto.media.mime?.startsWith('video/') ? (
          // The mini player (pending 14): it keeps playing from here after the viewer closes.
          <button
            type="button"
            data-testid="visor-mini-reproductor"
            aria-label="Mini reproductor"
            title="Mini reproductor"
            onClick={() => {
              openMiniPlayer({ url: foto.media!.url!, poster: foto.media!.thumbUrl, startAt: video.current?.currentTime ?? 0, title: foto.body || 'Video' });
              onCerrar();
            }}
            className={boton}
          >
            <PictureInPicture2 size={20} />
          </button>
        ) : null}
        <a href={foto.media.url} download target="_blank" rel="noopener noreferrer" aria-label="Descargar" className={boton}>
          <Download size={20} />
        </a>
        <button type="button" aria-label="Cerrar" onClick={onCerrar} className={boton}>
          <X size={22} />
        </button>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
        {indice > 0 ? (
          <button type="button" aria-label="Foto anterior" onClick={() => onCambiar(indice - 1)} className={`${boton} absolute left-2`}>
            <ChevronLeft size={26} />
          </button>
        ) : null}
        <div className="absolute inset-y-0 left-14 right-14 bottom-6">
          {foto.media.mime?.startsWith('video/') ? (
            // Videos too (José, 21/10: the viewer drew them as a broken image).
            <video ref={video} key={foto.clientKey} data-testid="visor-video" src={foto.media.url} poster={foto.media.thumbUrl} controls autoPlay className="h-full w-full object-contain" />
          ) : (
            <FullPhoto key={foto.clientKey} url={foto.media.url} thumb={foto.media.thumbUrl} alt={foto.body ?? 'Foto'} />
          )}
        </div>
        {indice < fotos.length - 1 ? (
          <button type="button" aria-label="Foto siguiente" onClick={() => onCambiar(indice + 1)} className={`${boton} absolute right-2`}>
            <ChevronRight size={26} />
          </button>
        ) : null}
      </div>
      {foto.body ? <p className="px-6 pb-6 text-center text-sm text-white">{foto.body}</p> : null}
    </div>
  );
}

/**
 * The photo starts on the bubble's thumbnail (already in the cache) and the
 * full one fades in over it when it arrives (José, 21/10: it showed black for
 * a moment; WhatsApp is almost instant). Both `contain` on the same box, so
 * they cover each other exactly.
 */
function FullPhoto(props: { url: string; thumb?: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {props.thumb && !loaded ? <img src={props.thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" /> : null}
      <img data-testid="visor-foto" src={props.url} alt={props.alt} onLoad={() => setLoaded(true)} className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${loaded || !props.thumb ? 'opacity-100' : 'opacity-0'}`} />
    </>
  );
}
