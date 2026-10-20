import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FileText } from 'lucide-react';
import type { BaseLocal } from '../../local/baseLocal';
import type { MensajeEnPantalla } from '../types';

const MINIATURAS = 3;

/**
 * «Archivos, enlaces y documentos» (W3b): lo que ya está en este navegador
 * (la base local), sin pedir nada al server. Tocar una foto la abre en el visor.
 */
export function ArchivosDelChat(props: { base: BaseLocal | null; chatId: string; onVerFoto: (mensaje: MensajeEnPantalla) => void }) {
  const adjuntos = useLiveQuery(
    async () => (props.base ? props.base.mensajes.where('chatId').equals(props.chatId).filter((uno) => Boolean(uno.media?.url) && !uno.deletedAt).toArray() : []),
    [props.base, props.chatId],
    []
  );
  if (!adjuntos.length) return null;
  const recientes = [...adjuntos].sort((a, b) => b.seq - a.seq).slice(0, MINIATURAS);
  return (
    <section data-testid="archivos-del-chat" className="mt-2 bg-surface px-6 py-4">
      <div className="flex items-center justify-between text-sm text-on-surface-variant">
        <span>Archivos, enlaces y documentos</span>
        <span className="flex items-center gap-1 tabular-nums">
          {adjuntos.length} <ChevronRight size={14} />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {recientes.map((mensaje) => {
          const esFoto = mensaje.media?.mime?.startsWith('image/') || Boolean(mensaje.media?.thumbUrl);
          return (
            <button key={mensaje.clientKey} type="button" data-testid="miniatura-archivo" onClick={() => esFoto && props.onVerFoto(mensaje)} className="aspect-square overflow-hidden rounded-lg bg-background">
              {esFoto ? (
                <img src={mensaje.media?.thumbUrl ?? mensaje.media?.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="grid h-full place-items-center text-on-surface-variant">
                  <FileText size={22} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
