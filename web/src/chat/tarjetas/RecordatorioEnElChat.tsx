import { Bell, Pencil } from 'lucide-react';
import { advanceSummary, whenItRings, primerEnlace, type AgendaReminder } from '@lilachat/shared';
import { PlaceLinksWeb } from '../../agenda/PlaceLinksWeb';
import { useConversacion } from '../contextoDeLaConversacion';
import { TarjetaDeEnlace } from '../TarjetaDeEnlace';
import { TextoDelMensaje } from '../TextoDelMensaje';
import { useVistaPrevia } from '../useVistaPrevia';
import { useTarjeta } from './useTarjeta';
import { TarjetaCargando, TarjetaConFallo, TarjetaQueNoEsta } from './EstadosDeTarjeta';

/**
 * El recordatorio DENTRO del chat (W3c, 20/10): qué, cuándo suena, la
 * descripción con sus links (el primero con su tarjeta) y la imagen. Quien
 * puede (en un grupo, sus admins; en un 1:1 o un borrador, cualquiera) lo edita.
 */
export function RecordatorioEnElChat({ id }: { id: string }) {
  const { jwt, nombres, yo, onEditarRecordatorio } = useConversacion();
  const { valor: recordatorio, fallo, cargar } = useTarjeta<AgendaReminder>({ tipo: 'recordatorio', id, ruta: `/agenda/reminders/${id}`, campo: 'reminder', jwt });
  const vista = useVistaPrevia(recordatorio?.note ? primerEnlace(recordatorio.note) : null, jwt);
  if (recordatorio === null) return <TarjetaQueNoEsta texto="Este recordatorio ya no está." />;
  if (recordatorio === undefined) return fallo ? <TarjetaConFallo texto="No se pudo cargar el recordatorio." onReintentar={() => void cargar()} /> : <TarjetaCargando />;

  return (
    <div data-testid={`recordatorio-en-chat-${id}`}>
      {recordatorio.imageUrl ? <img src={recordatorio.imageUrl} alt="" loading="lazy" className="-mx-4 -mt-4 mb-3 aspect-video w-[calc(100%+2rem)] max-w-none rounded-t-xl object-cover" /> : null}
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Bell size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Recordatorio</p>
          <p className="text-[15px] font-semibold">{recordatorio.title}</p>
          <p className="text-[12px] text-on-surface-variant">{whenItRings(recordatorio)}</p>
          {recordatorio.advance?.length ? <p className="text-[12px] text-on-surface-variant">{advanceSummary(recordatorio.advance)}</p> : null}
        </div>
        {onEditarRecordatorio ? (
          <button type="button" data-testid={`editar-recordatorio-${id}`} aria-label="Editar el recordatorio" title="Editar" onClick={() => onEditarRecordatorio(recordatorio)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background hover:text-primary">
            <Pencil size={15} />
          </button>
        ) : null}
      </div>
      <PlaceLinksWeb location={recordatorio.location} />
      {recordatorio.note ? (
        <div className="mt-2 text-sm">
          <TextoDelMensaje clave={`recordatorio-${id}`} texto={recordatorio.note} nombres={nombres} yo={yo} mio={false} />
        </div>
      ) : null}
      {vista ? <div className="mt-2"><TarjetaDeEnlace vista={vista} mio={false} /></div> : null}
    </div>
  );
}
