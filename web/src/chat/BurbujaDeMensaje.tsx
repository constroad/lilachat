import { memo, useContext } from 'react';
import { AlertCircle, BellRing, CalendarDays, FileText, Lock } from 'lucide-react';
import { colorDeAutor, DELIVERY_GLYPH, esAvisoDestacado, formatClock, primerEnlace, resolveDeliveryState, textoDeAviso } from '@lilachat/shared';
import { TarjetaDeEnlace } from './TarjetaDeEnlace';
import { NotaDeVoz } from './NotaDeVoz';
import { useVistaPrevia } from './useVistaPrevia';
import { AnilloDeSubida } from './AnilloDeSubida';
import { ChipDeHilo } from './hilos/ChipDeHilo';
import { MenuDelMensaje } from './MenuDelMensaje';
import { BotonDeReaccionar } from './reacciones/BotonDeReaccionar';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import { TextoDelMensaje } from './TextoDelMensaje';
import { ConversacionContext, useConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** Las clases de color de autor, escritas enteras para que Tailwind las genere. */
const COLOR_DE_AUTOR = ['', 'text-autor-1', 'text-autor-2', 'text-autor-3', 'text-autor-4', 'text-autor-5', 'text-autor-6'];

type Props = {
  mensaje: MensajeEnPantalla;
  mio: boolean;
  /** Primero de su grupo (mismo autor, pocos minutos): más aire arriba. */
  agrupado: boolean;
  /** Último de su grupo: lleva la hora y los checks. */
  ultimoDelGrupo: boolean;
  /** En un grupo, el primero del bloque de otra persona lleva su nombre. */
  conAutor: boolean;
  chat: Pick<ChatSummary, 'othersReadSeq' | 'othersDeliveredSeq'>;
  onReintentar: (clientKey: string) => void;
  onDescartar: (clientKey: string) => void;
};

/**
 * Una burbuja (W1). `memo`: la lista virtualizada vuelve a pintar las filas
 * visibles en cada scroll, y una burbuja que no cambió no tiene por qué.
 */
export const BurbujaDeMensaje = memo(function BurbujaDeMensaje(props: Props) {
  const { mensaje, mio, agrupado, ultimoDelGrupo } = props;
  if (mensaje.kind === 'system') return <LineaDeSistema mensaje={mensaje} />;
  return (
    <div data-testid={`mensaje-${mensaje.clientKey}`} className={`group flex items-start gap-1 ${agrupado ? 'mt-1' : 'mt-3'} ${mio ? 'flex-row-reverse' : ''}`}>
      <div className={`flex max-w-[68%] min-w-0 flex-col ${mio ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            mio ? 'bg-primary text-on-primary' : 'border border-outline/15 bg-surface text-on-surface'
          } ${mensaje.estado === 'fallido' ? 'opacity-70' : ''}`}
        >
          {props.conAutor ? <NombreDelAutor senderId={mensaje.senderId} /> : null}
          {/* Borrado: solo la lápida, sin la cita (como WhatsApp). */}
          {mensaje.replyToSeq && !mensaje.deletedAt ? <CitaDelMensaje seq={mensaje.replyToSeq} mio={mio} /> : null}
          <ContenidoDelMensaje mensaje={mensaje} mio={mio} />
        </div>
        {mensaje.reacciones?.length ? <PastillaDeReacciones mensaje={mensaje} mio={mio} /> : null}
        {mensaje.hilo && mensaje.hilo.respuestas > 0 && !mensaje.deletedAt ? <ChipDeLaRaiz seq={mensaje.seq} hilo={mensaje.hilo} /> : null}
        {mensaje.estado === 'fallido' ? (
          <FalloDelEnvio mensaje={mensaje} onReintentar={props.onReintentar} onDescartar={props.onDescartar} />
        ) : ultimoDelGrupo ? (
          <PieDelMensaje mensaje={mensaje} mio={mio} chat={props.chat} />
        ) : null}
      </div>
      <BotonDeReaccionar mensaje={mensaje} mio={mio} />
      <MenuDelMensaje mensaje={mensaje} mio={mio} />
    </div>
  );
});

function NombreDelAutor({ senderId }: { senderId: string }) {
  const { nombres } = useConversacion();
  return <p className={`mb-0.5 truncate text-[13px] font-semibold ${COLOR_DE_AUTOR[colorDeAutor(senderId)]}`}>{nombres.get(senderId) ?? 'Alguien'}</p>;
}

/** La cita de una respuesta: quién y qué, recortado. Si no está cargado, lo dice. */
function CitaDelMensaje({ seq, mio }: { seq: number; mio: boolean }) {
  const { citado, nombres } = useConversacion();
  const original = citado(seq);
  const texto = original?.deletedAt ? 'Se eliminó este mensaje' : original?.body ?? (original?.media ? 'Archivo' : 'Mensaje anterior');
  return (
    <div data-testid={`cita-${seq}`} className={`mb-1 rounded-lg border-l-4 px-2 py-1 text-[13px] ${mio ? 'border-on-primary/60 bg-black/10' : 'border-primary bg-background'}`}>
      {original ? <p className={`font-semibold ${mio ? '' : COLOR_DE_AUTOR[colorDeAutor(original.senderId)]}`}>{nombres.get(original.senderId) ?? 'Alguien'}</p> : null}
      <p className="line-clamp-2 opacity-90">{texto}</p>
    </div>
  );
}

function ContenidoDelMensaje({ mensaje, mio }: { mensaje: MensajeEnPantalla; mio: boolean }) {
  const { nombres, yo, jwt, chat, onVerFoto } = useConversacion();
  // La tarjeta del primer enlace; los chats secretos no la piden.
  const vista = useVistaPrevia(chat.encrypted || mensaje.media ? null : primerEnlace(mensaje.body), jwt);
  if (mensaje.deletedAt) return <p className="italic opacity-80">Se eliminó este mensaje</p>;
  if (mensaje.envelope) {
    // Chat secreto: la web todavía no tiene un sobre propio (§54.4).
    return (
      <p className="flex items-center gap-1.5 italic opacity-80">
        <Lock size={14} /> Mensaje cifrado: léelo en tu teléfono
      </p>
    );
  }
  const media = mensaje.media;
  if (media?.url && media.mime?.startsWith('audio/')) {
    return <NotaDeVoz url={media.url} durationMs={media.durationMs} onda={media.onda} mio={mio} />;
  }
  const esImagen = Boolean(media?.url && (media.mime?.startsWith('image/') || media.thumbUrl));
  return (
    <>
      {media?.url && esImagen ? (
        <button type="button" data-testid={`foto-${mensaje.clientKey}`} onClick={() => !mensaje.estado && onVerFoto(mensaje)} className="relative block w-full">
          <img
            src={media.thumbUrl || media.url}
            alt={mensaje.body ?? 'Foto'}
            loading="lazy"
            className="mb-1 max-h-64 w-full rounded-lg object-cover"
            style={media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined}
          />
          {mensaje.estado === 'enviando' ? <AnilloDeSubida razon={mensaje.progreso} /> : null}
        </button>
      ) : media?.url ? (
        <a href={media.url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 underline-offset-2 hover:underline">
          <FileText size={18} /> <span className="truncate">{media.fileName ?? 'Archivo'}</span>
        </a>
      ) : null}
      {vista ? <TarjetaDeEnlace vista={vista} mio={mio} /> : null}
      {mensaje.body ? <TextoDelMensaje clave={mensaje.clientKey} texto={mensaje.body} menciones={mensaje.menciones} nombres={nombres} yo={yo} mio={mio} /> : null}
    </>
  );
}

function PieDelMensaje({ mensaje, mio, chat }: { mensaje: MensajeEnPantalla; mio: boolean; chat: Props['chat'] }) {
  const estado = resolveDeliveryState({
    seq: mensaje.estado === 'enviando' ? null : mensaje.seq,
    otherReadSeq: chat.othersReadSeq,
    otherDeliveredSeq: chat.othersDeliveredSeq,
  });
  return (
    <p className="mt-1 text-[11px] text-on-surface-variant">
      {mensaje.editedAt && !mensaje.deletedAt ? 'Editado · ' : ''}
      {formatClock(mensaje.at)}
      {mio ? (
        <span data-testid={`entrega-${estado}`} className={`ml-1 ${estado === 'read' ? 'text-primary' : ''}`}>
          {DELIVERY_GLYPH[estado]}
        </span>
      ) : null}
    </p>
  );
}

/** «No se envió»: el motivo y las dos salidas, como WhatsApp. Nunca desaparece solo. */
function FalloDelEnvio({ mensaje, onReintentar, onDescartar }: Pick<Props, 'mensaje' | 'onReintentar' | 'onDescartar'>) {
  return (
    <p role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-error">
      <AlertCircle size={14} />
      <span>No se envió{mensaje.motivoDelFallo ? `: ${mensaje.motivoDelFallo}` : ''}</span>
      <button type="button" data-testid={`reintentar-${mensaje.clientKey}`} onClick={() => onReintentar(mensaje.clientKey)} className="min-h-[32px] font-semibold underline">
        Reintentar
      </button>
      <button type="button" data-testid={`descartar-${mensaje.clientKey}`} onClick={() => onDescartar(mensaje.clientKey)} className="min-h-[32px] underline">
        Borrar
      </button>
    </p>
  );
}

/**
 * Una línea de aviso («Fijaste un mensaje», «Ana agregó a Beto»): la frase se
 * arma con el MISMO motor que la app, con los nombres de quien mira y en
 * segunda persona si lo hizo uno. El texto del server es solo el respaldo
 * (decía «902049935 fijó un mensaje»).
 */
function LineaDeSistema({ mensaje }: { mensaje: MensajeEnPantalla }) {
  const contexto = useContext(ConversacionContext);
  const aviso = mensaje.system;
  const nombre = (id: string | undefined, persona?: { phone?: string; name?: string }) =>
    (id ? contexto?.nombres.get(id) : undefined) ?? persona?.name ?? persona?.phone;
  const texto =
    aviso && contexto
      ? textoDeAviso({
          quien: nombre(mensaje.senderId, aviso.quien) ?? 'Alguien',
          esMio: mensaje.senderId === contexto.yo,
          evento: aviso.evento,
          aQuien: nombre(aviso.targetId, aviso.aQuien),
          aMi: aviso.targetId === contexto.yo,
          valor: aviso.valor,
        }) || mensaje.body
      : mensaje.body;
  if (!texto) return null;
  // El recordatorio que sonó o el evento que se acerca (20/10): tarjeta con su ícono.
  if (esAvisoDestacado(aviso?.evento)) {
    const Icono = aviso?.evento === 'evento-pronto' ? CalendarDays : BellRing;
    return (
      <div data-testid={`aviso-destacado-${mensaje.seq}`} className="my-3 flex justify-center">
        <span className="flex max-w-[80%] items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5">
          <Icono size={18} className="shrink-0 text-primary" />
          <span className="text-sm font-semibold">{texto.replace(/^(⏰|📅)\s*/u, '')}</span>
          <span className="text-[11px] text-on-surface-variant">{formatClock(mensaje.at)}</span>
        </span>
      </div>
    );
  }
  return <p className="my-3 text-center text-[12px] text-on-surface-variant">{texto}</p>;
}

/** E3: el chip del hilo, solo donde se puede abrir (en el panel del hilo no se repite). */
function ChipDeLaRaiz({ seq, hilo }: { seq: number; hilo: NonNullable<MensajeEnPantalla['hilo']> }) {
  const contexto = useContext(ConversacionContext);
  if (!contexto?.onAbrirHilo) return null;
  return <ChipDeHilo seq={seq} hilo={hilo} nombres={contexto.nombres} nuevas={contexto.hiloConNuevas?.(seq) ?? false} onAbrir={contexto.onAbrirHilo} />;
}

