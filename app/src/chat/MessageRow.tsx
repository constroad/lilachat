import { Pressable, Text, View } from 'react-native';
import { memo } from 'react';
import * as Haptics from 'expo-haptics';
import { CircleAlert } from 'lucide-react-native';
import { AVATAR_DE_AUTOR, colorDeAutor, dondeVaLaHora, mostrarAutor, radiosDeBurbuja } from './burbuja';
import { DeslizarParaResponder } from './DeslizarParaResponder';
import { HighlightedNotice } from './HighlightedNotice';
import { LineaDeLlamada } from './LineaDeLlamada';
import { CitaDeRespuesta } from './CitaDeRespuesta';
import { TextoConHora } from './TextoConHora';
import { MetaDeMensaje } from './MetaDeMensaje';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';
import {
  TEXTO_ELIMINADO,
  esAvisoDestacado,
  nombreDeContacto,
  primerEnlace,
  sharedByLine,
  textoDeAviso,
} from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { nombreLimpio } from './archivoDescargado';
import { anchoDeBurbujaConFoto, miniaturaDe, type Citado } from './filasDelChat';
import {
  formatClock,
  groupsWithPrevious,
  type DeliveryState,
} from '@lilachat/shared';

export { MetaDeMensaje } from './MetaDeMensaje';

import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';
import { TarjetaDelChat } from './TarjetaDelChat';
import { NudgeLine, WinkLine } from './nudge';
import { StickerMessage } from './stickers/StickerMessage';
import { Avatar } from '../ui/Avatar';
import { MessageMedia } from './MessageMedia';
import { AlbumGrid } from './AlbumGrid';
import { BotCardView } from './BotCardView';
import { drawsAsCard, drawsAsFunLine, isFileMime, isPending, type Row } from './rowKinds';
import { rememberBubbleWidth } from './bubbleWidths';
import { showGifOptions } from './gifs/gifOptions';
import { ContactCard } from './contactCard/ContactCard';
import { LocationCard } from './location/LocationCard';

/**
 * Una fila de la conversación, según el diseño «Chat Detail» de Stitch.
 *
 * Lo que la primera versión NO tenía y el diseño sí dibujaba —y que este
 * componente existe para arreglar—: la **hora bajo cada mensaje**, el **check
 * de entrega** en los propios (los acuses ya estaban en el server desde F2 y no
 * se veían), el **avatar del otro** junto a su burbuja, y el agrupado por
 * emisor (solo el último del bloque lleva la cola).
 */

export { isPending, type Row } from './rowKinds';

function FilaDeMensaje({
  item,
  previous,
  next,
  myUserId,
  jwt,
  conVistaPrevia = false,
  nombres,
  everyName,
  entrega,
  esGrupo = false,
  nombreAutor,
  fotoAutor,
  onGreet,
  onVerImagen,
  onSeleccionar,
  onResponder,
  citado,
  seleccionado,
  enSeleccion = false,
  onFallido,
  onTocarCita,
  onAbrirHilo,
  destacado = false,
  album,
}: {
  item: Row;
  previous?: Row;
  next?: Row;
  myUserId: string;
  /** Para las tarjetas de encuesta y evento, que leen y votan por su cuenta. */
  jwt?: string;
  /** La tarjeta de los enlaces (FL13d). Apagada en los chats secretos: el server no ve sus links. */
  conVistaPrevia?: boolean;
  /** Los nombres del grupo, para dibujar cada @mención con el tuyo (18/10). */
  nombres?: ReadonlyMap<string, string>;
  /** Everyone's name, also in a 1:1: a checklist says who ticked each task. */
  everyName?: ReadonlyMap<string, string>;
  /**
   * El check, ya resuelto y SOLO en las propias (FL12, §49 #3). Antes llegaban
   * los cursores a todas las filas: cada acuse cambiaba una prop en todas y el
   * `memo` no frenaba nada, ni siquiera en las ajenas, que no dibujan check.
   */
  entrega?: DeliveryState;
  /** En un grupo se muestran nombre y avatar de cada autor; en un 1:1, no. */
  esGrupo?: boolean;
  /** El nombre de quien escribió (resuelto con la agenda), en un grupo. */
  nombreAutor?: string;
  /** Su foto de perfil, si tiene (FL13d). */
  fotoAutor?: string;
  /** «Saludar 👋» on «X se unió a Lilachat». */
  onGreet?: () => void;
  /** Abre el visor a pantalla completa. */
  /** Abre el visor en esta foto (por su `seq`: la URL no la identifica). */
  onVerImagen?: (seq: number) => void;
  /** Pulsación larga: entra en modo selección; en él, cada toque suma o saca (FL9). */
  onSeleccionar?: (seq: number) => void;
  /** Hay mensajes elegidos: un toque elige en vez de abrir. */
  enSeleccion?: boolean;
  /** Deslizar sobre el mensaje: responderlo (como WhatsApp). */
  onResponder?: (seq: number, textoPreview: string, mio: boolean) => void;
  /** El mensaje al que ESTE responde, ya resuelto, para pintar la cita. */
  citado?: Citado | null;
  seleccionado?: boolean;
  /** Tocar un mensaje que NO se envió: reintentar o borrar (FL8). */
  onFallido?: (clientKey: string, motivo: string) => void;
  /** Tocar la cita lleva al mensaje original (FL9). */
  onTocarCita?: (seq: number) => void;
  /** A thread reply sent to the chat: its quote opens the thread (20/10). */
  onAbrirHilo?: (seq: number) => void;
  /** Lo destaqué (20/10): estrella junto a la hora. */
  destacado?: boolean;
  /** The first photo of an album (pending 12): it draws the card with all of them. */
  album?: readonly ChatMessage[];
}) {
  const colores = useColores();
  // Which photo of an album is showing: on the first one, swiping right replies (pending 70).

  // Los avisos del grupo no son burbujas de nadie: van centrados, chiquitos y
  // sin cola. Se resuelve ANTES que todo lo demás porque nada de lo de abajo
  // —agrupado, checks, avatar— aplica.
  // The reminder that rang or an event coming up: answered like a message (José, 21/10).
  if (!isPending(item) && item.kind === 'system' && esAvisoDestacado(item.system?.evento)) {
    return <HighlightedNotice item={item} text={noticeText(item, myUserId)} mine={item.senderId === myUserId} selecting={Boolean(enSeleccion)} selected={Boolean(seleccionado)} onSelect={onSeleccionar} onReply={onResponder} jwt={jwt} />;
  }
  if (!isPending(item) && item.kind === 'system') {
    return <GroupNotice item={item} myUserId={myUserId} onGreet={onGreet} />;
  }
  // The MSN nudge (backlog 3): a line, not a bubble.
  if (drawsAsFunLine(item) && !isPending(item) && item.kind === 'zumbido') return <NudgeLine seq={item.seq} mine={item.senderId === myUserId} author={nombreAutor} at={item.at} />;
  if (drawsAsFunLine(item) && !isPending(item) && item.kind === 'guino') return <WinkLine seq={item.seq} wink={item.wink} mine={item.senderId === myUserId} author={nombreAutor} at={item.at} />;
  // La encuesta o el evento publicados en el chat (18/10): una tarjeta para
  // votar o confirmar, no una burbuja de texto.
  // Deleted for everyone, it is a deleted message (22/10).
  if (drawsAsCard(item) && !isPending(item) && jwt) {
    return (
      <TarjetaDelChat
        item={item}
        mia={item.senderId === myUserId}
        jwt={jwt}
        yo={myUserId}
        autor={esGrupo ? { nombre: nombreAutor ?? '', foto: fotoAutor } : undefined}
        everyName={everyName}
        onSeleccionar={onSeleccionar}
        enSeleccion={enSeleccion}
        seleccionado={seleccionado}
        onResponder={onResponder}
      />
    );
  }

  // A sticker (20/10): no bubble, the time on top; as a reply, the quote above it.
  if (!isPending(item) && item.kind === 'sticker' && item.media?.url && !item.deletedAt && jwt) {
    const isMine = item.senderId === myUserId;
    const quotePress = enSeleccion ? () => onSeleccionar?.(item.seq) : quoteAction(citado, item.replyToSeq, onAbrirHilo, onTocarCita);
    return (
      <StickerMessage item={item} mine={isMine} jwt={jwt} delivery={entrega ?? 'sent'} starred={destacado} author={esGrupo && !isMine ? { name: nombreAutor ?? '', photo: fotoAutor } : undefined}
        onSelect={onSeleccionar} selecting={enSeleccion} selected={Boolean(seleccionado)} onReply={onResponder}
        quote={citado ? <CitaDeRespuesta citado={citado} enBurbujaPropia={false} testID={`cita-${item.seq}`} onPress={quotePress} /> : undefined} />
    );
  }

  const mine = isPending(item) || item.senderId === myUserId;
  const at = isPending(item) ? item.queuedAt : item.at;
  const senderId = isPending(item) ? myUserId : item.senderId;

  const grouped = groupsWithPrevious({
    senderId,
    at,
    previousSenderId: previous ? (isPending(previous) ? myUserId : previous.senderId) : undefined,
    previousAt: previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined,
  });
  // Solo el ÚLTIMO del bloque lleva la cola, como en el diseño.
  const nextGrouped = next
    ? groupsWithPrevious({
        senderId: isPending(next) ? myUserId : next.senderId,
        at: isPending(next) ? next.queuedAt : next.at,
        previousSenderId: senderId,
        previousAt: at,
      })
    : false;

  const delivery: DeliveryState = entrega ?? (isPending(item) ? 'pending' : 'sent');

  const radios = radiosDeBurbuja({ mia: mine, conAnterior: grouped, conSiguiente: nextGrouped });
  const conAutor = mostrarAutor({ esGrupo, mia: mine, conAnterior: grouped });
  const colorAutor = colores[`autor-${colorDeAutor(senderId)}` as keyof typeof colores] as string;
  const hora = formatClock(at);
  const idDeFila = isPending(item) ? item.clientKey : String(item.seq);
  const fallo = isPending(item) ? item.fallo : undefined;
  const editado = !isPending(item) && Boolean(item.editedAt) && !item.deletedAt;
  const meta = { hora, mia: mine, entrega: delivery, id: idDeFila, fallido: Boolean(fallo), editado, destacado };
  // A bot's card: drawn whole, with the time on its own line (its `body` is only the summary).
  const botCard = !isPending(item) && jwt ? item.card : undefined;
  // A shared contact (pending 9): drawn as a card, its `body` is only the summary; the time on its own line.
  const contacto = !isPending(item) && item.kind === 'contact' && !item.deletedAt && jwt ? item.contact : undefined;
  // A shared location (pending 11): the map card; its `body` is only «Ubicación».
  const sharedLocation = !isPending(item) && item.kind === 'location' && !item.deletedAt ? item.location : undefined;
  const lugarDeLaHora = dondeVaLaHora({
    conTexto: Boolean(item.body) && !botCard && !contacto && !sharedLocation,
    eliminado: !isPending(item) && Boolean(item.deletedAt),
    fotoVisible: esFotoVisible(item),
  });

  const preview = previewDeMensaje(item);

  return (
    <DeslizarParaResponder
      // An album's sideways swipes move its photos; on the first photo (nothing before it) swiping right replies (José, 22/10, pending 70).
      habilitado={!isPending(item) && !enSeleccion}
      onResponder={() => !isPending(item) && onResponder?.(item.seq, preview, mine)}
    >
    <View
      className={`-mx-3 flex-row items-end gap-2 px-3 ${grouped ? 'pt-0.5' : 'pt-3'} ${mine ? 'justify-end' : ''} ${seleccionado ? 'bg-primary/15' : ''}`}
    >
      {/* El avatar va SOLO en grupos (en un 1:1 se sabe quién es, como
          WhatsApp) y solo junto al ÚLTIMO del bloque ajeno, con la inicial de
          quien escribió — antes salía la del NOMBRE DEL GRUPO en todos. */}
      {!mine && esGrupo ? (
        nextGrouped ? (
          <View style={{ width: AVATAR_DE_AUTOR }} />
        ) : (
          <Avatar nombre={nombreAutor ?? ''} foto={fotoAutor} tamano={AVATAR_DE_AUTOR} />
        )
      ) : null}

      <View className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
        {/* La pulsación LARGA selecciona, como en WhatsApp. Un toque corto no
            hace nada acá: se reserva para abrir la foto. */}
        <Pressable
          // Un mensaje que no se envió se toca para decidir qué hacer con él;
          // con mensajes elegidos, el toque suma o saca este (FL9).
          onPress={
            isPending(item)
              ? item.fallo
                ? () => onFallido?.(item.clientKey, item.fallo!)
                : undefined
              : enSeleccion
                ? () => onSeleccionar?.(item.seq)
                : undefined
          }
          onLongPress={() => {
            if (isPending(item)) return;
            // El tick de «quedó seleccionado», como WhatsApp.
            void Haptics.selectionAsync();
            onSeleccionar?.(item.seq);
          }}
          delayLongPress={350}
          // A bubble with a thread tells its width: the chip under it takes it (22/10).
          onLayout={!isPending(item) && item.hilo?.respuestas ? (event) => rememberBubbleWidth(`${item.chatId}:${item.seq}`, event.nativeEvent.layout.width) : undefined}
          testID={!isPending(item) ? `burbuja-${item.seq}` : undefined}
          className={`overflow-hidden ${mine ? 'bg-burbuja-propia' : 'bg-burbuja-ajena'}`}
          style={{
            borderTopLeftRadius: radios.arribaIzq,
            borderTopRightRadius: radios.arribaDer,
            borderBottomLeftRadius: radios.abajoIzq,
            borderBottomRightRadius: radios.abajoDer,
            // Con foto, el pie se ajusta a su ancho (FL11): no queda hueco a la derecha.
            // An album sets its own width (3/4 of the screen, pending 70); a photo, the photo's.
            ...(!album && esFotoVisible(item) ? { maxWidth: anchoDeBurbujaConFoto(isPending(item) ? { width: item.mediaAncho, height: item.mediaAlto } : (item.media ?? {})) } : {}),
          }}
        >
          {conAutor && nombreAutor ? (
            <Text
              testID={`autor-${idDeFila}`}
              className="px-3 pt-1.5 text-[13px] font-semibold"
              style={{ color: colorAutor }}
              numberOfLines={1}
            >
              {nombreAutor}
            </Text>
          ) : null}
          {/* La cita llega resuelta desde la pantalla, que tiene todos los mensajes. */}
          {citado ? (
            <CitaDeRespuesta
              citado={citado}
              enBurbujaPropia={mine}
              testID={`cita-${isPending(item) ? item.clientKey : item.seq}`}
              onPress={
                isPending(item)
                  ? undefined
                  : enSeleccion
                    ? () => onSeleccionar?.(item.seq)
                    : quoteAction(citado, item.replyToSeq, onAbrirHilo, onTocarCita)
              }
            />
          ) : null}

          {album ? <AlbumGrid items={album} selecting={enSeleccion} onSelect={onSeleccionar} onOpen={onVerImagen} /> : <MessageMedia item={item} mine={mine} selecting={enSeleccion} onSelect={onSeleccionar} onOpen={onVerImagen} onGifTap={jwt && !isPending(item) ? (seq) => showGifOptions({ jwt, chatId: item.chatId, seq, onOpen: () => onVerImagen?.(seq) }) : undefined} author={{ name: mine ? 'Tú' : (nombreAutor ?? ''), photo: fotoAutor }} />}

          {!isPending(item) && item.sharedBy && !item.deletedAt ? (
            <Text testID={`compartido-por-${item.seq}`} className="px-3 pt-1 text-[12px] text-on-surface-variant">{sharedByLine(item.sharedBy)}</Text>
          ) : null}
          {!isPending(item) && item.deletedAt ? (
            /**
             * La lápida. NO es un hueco: si el mensaje desapareciera sin rastro,
             * la conversación del otro cambiaría de sentido —respuestas colgando
             * de algo que ya no está— sin que se entere. En cursiva y apagado
             * para que se lea distinto de un mensaje de verdad.
             */
            <Text
              testID={`eliminado-${item.seq}`}
              className={`px-3 py-1.5 text-[15px] italic ${mine ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}
            >
              {TEXTO_ELIMINADO}
            </Text>
          ) : botCard && jwt && !isPending(item) ? (
            <BotCardView card={botCard} chatId={item.chatId} seq={item.seq} jwt={jwt} />
          ) : contacto && jwt ? (
            <ContactCard contact={contacto} mine={mine} jwt={jwt} myUserId={myUserId} />
          ) : sharedLocation ? (
            <LocationCard location={sharedLocation} mine={mine} />
          ) : item.body ? (
            <>
            {conVistaPrevia && jwt && !isPending(item) && !item.media && primerEnlace(item.body) ? (
              <VistaPreviaDeEnlace url={primerEnlace(item.body)!} jwt={jwt} mia={mine} />
            ) : null}
            {/* Hora y checks DENTRO, alineados a la última línea (como WhatsApp). */}
            <TextoConHora texto={item.body} menciones={isPending(item) ? undefined : item.menciones} nombres={nombres} yo={myUserId} id={isPending(item) ? item.clientKey : `${item.chatId}:${item.seq}`} meta={meta} />
            </>
          ) : null}

          {/* Lo que no es texto (foto, voz, archivo, borrado) lleva la hora en
              su propio renglón dentro de la burbuja; sobre una foto, encima. */}
          {lugarDeLaHora === 'sobre-la-foto' ? (
            <View className="absolute bottom-1.5 right-2 rounded-full bg-black/35 px-1.5 py-0.5">
              <MetaDeMensaje {...meta} sobreFoto />
            </View>
          ) : lugarDeLaHora === 'renglon-propio' ? (
            <View className="flex-row justify-end px-2.5 pb-1.5">
              <MetaDeMensaje {...meta} />
            </View>
          ) : null}
        </Pressable>

        {fallo ? (
          <Pressable
            testID={`fallo-${idDeFila}`}
            onPress={() => isPending(item) && onFallido?.(item.clientKey, fallo)}
            className="mt-1 min-h-[28px] flex-row items-center gap-1"
          >
            <CircleAlert size={13} color={colores.error} />
            <Text className="text-[11px] text-error">No se envió · Toca para reintentar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
    </DeslizarParaResponder>
  );
}

/** Una foto o un video que se ve en la burbuja: la hora va ENCIMA de la imagen. */
function esFotoVisible(item: Row): boolean {
  if (isPending(item)) return Boolean(item.mediaUri) && !isFileMime(item.mediaMime);
  return Boolean(item.media && miniaturaDe(item.media)) && !isFileMime(item.media?.mime) && !item.deletedAt;
}

/** El chip centrado que separa los días («Hoy», «Ayer», «2 ago»). */
/**
 * Memoizada (FL2): la lista solo vuelve a dibujar una burbuja si cambió algo
 * suyo. Las props que llegan son primitivos o referencias estables (citas por
 * `seq`, callbacks con `useCallback`); un objeto armado en cada render la
 * desactivaría en silencio.
 */
/** Tapping a quote: a thread reference opens the thread; a reply goes to the quoted message. */
export function quoteAction(quote: Citado | null | undefined, replyToSeq: number | undefined, openThread?: (seq: number) => void, goToQuote?: (seq: number) => void): (() => void) | undefined {
  if (quote?.enHilo && openThread) return () => openThread(quote.enHilo!);
  if (replyToSeq && goToQuote) return () => goToQuote(replyToSeq);
  return undefined;
}

export const MessageRow = memo(FilaDeMensaje);

export function DaySeparator({ label }: { label: string }) {
  return (
    <View className="my-3 items-center">
      {/* Chip blanco sobre el fondo del chat, como el diseño (antes celeste). */}
      <View className="rounded-full bg-surface px-3 py-1 shadow-sm">
        <Text className="text-[12px] font-medium text-on-surface-variant">{label}</Text>
      </View>
    </View>
  );
}

/**
 * «Wilson agregó a Ana», «Cambiaste la foto del grupo».
 *
 * El nombre sale de TU agenda, igual que en la lista de chats: el server solo
 * conoce el que cada uno se puso, y leer «960397018 agregó a…» fue exactamente
 * la queja que arregló `nombreDeContacto`. Si el aviso llegara sin los datos
 * para resolverlo, se cae al texto que armó el server (`body`) — y si tampoco
 * hay, no se dibuja nada: un renglón vacío en medio de la conversación es peor
 * que la ausencia del aviso.
 */
function GroupNotice({ item, myUserId, onGreet }: { item: ChatMessage; myUserId: string; onGreet?: () => void }) {
  if (item.system?.evento === 'llamada') return <LineaDeLlamada item={item} myUserId={myUserId} />;
  const text = noticeText(item, myUserId);
  if (!text) return null;
  // «Aracely se unió a Lilachat»: who invited her can greet her with one tap, like Telegram (José, 21/10).
  const greet = item.system?.evento === 'se-unio' && item.senderId !== myUserId && onGreet;
  return (
    <View className="items-center gap-2 py-1.5" testID={`aviso-${item.seq}`}>
      <Text className="rounded-full bg-surface-variant/60 px-3 py-1 text-center text-[11px] text-on-surface-variant">
        {text}
      </Text>
      {greet ? (
        <Pressable testID="saludar-al-unirse" onPress={onGreet} className="min-h-[40px] flex-row items-center justify-center rounded-full bg-primary px-5">
          <Text className="text-[14px] font-semibold text-on-primary">Saludar 👋</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The notice's sentence, with the names from YOUR contacts; the server's `body` if it cannot be built. */
function noticeText(item: ChatMessage, myUserId: string): string {
  const notice = item.system;
  if (!notice) return item.body ?? '';
  const contacts = agendaPorTelefono();
  const nameOf = (person?: { phone?: string; name?: string }) =>
    person ? nombreDeContacto({ delServidor: person.name ?? null, telefono: person.phone ?? null, agenda: contacts }) : '';
  return (
    textoDeAviso({
      quien: nameOf(notice.quien) || 'Alguien',
      esMio: item.senderId === myUserId,
      evento: notice.evento,
      aQuien: nameOf(notice.aQuien) || undefined,
      aMi: notice.targetId === myUserId,
      valor: notice.valor,
    }) ||
    item.body ||
    ''
  );
}

/**
 * Un resumen corto de un mensaje, para la cita de una respuesta y para la barra
 * de «respondiendo a». Un texto se muestra tal cual; la media, con su etiqueta.
 */
export function previewDeMensaje(item: Row): string {
  if (isPending(item)) return item.body ?? 'Mensaje';
  if (item.deletedAt) return TEXTO_ELIMINADO;
  if (item.kind === 'sticker') return 'Sticker';
  if (item.body) return item.body;
  const mime = item.media?.mime ?? '';
  if (mime.startsWith('image/')) return '📷 Foto';
  if (mime.startsWith('video/')) return '🎬 Video';
  if (mime.startsWith('audio/')) return '🎤 Nota de voz';
  if (item.media) return '📎 ' + (item.media.fileName ? nombreLimpio(item.media.fileName) : 'Archivo');
  return 'Mensaje';
}
