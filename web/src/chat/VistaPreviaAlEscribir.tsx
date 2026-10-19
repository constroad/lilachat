import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { primerEnlace } from '@lilachat/shared';
import { useVistaPrevia } from './useVistaPrevia';

/** Se pide al dejar de tipear: una tarjeta por tecla serían diez pedidos por enlace. */
const ESPERA_AL_TIPEAR_MS = 600;

/**
 * La tarjeta del enlace que se está escribiendo (W2), arriba del campo, con
 * una X para quitarla. Al enviar, la burbuja muestra la suya (misma caché).
 */
export function VistaPreviaAlEscribir({ texto, jwt }: { texto: string; jwt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [descartada, setDescartada] = useState<string | null>(null);
  useEffect(() => {
    const espera = setTimeout(() => setUrl(primerEnlace(texto)), ESPERA_AL_TIPEAR_MS);
    return () => clearTimeout(espera);
  }, [texto]);
  const vista = useVistaPrevia(url && url !== descartada ? url : null, jwt);
  if (!vista || !texto.trim()) return null;
  return (
    <div data-testid="vista-al-escribir" className="mb-2 flex items-start gap-3 rounded-lg border-l-4 border-primary bg-background p-2">
      {vista.imagen ? <img src={vista.imagen} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded object-cover" /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{vista.titulo}</p>
        {vista.descripcion ? <p className="line-clamp-2 text-[12px] text-on-surface-variant">{vista.descripcion}</p> : null}
        <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{vista.sitio}</p>
      </div>
      <button type="button" aria-label="Quitar la vista previa" onClick={() => setDescartada(url)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
        <X size={16} />
      </button>
    </div>
  );
}
