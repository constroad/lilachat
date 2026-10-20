import { useEffect, useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { formatBytes, validateMedia } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../ui/Overlay';

/** La forma de una foto, para que la burbuja no salte al cargar. Sin soporte: sin medidas. */
export async function medidasDeImagen(archivo: File): Promise<{ width?: number; height?: number }> {
  if (!archivo.type.startsWith('image/') || typeof createImageBitmap !== 'function') return {};
  try {
    const imagen = await createImageBitmap(archivo);
    const medidas = { width: imagen.width, height: imagen.height };
    imagen.close();
    return medidas;
  } catch {
    return {};
  }
}

/**
 * Lo elegido, antes de mandarlo (W2), como WhatsApp Web: la vista de cada foto
 * o archivo, quitar alguno y un pie para el primero. Lo que el server rechazaría
 * (vacío o demasiado pesado) se marca acá, antes de subir. Las fotos salen más
 * livianas, como en WhatsApp (19/10); «HD» manda la original.
 */
export function EnviarArchivos(props: { archivos: File[]; onCerrar: () => void; onEnviar: (archivos: File[], pie: string, hd: boolean) => void }) {
  const [lista, setLista] = useState(props.archivos);
  const [pie, setPie] = useState('');
  const [hd, setHd] = useState(false);
  const hayFotos = lista.some((archivo) => archivo.type.startsWith('image/') && archivo.type !== 'image/gif');
  const vistas = useMemo(() => lista.map((archivo) => (archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null)), [lista]);
  useEffect(() => () => vistas.forEach((url) => url && URL.revokeObjectURL(url)), [vistas]);
  useEffect(() => {
    if (lista.length === 0) props.onCerrar();
  }, [lista.length, props]);
  const validos = lista.filter((archivo) => validateMedia({ mimeType: archivo.type, sizeBytes: archivo.size }).ok);
  return (
    <Overlay
      title={lista.length === 1 ? 'Enviar 1 archivo' : `Enviar ${lista.length} archivos`}
      onClose={props.onCerrar}
      footer={<PrimaryButton testId="btn-enviar-archivos" disabled={validos.length === 0} onClick={() => props.onEnviar(validos, pie.trim(), hd)}>Enviar</PrimaryButton>}
    >
      <ul className="mb-3 grid grid-cols-3 gap-2">
        {lista.map((archivo, indice) => {
          const veredicto = validateMedia({ mimeType: archivo.type, sizeBytes: archivo.size });
          return (
            <li key={`${archivo.name}-${indice}`} className="relative overflow-hidden rounded-lg border border-outline/15 bg-background">
              {vistas[indice] ? (
                <img src={vistas[indice]!} alt={archivo.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center">
                  <FileText size={24} className="text-on-surface-variant" />
                  <span className="line-clamp-2 text-[11px]">{archivo.name}</span>
                  <span className="text-[10px] text-on-surface-variant">{formatBytes(archivo.size)}</span>
                </div>
              )}
              {!veredicto.ok ? <p role="alert" className="absolute inset-x-0 bottom-0 bg-error px-1 py-0.5 text-[10px] text-white">{veredicto.reason}</p> : null}
              <button type="button" aria-label={`Quitar ${archivo.name}`} onClick={() => setLista((actual) => actual.filter((_, i) => i !== indice))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white">
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {hayFotos ? (
        <label className="mb-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
          <input data-testid="interruptor-hd" type="checkbox" checked={hd} onChange={(evento) => setHd(evento.target.checked)} className="h-5 w-5 accent-primary" />
          <span>
            <span className="font-semibold">Calidad HD</span>
            <span className="block text-[12px] text-on-surface-variant">{hd ? 'Se manda la foto original.' : 'Se manda más liviana, como en WhatsApp.'}</span>
          </span>
        </label>
      ) : null}
      <input data-testid="input-pie" value={pie} onChange={(evento) => setPie(evento.target.value)} placeholder="Añade un comentario" className="min-h-[44px] w-full rounded-lg border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
    </Overlay>
  );
}
