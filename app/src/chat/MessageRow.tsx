import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { memo } from 'react';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { CircleAlert, Check, CheckCheck, Clock3, Play } from 'lucide-react-native';
import { AVATAR_DE_AUTOR, colorDeAutor, dondeVaLaHora, mostrarAutor, radiosDeBurbuja } from './burbuja';
import { DeslizarParaResponder } from './DeslizarParaResponder';
import { LineaDeLlamada } from './LineaDeLlamada';
import { CitaDeRespuesta } from './CitaDeRespuesta';
import { TextoDelMensaje } from './TextoDelMensaje';
import { TarjetaDeArchivo } from './TarjetaDeArchivo';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';
import { NotaDeVoz } from './NotaDeVoz';
import { etiquetaDeSubida } from './progresoDeSubida';
import { AnilloDeSubida } from './AnilloDeSubida';
import { copiaLocalDe } from './colaDeArchivos';
import {
  TEXTO_ELIMINADO,
  nombreDeContacto,
  primerEnlace,
  textoDeAviso,
} from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { nombreLimpio } from './archivoDescargado';
import { anchoDeBurbujaConFoto, miniaturaDe } from './filasDelChat';
import {
  formatClock,
  groupsWithPrevious,
  tamanoDeBurbuja,
  type DeliveryState,
} from '@lilachat/shared';

/** La foto o el video con su forma real (FL9); sin dimensiones, el cuadrado. */
const estiloDeFoto = (media: { width?: number; height?: number }) => {
  const { ancho, alto } = tamanoDeBurbuja(media);
  return { width: ancho, height: alto };
};
import type { ChatMessage, PendingMessage } from './useChat';
import { useColores } from '../ui/tema';
import { TarjetaDelChat } from './TarjetaDelChat';
import { Avatar } from '../ui/Avatar';

/**
 * Una fila de la conversación, según el diseño «Chat Detail» de Stitch.
 *
 * Lo que la primera versión NO tenía y el diseño sí dibujaba —y que este
 * componente existe para arreglar—: la **hora bajo cada mensaje**, el **check
 * de entrega** en los propios (los acuses ya estaban en el server desde F2 y no
 * se veían), el **avatar del otro** junto a su burbuja, y el agrupado por
 * emisor (solo el último del bloque lleva la cola).
 */

export type Row = ChatMessage | PendingMessage;

/**
 * ¿Es un archivo y no algo que se vea? Foto y video se muestran; un PDF, un
 * Excel o un zip se abren con otra app y en el chat van como tarjeta.
 */
export const esArchivo = (mime?: string): boolean => {
  const tipo = mime ?? '';
  return tipo !== '' && !tipo.startsWith('image/') && !tipo.startsWith('video/');
};

/** Una nota de voz: se escucha acá mismo, no se abre con nada. */
export const esVoz = (mime?: string): boolean => (mime ?? '').startsWith('audio/');

export const isPending = (row: Row): row is PendingMessage =>
  'pending' in row && row.pending === true;

function FilaDeMensaje({
  item,
  previous,
  next,
  myUserId,
  jwt,
  conVistaPrevia = false,
  nombres,
  entrega,
  esGrupo = false,
  nombreAutor,
  fotoAutor,
  onVerImagen,
  onSeleccionar,
  onResponder,
  citado,
  seleccionado,
  enSeleccion = false,
  onFallido,
  onTocarCita,
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
  citado?: { texto: string; autor: string } | null;
  seleccionado?: boolean;
  /** Tocar un mensaje que NO se envió: reintentar o borrar (FL8). */
  onFallido?: (clientKey: string, motivo: string) => void;
  /** Tocar la cita lleva al mensaje original (FL9). */
  onTocarCita?: (seq: number) => void;
}) {
  const colores = useColores();

  // Los avisos del grupo no son burbujas de nadie: van centrados, chiquitos y
  // sin cola. Se resuelve ANTES que todo lo demás porque nada de lo de abajo
  // —agrupado, checks, avatar— aplica.
  if (!isPending(item) && item.kind === 'system') {
    return <AvisoDelGrupo item={item} myUserId={myUserId} />;
  }
  // La encuesta o el evento publicados en el chat (18/10): una tarjeta para
  // votar o confirmar, no una burbuja de texto.
  if (!isPending(item) && item.ref && jwt) {
    return (
      <TarjetaDelChat
        item={item}
        mia={item.senderId === myUserId}
        jwt={jwt}
        yo={myUserId}
        autor={esGrupo ? { nombre: nombreAutor ?? '', foto: fotoAutor } : undefined}
      />
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
  const meta = { hora, mia: mine, entrega: delivery, id: idDeFila, fallido: Boolean(fallo), editado };
  const subida = etiquetaDeSubida({ razon: isPending(item) ? (item.progreso ?? 0) : 0, fallido: Boolean(fallo) });
  const lugarDeLaHora = dondeVaLaHora({
    conTexto: Boolean(item.body),
    eliminado: !isPending(item) && Boolean(item.deletedAt),
    fotoVisible: esFotoVisible(item),
  });

  const preview = previewDeMensaje(item);

  return (
    <DeslizarParaResponder
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
          testID={!isPending(item) ? `burbuja-${item.seq}` : undefined}
          className={`overflow-hidden ${mine ? 'bg-burbuja-propia' : 'bg-burbuja-ajena'}`}
          style={{
            borderTopLeftRadius: radios.arribaIzq,
            borderTopRightRadius: radios.arribaDer,
            borderBottomLeftRadius: radios.abajoIzq,
            borderBottomRightRadius: radios.abajoDer,
            // Con foto, el pie se ajusta a su ancho (FL11): no queda hueco a la derecha.
            ...(esFotoVisible(item) ? { maxWidth: anchoDeBurbujaConFoto(isPending(item) ? { width: item.mediaAncho, height: item.mediaAlto } : (item.media ?? {})) } : {}),
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
                    : item.replyToSeq && onTocarCita
                      ? () => onTocarCita(item.replyToSeq!)
                      : undefined
              }
            />
          ) : null}

          {!isPending(item) && item.media && esVoz(item.media.mime) ? (
            <NotaDeVoz
              id={`${item.chatId}:${item.seq}`}
              url={item.media.url ?? ''}
              durationMs={item.media.durationMs}
              onda={item.media.onda}
              mia={mine}
            />
          ) : null}

          {/* Un ARCHIVO no es una foto: es una tarjeta con su nombre. */}
          {!isPending(item) && item.media && esArchivo(item.media.mime) && !esVoz(item.media.mime) ? (
            <TarjetaDeArchivo
              seq={item.seq}
              media={item.media}
              mia={mine}
              onPress={() => !isPending(item) && (enSeleccion ? onSeleccionar?.(item.seq) : onVerImagen?.(item.seq))}
            />
          ) : null}

          {!isPending(item) && item.media && miniaturaDe(item.media) && !esArchivo(item.media.mime) ? (
            <Pressable
              testID={`media-${item.seq}`}
              onPress={() => !isPending(item) && (enSeleccion ? onSeleccionar?.(item.seq) : onVerImagen?.(item.seq))}
            >
              <Image
                recyclingKey={item.clientKey}
                // Lo que acabo de mandar sigue con su copia local (no se baja de nuevo).
                source={{ uri: copiaLocalDe(item.clientKey) ?? miniaturaDe(item.media) }}
                style={estiloDeFoto(item.media)}
                contentFit="cover"
                transition={120}
              />
              {/* El PLAY sobre la miniatura. Un video y una foto se veían
                  exactamente igual —la miniatura es un cuadro del video— así
                  que no había forma de saber que eso se podía reproducir. */}
              {(item.media.mime ?? '').startsWith('video/') ? (
                <View
                  testID={`play-${item.seq}`}
                  className="absolute inset-0 items-center justify-center"
                >
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-black/55">
                    <Play size={26} color="#ffffff" fill="#ffffff" />
                  </View>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          {/* La foto que todavia sube: se ve YA, con un velo y su vueltita
              encima. El check aparece recien cuando el server la confirma, que
              es exactamente lo que hace WhatsApp. */}
          {isPending(item) && item.mediaUri && esArchivo(item.mediaMime) ? (
            // Un archivo en vuelo tampoco se previsualiza: se veía un cuadro
            // vacío del color de la burbuja con un porcentaje encima.
            <View
              testID={`archivo-pendiente-${item.clientKey}`}
              className="min-w-[200px] flex-row items-center gap-3 px-3 py-2.5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                {subida.girando ? <ActivityIndicator color={colores['on-burbuja-propia']} /> : <CircleAlert size={20} color={colores.error} />}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-semibold text-on-burbuja-propia" numberOfLines={2}>
                  {item.mediaNombre ?? 'Archivo'}
                </Text>
                <Text className={`text-[11px] ${subida.girando ? 'text-on-burbuja-propia-suave' : 'text-error'}`}>
                  {subida.texto}
                </Text>
              </View>
            </View>
          ) : null}

          {isPending(item) && item.mediaUri && !esArchivo(item.mediaMime) ? (
            <View testID={`media-pendiente-${item.clientKey}`}>
              <Image
                recyclingKey={item.mediaUri}
                source={{ uri: item.mediaUri }}
                style={estiloDeFoto({ width: item.mediaAncho, height: item.mediaAlto })}
                contentFit="cover"
              />
              <AnilloDeSubida razon={item.progreso ?? 0} fallido={!subida.girando} textoDelFallo={subida.texto} />
            </View>
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
          ) : item.body ? (
            <>
            {conVistaPrevia && jwt && !isPending(item) && !item.media && primerEnlace(item.body) ? (
              <VistaPreviaDeEnlace url={primerEnlace(item.body)!} jwt={jwt} mia={mine} />
            ) : null}
            {/* Hora y checks DENTRO, alineados a la última línea (como WhatsApp):
                el texto lleva al final un relleno invisible del ancho de la hora
                y la hora va encima, abajo a la derecha. Cero renglón extra. */}
            <View className="px-3 pb-1.5 pt-1.5">
              <Text className={`text-[15px] leading-[21px] ${mine ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena'}`}>
                <TextoDelMensaje texto={item.body} menciones={isPending(item) ? undefined : item.menciones} nombres={nombres} yo={myUserId} enBurbujaPropia={mine} id={isPending(item) ? item.clientKey : `${item.chatId}:${item.seq}`} />
                {/* El relleno es la MISMA hora, al mismo tamaño e invisible:
                    reserva exactamente su ancho (con espacios de nbsp, la hora
                    se montaba sobre los mensajes cortos). */}
                <Text
                  className="text-[11px]"
                  // Del color de la burbuja y no `transparent`: en Android un
                  // span anidado transparente se pinta gris.
                  style={{ color: mine ? colores['burbuja-propia'] : colores['burbuja-ajena'] }}
                >
                  {`${NBSP}${NBSP}${editado ? `${ETIQUETA_EDITADO}${NBSP}` : ''}${hora}${mine ? RELLENO_CHECKS : NBSP}`}
                </Text>
              </Text>
              <View className="absolute bottom-1 right-2.5">
                <MetaDeMensaje {...meta} />
              </View>
            </View>
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

/** El relleno invisible al final del texto: reserva el lugar de la hora. */
const NBSP = '\u00A0';
/** El lugar de los checks (14 dp) a 11 sp. */
const RELLENO_CHECKS = NBSP.repeat(6);
const TAMANO_CHECK = 14;
const ETIQUETA_EDITADO = 'Editado';

/** Una foto o un video que se ve en la burbuja: la hora va ENCIMA de la imagen. */
function esFotoVisible(item: Row): boolean {
  if (isPending(item)) return Boolean(item.mediaUri) && !esArchivo(item.mediaMime);
  return Boolean(item.media && miniaturaDe(item.media)) && !esArchivo(item.media?.mime) && !item.deletedAt;
}

/**
 * Hora y estado DENTRO de la burbuja. Checks vectoriales, como WhatsApp: uno
 * gris (enviado), dos grises (entregado), dos azules (leído) y un relojito
 * mientras está en la cola. Antes eran glifos de texto y un emoji 🕐.
 */
export function MetaDeMensaje({
  hora,
  mia,
  entrega,
  id,
  sobreFoto = false,
  fallido = false,
  editado = false,
}: {
  hora: string;
  mia: boolean;
  entrega: DeliveryState;
  id: string;
  sobreFoto?: boolean;
  /** No se envió (rechazado para siempre): alerta en vez del reloj. */
  fallido?: boolean;
  /** Se editó: «Editado» antes de la hora, como WhatsApp. */
  editado?: boolean;
}) {
  const colores = useColores();
  // Sobre la propia (violeta sólido, FL13) la hora y los íconos van claros.
  const tono = sobreFoto ? 'white' : mia ? colores['on-burbuja-propia-suave'] : colores['on-surface-variant'];
  const leido = mia ? colores['check-leido-propio'] : colores['check-leido'];
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-[11px]" style={{ color: tono }} testID={`hora-${id}`}>
        {editado ? `${ETIQUETA_EDITADO} ` : ''}
        {hora}
      </Text>
      {mia ? (
        <View testID={`estado-${id}`} accessibilityLabel={`estado ${entrega}`}>
          {fallido ? (
            <CircleAlert size={TAMANO_CHECK - 2} color={colores.error} />
          ) : entrega === 'pending' ? (
            <Clock3 size={TAMANO_CHECK - 2} color={tono} />
          ) : entrega === 'sent' ? (
            <Check size={TAMANO_CHECK} color={tono} />
          ) : (
            <CheckCheck size={TAMANO_CHECK} color={entrega === 'read' ? leido : tono} />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** El chip centrado que separa los días («Hoy», «Ayer», «2 ago»). */
/**
 * Memoizada (FL2): la lista solo vuelve a dibujar una burbuja si cambió algo
 * suyo. Las props que llegan son primitivos o referencias estables (citas por
 * `seq`, callbacks con `useCallback`); un objeto armado en cada render la
 * desactivaría en silencio.
 */
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
function AvisoDelGrupo({ item, myUserId }: { item: ChatMessage; myUserId: string }) {
  const agenda = agendaPorTelefono();
  const aviso = item.system;
  if (aviso?.evento === 'llamada') return <LineaDeLlamada item={item} myUserId={myUserId} />;

  const nombreDe = (persona?: { phone?: string; name?: string }) =>
    persona
      ? nombreDeContacto({ delServidor: persona.name ?? null, telefono: persona.phone ?? null, agenda })
      : '';

  const texto = aviso
    ? textoDeAviso({
        quien: nombreDe(aviso.quien) || 'Alguien',
        esMio: item.senderId === myUserId,
        evento: aviso.evento,
        aQuien: nombreDe(aviso.aQuien) || undefined,
        aMi: aviso.targetId === myUserId,
        valor: aviso.valor,
      }) || item.body || ''
    : (item.body ?? '');

  if (!texto) return null;

  return (
    <View className="items-center py-1.5" testID={`aviso-${item.seq}`}>
      <Text className="rounded-full bg-surface-variant/60 px-3 py-1 text-center text-[11px] text-on-surface-variant">
        {texto}
      </Text>
    </View>
  );
}

/**
 * Un resumen corto de un mensaje, para la cita de una respuesta y para la barra
 * de «respondiendo a». Un texto se muestra tal cual; la media, con su etiqueta.
 */
export function previewDeMensaje(item: Row): string {
  if (isPending(item)) return item.body ?? 'Mensaje';
  if (item.deletedAt) return TEXTO_ELIMINADO;
  if (item.body) return item.body;
  const mime = item.media?.mime ?? '';
  if (mime.startsWith('image/')) return '📷 Foto';
  if (mime.startsWith('video/')) return '🎬 Video';
  if (mime.startsWith('audio/')) return '🎤 Nota de voz';
  if (item.media) return '📎 ' + (item.media.fileName ? nombreLimpio(item.media.fileName) : 'Archivo');
  return 'Mensaje';
}
