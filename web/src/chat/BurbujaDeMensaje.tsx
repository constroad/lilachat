import { LineaDeLlamada } from './LineaDeLlamada';
import { memo, useContext } from 'react';
import { AlertCircle, BellRing, CalendarDays, Check, CheckCheck, Clock, FileText, Lock, Play } from 'lucide-react';
import { colorDeAutor, esAvisoDestacado, type DeliveryState, formatClock, primerEnlace, resolveDeliveryState, textoDeAviso } from '@lilachat/shared';
import { isAnimatedImage } from '@lilachat/shared';
import { GifInBubble } from './gifs/GifInBubble';
import { TarjetaDeEnlace } from './TarjetaDeEnlace';
import { NotaDeVoz } from './NotaDeVoz';
import { useVistaPrevia } from './useVistaPrevia';
import { AnilloDeSubida } from './AnilloDeSubida';
import { ChipDeHilo } from './hilos/ChipDeHilo';
import { MenuDelMensaje } from './MenuDelMensaje';
import { BotCardView } from './BotCardView';
import { BotonDeReaccionar } from './reacciones/BotonDeReaccionar';
import { BotonDeHilo } from './BotonDeHilo';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import { TextoDelMensaje } from './TextoDelMensaje';
import { ContactCardWeb } from './ContactCardWeb';
import { TarjetaDelMensaje } from './tarjetas/TarjetaDelMensaje';
import { NudgeLine, WinkLine } from './nudge';
import { StickerMessage } from './stickers/StickerMessage';
import { ConversacionContext, useConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';
import { Avatar } from '../ui/Avatar';

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
  /** The Slack format (design `s-01`): a flat row instead of the bubble. */
  flat?: boolean;
};

/**
 * Una burbuja (W1). `memo`: la lista virtualizada vuelve a pintar las filas
 * visibles en cada scroll, y una burbuja que no cambió no tiene por qué.
 */
export const BurbujaDeMensaje = memo(function BurbujaDeMensaje(props: Props) {
  const { mensaje, mio, agrupado, ultimoDelGrupo } = props;
  // The reminder that rang or an event coming up: answered like a message (José, 21/10).
  if (mensaje.kind === 'system' && esAvisoDestacado(mensaje.system?.evento)) return <HighlightedNotice message={mensaje} />;
  if (mensaje.kind === 'system' && mensaje.system?.evento === 'llamada') return <LineaDeLlamada mensaje={mensaje} />;
  if (mensaje.kind === 'system') return <LineaDeSistema mensaje={mensaje} />;
  // Deleted for everyone, a nudge or a wink is a deleted message, not its line (22/10).
  if (mensaje.kind === 'zumbido' && !mensaje.deletedAt) return <NudgeFromContext seq={mensaje.seq} mine={mio} senderId={mensaje.senderId} at={mensaje.at} />;
  if (mensaje.kind === 'guino' && !mensaje.deletedAt) return <WinkFromContext seq={mensaje.seq} wink={mensaje.wink} mine={mio} senderId={mensaje.senderId} at={mensaje.at} />;
  if (props.flat) return <FlatMessage {...props} />;
  return (
    <div data-testid={`mensaje-${mensaje.clientKey}`} className={`group flex items-start gap-1 ${agrupado ? 'mt-1' : 'mt-3'} ${mio ? 'flex-row-reverse' : ''}`}>
      <div className={`flex max-w-[68%] min-w-0 flex-col ${mio ? 'items-end' : 'items-start'}`}>
        {/* Una encuesta, un evento o un recordatorio: su tarjeta en vez de la burbuja (W3c). */}
        {mensaje.ref && !mensaje.deletedAt ? (
          <TarjetaDelMensaje mensaje={mensaje} mio={mio} conAutor={props.conAutor} />
        ) : mensaje.kind === 'sticker' && mensaje.media?.url && !mensaje.deletedAt ? (
          <StickerMessage
            message={mensaje}
            url={mensaje.media.url}
            author={props.conAutor ? <NombreDelAutor senderId={mensaje.senderId} /> : null}
            quote={mensaje.hiloDe !== undefined && mensaje.enElChat ? <ThreadQuote root={mensaje.hiloDe} mine={false} /> : mensaje.replyToSeq ? <CitaDelMensaje seq={mensaje.replyToSeq} mio={false} /> : null}
          />
        ) : (
        <div
          className={`rounded-xl px-3 py-2 text-[length:var(--chat-font,14px)] leading-[var(--chat-line,20px)] ${
            mio ? 'bg-primary text-on-primary' : 'border border-outline/15 bg-surface text-on-surface'
          } ${mensaje.estado === 'fallido' ? 'opacity-70' : ''}`}
        >
          {props.conAutor ? <NombreDelAutor senderId={mensaje.senderId} /> : null}
          {/* Borrado: solo la lápida, sin la cita (como WhatsApp). */}
          {mensaje.hiloDe !== undefined && mensaje.enElChat && !mensaje.deletedAt ? <ThreadQuote root={mensaje.hiloDe} mine={mio} /> : null}
          {mensaje.replyToSeq && !mensaje.deletedAt ? <CitaDelMensaje seq={mensaje.replyToSeq} mio={mio} /> : null}
          <ContenidoDelMensaje mensaje={mensaje} mio={mio} />
        </div>
        )}
        {mensaje.reacciones?.length ? <PastillaDeReacciones mensaje={mensaje} mio={mio} /> : null}
        {mensaje.hilo && mensaje.hilo.respuestas > 0 && !mensaje.deletedAt ? <ChipDeLaRaiz seq={mensaje.seq} hilo={mensaje.hilo} /> : null}
        {mensaje.estado === 'fallido' ? (
          <FalloDelEnvio mensaje={mensaje} onReintentar={props.onReintentar} onDescartar={props.onDescartar} />
        ) : ultimoDelGrupo && !mensaje.ref ? (
          <MessageFooter mensaje={mensaje} mio={mio} chat={props.chat} />
        ) : null}
      </div>
      <BotonDeReaccionar mensaje={mensaje} mio={mio} />
      <BotonDeHilo mensaje={mensaje} />
      <MenuDelMensaje mensaje={mensaje} mio={mio} />
    </div>
  );
});

/**
 * A message as a flat row, like Slack (José, 21/10; design
 * `s-01-grupo-formato-slack`): the avatar, then the name, its role and the
 * time, and the text without a bubble. Mine go on the left too, with my name in
 * the accent; messages in a row from the same person go under it. The same
 * actions as the bubble on hover.
 */
function FlatMessage(props: Props) {
  const { mensaje, agrupado } = props;
  const { nombres, photos, yo, badgeOf } = useConversacion();
  const mine = mensaje.senderId === yo;
  const name = nombres.get(mensaje.senderId) ?? (mine ? 'Tú' : 'Alguien');
  // «Tú» next to «Tú» says nothing: the pill only when it adds something.
  const fullBadge = badgeOf?.(mensaje.senderId) ?? null;
  const badge = fullBadge === name ? null : fullBadge;
  return (
    <div data-testid={`mensaje-${mensaje.clientKey}`} className={`group relative flex items-start gap-3 rounded-lg px-1 hover:bg-background/60 ${agrupado ? 'mt-0.5' : 'mt-3'}`}>
      {agrupado ? (
        <span className="w-9 shrink-0 pt-1 text-right text-[10px] text-on-surface-variant opacity-0 group-hover:opacity-100">{formatClock(mensaje.at)}</span>
      ) : (
        <Avatar name={name} foto={photos?.get(mensaje.senderId)} size={36} />
      )}
      <div className="min-w-0 flex-1">
        {agrupado ? null : (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span data-testid={`autor-${mensaje.clientKey}`} className={`truncate text-[15px] font-bold ${mine ? 'text-primary' : ''}`}>{name}</span>
            {badge ? <span className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${mine ? 'bg-primary/10 text-primary' : 'bg-background text-on-surface-variant'}`}>{badge}</span> : null}
            <MessageFooter mensaje={mensaje} mio={mine} chat={props.chat} inline />
          </p>
        )}
        {mensaje.ref && !mensaje.deletedAt ? (
          <div className="max-w-sm"><TarjetaDelMensaje mensaje={mensaje} mio={false} conAutor={false} /></div>
        ) : mensaje.kind === 'sticker' && mensaje.media?.url && !mensaje.deletedAt ? (
          <StickerMessage message={mensaje} url={mensaje.media.url} author={null} quote={mensaje.replyToSeq ? <CitaDelMensaje seq={mensaje.replyToSeq} mio={false} /> : null} />
        ) : (
          <div className={`max-w-2xl text-[length:var(--chat-font,14px)] leading-[var(--chat-line,20px)] ${mensaje.estado === 'fallido' ? 'opacity-70' : ''}`}>
            {mensaje.hiloDe !== undefined && mensaje.enElChat && !mensaje.deletedAt ? <ThreadQuote root={mensaje.hiloDe} mine={false} /> : null}
            {mensaje.replyToSeq && !mensaje.deletedAt ? <CitaDelMensaje seq={mensaje.replyToSeq} mio={false} /> : null}
            <ContenidoDelMensaje mensaje={mensaje} mio={false} />
          </div>
        )}
        {mensaje.reacciones?.length ? <PastillaDeReacciones mensaje={mensaje} mio={false} /> : null}
        {mensaje.hilo && mensaje.hilo.respuestas > 0 && !mensaje.deletedAt ? <ChipDeLaRaiz seq={mensaje.seq} hilo={mensaje.hilo} /> : null}
        {mensaje.estado === 'fallido' ? <FalloDelEnvio mensaje={mensaje} onReintentar={props.onReintentar} onDescartar={props.onDescartar} /> : null}
      </div>
      {/* Hidden with opacity, never `display: none` (José, 21/10): the menus hang from these buttons; when the mouse went into a menu
          the bar vanished, the menu lost its anchor and jumped to the top left, in a loop. While one is open the bar stays. */}
      <div className="pointer-events-none absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-outline/15 bg-surface px-0.5 opacity-0 shadow-sm group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100">
        <BotonDeReaccionar mensaje={mensaje} mio={false} />
        <BotonDeHilo mensaje={mensaje} />
        <MenuDelMensaje mensaje={mensaje} mio={mine} />
      </div>
    </div>
  );
}

/** The nudge line with the author's name as this person knows them. */
function NudgeFromContext({ seq, mine, senderId, at }: { seq: number; mine: boolean; senderId: string; at: string }) {
  const { nombres } = useConversacion();
  return <NudgeLine seq={seq} mine={mine} author={nombres.get(senderId)} at={at} />;
}

/** The wink line, the same way (José, 21/10). */
function WinkFromContext({ seq, wink, mine, senderId, at }: { seq: number; wink?: string; mine: boolean; senderId: string; at: string }) {
  const { nombres } = useConversacion();
  return <WinkLine seq={seq} wink={wink} mine={mine} author={nombres.get(senderId)} at={at} />;
}

function NombreDelAutor({ senderId }: { senderId: string }) {
  const { nombres } = useConversacion();
  return <p className={`mb-0.5 truncate text-[13px] font-semibold ${COLOR_DE_AUTOR[colorDeAutor(senderId)]}`}>{nombres.get(senderId) ?? 'Alguien'}</p>;
}

/**
 * A thread reply also sent to the chat says so, like Slack (José, 20/10: «it
 * reaches the chat without saying which was the original message»): the root,
 * and a click opens the thread. Inside the thread panel it does not show.
 */
function ThreadQuote({ root, mine }: { root: number; mine: boolean }) {
  const { citado, nombres, onAbrirHilo, inThread } = useConversacion();
  if (inThread) return null;
  const rootMessage = citado(root);
  const preview = rootMessage?.deletedAt ? 'Se eliminó este mensaje' : rootMessage?.body ?? (rootMessage?.media ? 'Archivo' : 'Mensaje anterior');
  return (
    <button type="button" data-testid={`cita-hilo-${root}`} onClick={() => onAbrirHilo?.(root)} className={`mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-[13px] ${mine ? 'border-on-primary/60 bg-black/10' : 'border-primary bg-background'}`}>
      <span className="block text-[11px] opacity-80">Respondió en un hilo</span>
      {rootMessage ? <span className={`block font-semibold ${mine ? '' : COLOR_DE_AUTOR[colorDeAutor(rootMessage.senderId)]}`}>{nombres.get(rootMessage.senderId) ?? 'Alguien'}</span> : null}
      <span className="line-clamp-2 block opacity-90">{preview}</span>
    </button>
  );
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
  const { nombres, yo, jwt, chat, onVerFoto, onVerPdf } = useConversacion();
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
  // A bot's card (Lila): its summary in `body` is for the list and notices; here the card itself.
  if (mensaje.card) return <BotCardView card={mensaje.card} chatId={chat.id} seq={mensaje.seq} jwt={jwt} />;
  const media = mensaje.media;
  if (media?.url && media.mime?.startsWith('audio/')) {
    return <NotaDeVoz id={`${chat.id}:${mensaje.seq}`} chatId={chat.id} authorName={mio ? 'Tú' : (nombres.get(mensaje.senderId) ?? chat.name ?? 'Nota de voz')} url={media.url} durationMs={media.durationMs} onda={media.onda} mio={mio} />;
  }
  const esImagen = Boolean(media?.url && (media.mime?.startsWith('image/') || media.mime?.startsWith('video/') || media.thumbUrl));
  // A video lila could not make a thumbnail for (QA 22/10): a dark frame under the play, opening the viewer like the rest.
  const thumblessVideo = Boolean(media?.url && !media.thumbUrl && media.mime?.startsWith('video/'));
  return (
    <>
      {media?.url && isAnimatedImage(media.mime) && !mensaje.estado ? (
        <GifInBubble testId={`gif-${mensaje.clientKey}`} url={media.url} alt={mensaje.body ?? 'GIF'} width={media.width} height={media.height} onOpen={() => onVerFoto(mensaje)} />
      ) : media?.url && esImagen ? (
        <button type="button" data-testid={`foto-${mensaje.clientKey}`} onClick={() => !mensaje.estado && onVerFoto(mensaje)} className="relative block w-full">
          {thumblessVideo ? (
            <span data-testid={`video-sin-miniatura-${mensaje.clientKey}`} className="mb-1 block max-h-64 w-full rounded-lg bg-black" style={{ aspectRatio: media.width && media.height ? `${media.width} / ${media.height}` : '16 / 9' }} />
          ) : (
            <img
              src={media.thumbUrl || media.url}
              alt={mensaje.body ?? 'Foto'}
              loading="lazy"
              className="mb-1 max-h-64 w-full rounded-lg object-cover"
              style={media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined}
            />
          )}
          {mensaje.estado === 'enviando' ? <AnilloDeSubida razon={mensaje.progreso} /> : null}
          {/* A video looked like a photo (José, 21/10): the play over its frame, like the app. */}
          {media.mime?.startsWith('video/') && mensaje.estado !== 'enviando' ? (
            <span className="absolute inset-0 mb-1 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white"><Play size={22} fill="currentColor" /></span></span>
          ) : null}
        </button>
      ) : media?.url && media.mime === 'application/pdf' && onVerPdf && !mensaje.estado ? (
        <button type="button" data-testid={`pdf-${mensaje.clientKey}`} onClick={() => onVerPdf(mensaje)} className="mb-1 flex items-center gap-2 text-left underline-offset-2 hover:underline">
          <FileText size={18} /> <span className="truncate">{media.fileName ?? 'Documento PDF'}</span>
        </button>
      ) : media?.url ? (
        <a href={media.url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 underline-offset-2 hover:underline">
          <FileText size={18} /> <span className="truncate">{media.fileName ?? 'Archivo'}</span>
        </a>
      ) : null}
      {vista ? <TarjetaDeEnlace vista={vista} mio={mio} /> : null}
      {mensaje.kind === 'contact' && mensaje.contact && !mensaje.deletedAt ? (
        // A shared contact (pending 9): the card; its `body` is only the summary for the list and the search.
        <ContactCardWeb contact={mensaje.contact} mio={mio} jwt={jwt} yo={yo} />
      ) : mensaje.body ? (
        <TextoDelMensaje clave={mensaje.clientKey} texto={mensaje.body} menciones={mensaje.menciones} nombres={nombres} yo={yo} mio={mio} />
      ) : null}
    </>
  );
}

function MessageFooter({ mensaje, mio, chat, inline = false }: { mensaje: MensajeEnPantalla; mio: boolean; chat: Props['chat']; /** Next to the name in a flat row, not under the bubble. */ inline?: boolean }) {
  const destacado = useContext(ConversacionContext)?.destacados?.has(mensaje.seq) ?? false;
  const estado = resolveDeliveryState({
    seq: mensaje.estado === 'enviando' ? null : mensaje.seq,
    otherReadSeq: chat.othersReadSeq,
    otherDeliveredSeq: chat.othersDeliveredSeq,
  });
  return (
    <span className={`${inline ? 'text-[12px]' : 'mt-1 block text-[11px]'} text-on-surface-variant`}>
      {/* Lo destaqué (20/10): la estrella antes de la hora, como WhatsApp. */}
      {destacado ? <span data-testid={`destacado-${mensaje.clientKey}`} className="mr-1 text-primary">★</span> : null}
      {mensaje.editedAt && !mensaje.deletedAt ? 'Editado · ' : ''}
      {formatClock(mensaje.at)}
      {/* The app's icons, right next to the time (José, 22/10: the «✓✓» text sat apart, and read was not visible in dark mode). */}
      {mio ? <DeliveryIcon estado={estado} /> : null}
    </span>
  );
}

const DELIVERY_LABEL: Record<DeliveryState, string> = { pending: 'Enviando', sent: 'Enviado', delivered: 'Entregado', read: 'Leído' };

function DeliveryIcon({ estado }: { estado: DeliveryState }) {
  const Icon = estado === 'pending' ? Clock : estado === 'sent' ? Check : CheckCheck;
  return (
    <span data-testid={`entrega-${estado}`} role="img" aria-label={DELIVERY_LABEL[estado]} title={DELIVERY_LABEL[estado]} className={`ml-0.5 inline-flex align-[-2px] ${estado === 'read' ? 'text-check-leido' : ''}`}>
      <Icon size={14} strokeWidth={2.4} />
    </span>
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
  const text = useNoticeText(mensaje);
  const context = useContext(ConversacionContext);
  if (!text) return null;
  // «Aracely se unió a Lilachat»: who invited her greets her with one click, like Telegram (José, 21/10).
  const greet = mensaje.system?.evento === 'se-unio' && mensaje.senderId !== context?.yo && context?.canGreet?.(mensaje.seq) ? context.onGreet : undefined;
  return (
    <div className="my-3 flex flex-col items-center gap-2">
      <p className="text-center text-[12px] text-on-surface-variant">{text}</p>
      {greet ? <button type="button" data-testid="saludar-al-unirse" onClick={greet} className="h-9 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">Saludar 👋</button> : null}
    </div>
  );
}

/** The notice's sentence with the names this person knows; the server's `body` if it cannot be built. */
function useNoticeText(message: MensajeEnPantalla): string | undefined {
  const context = useContext(ConversacionContext);
  const notice = message.system;
  if (!notice || !context) return message.body;
  const nameOf = (id: string | undefined, person?: { phone?: string; name?: string }) => (id ? context.nombres.get(id) : undefined) ?? person?.name ?? person?.phone;
  return (
    textoDeAviso({
      quien: nameOf(message.senderId, notice.quien) ?? 'Alguien',
      esMio: message.senderId === context.yo,
      evento: notice.evento,
      aQuien: nameOf(notice.targetId, notice.aQuien),
      aMi: notice.targetId === context.yo,
      valor: notice.valor,
    }) || message.body
  );
}

/**
 * The reminder that rang or the event coming up (20/10), a card in the middle
 * with the hover actions of any message (21/10): react, reply in a thread and
 * the menu (reply, copy, pin, star). Nobody wrote it, so it is never «mine».
 */
function HighlightedNotice({ message }: { message: MensajeEnPantalla }) {
  const text = useNoticeText(message);
  if (!text) return null;
  const Icon = message.system?.evento === 'evento-pronto' ? CalendarDays : BellRing;
  return (
    <div data-testid={`aviso-destacado-${message.seq}`} className="group my-3 flex items-center justify-center gap-1">
      <div className="flex max-w-[80%] min-w-0 flex-col items-center">
        <span className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5">
          <Icon size={18} className="shrink-0 text-primary" />
          <span className="text-sm font-semibold">{text.replace(/^(⏰|📅)\s*/u, '')}</span>
          <span className="text-[11px] text-on-surface-variant">{formatClock(message.at)}</span>
        </span>
        {message.reacciones?.length ? <PastillaDeReacciones mensaje={message} mio={false} /> : null}
        {message.hilo && message.hilo.respuestas > 0 ? <ChipDeLaRaiz seq={message.seq} hilo={message.hilo} /> : null}
      </div>
      <BotonDeReaccionar mensaje={message} mio={false} />
      <BotonDeHilo mensaje={message} />
      <MenuDelMensaje mensaje={message} mio={false} />
    </div>
  );
}

/** E3: el chip del hilo, solo donde se puede abrir (en el panel del hilo no se repite). */
function ChipDeLaRaiz({ seq, hilo }: { seq: number; hilo: NonNullable<MensajeEnPantalla['hilo']> }) {
  const contexto = useContext(ConversacionContext);
  if (!contexto?.onAbrirHilo) return null;
  return <ChipDeHilo seq={seq} hilo={hilo} nombres={contexto.nombres} photos={contexto.photos} nuevas={contexto.hiloConNuevas?.(seq) ?? false} onAbrir={contexto.onAbrirHilo} />;
}

