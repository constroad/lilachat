import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { formatClock, formatDayLabel } from '@lilachat/shared';
import type { MensajeEnPantalla } from './types';

/**
 * Las fotos del chat a pantalla completa (W2), como WhatsApp Web: flechas (y
 * las del teclado) para pasar a la anterior o la siguiente, Escape para salir y
 * un botón para bajarla. Antes la foto se abría en otra pestaña.
 */
export function VisorDeFotos(props: { fotos: MensajeEnPantalla[]; indice: number; onCambiar: (indice: number) => void; onCerrar: () => void }) {
  const { fotos, indice, onCambiar, onCerrar } = props;
  const foto = fotos[indice];
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
        <img src={foto.media.url} alt={foto.body ?? 'Foto'} className="max-h-full max-w-full object-contain" />
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
