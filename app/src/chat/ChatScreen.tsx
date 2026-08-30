import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Lock,
  MoreVertical,
  Mic,
  Phone,
  Plus,
  Send,
  Smile,
  Video,
  Trash2,
  X,
} from 'lucide-react-native';
import { duracionDeVoz, formatDayLabel, startsNewDay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { AttachSheet } from './AttachSheet';
import { CallScreen } from '../calls/CallScreen';
import { useCall } from '../calls/useCall';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CatchUpBanner } from './CatchUpBanner';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { DaySeparator, MessageRow, isPending, type Row } from './MessageRow';
import { formatClock } from '@lilachat/shared';
import { abrirConOtraApp, compartirFoto, guardarEnGaleria } from './guardarYCompartir';
import { useGrabadorDeVoz } from './useGrabadorDeVoz';
import { VisorDeImagen } from './VisorDeImagen';
import { ChatDetailScreen } from './ChatDetailScreen';
import { useChat } from './useChat';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { decidirAtras } from '../ui/botonAtras';
import { textoDeSubida } from './progresoDeSubida';

/**
 * La conversación (diseño Stitch «Chat de Grupo»). Burbuja propia a la derecha
 * en acento; la ajena a la izquierda en superficie — y la esquina-cola de 4px
 * apunta al emisor, que es el token `rounded-tail` de Vivid Pulse.
 */
export function ChatScreen({
  chatId,
  chatName,
  chatAvatarUrl,
  credential,
  othersReadSeq,
  othersDeliveredSeq,
  unread,
  encrypted,
  otherUserId,
  onBack,
}: {
  chatId: string;
  chatName: string;
  /** La foto del grupo, si tiene. Sin ella se dibuja la inicial. */
  chatAvatarUrl?: string;
  credential: Credential;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Cuántos sin leer traía la lista: decide si la banda de Lila aparece. */
  unread: number;
  /** Chat secreto (F9): cifra, y apaga a Lila. */
  encrypted?: boolean;
  otherUserId?: string | null;
  onBack: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const secreto = useSecretChat({
    credential,
    otherUserId: otherUserId ?? null,
    enabled: Boolean(encrypted),
  });
  const sesionLista = encrypted && secreto.estado === 'listo' ? secreto : null;
  const {
    eliminar,
    messages,
    pending,
    connected,
    othersRead,
    send,
    sendMedia,
    markRead,
    cargandoAnteriores,
    hayAnteriores,
    cargarAnteriores,
  } = useChat({
    chatId,
    token: credential.jwt,
    seal: sesionLista?.seal,
    open: sesionLista?.open,
  });
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  // Crear desde la conversación: el chat YA está elegido, así que las pantallas
  // de crear no vuelven a preguntar dónde.
  const [creando, setCreando] = useState<'event' | 'poll' | null>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  const llamada = useCall({ chatId, peerName: chatName });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * El botón ATRÁS de Android vuelve a la lista, no cierra la app.
   *
   * Sin este manejador, Android aplica su comportamiento por defecto —cerrar la
   * actividad— y como esta app tiene una sola, eso es salir. José lo reportó el
   * 27/08/2026 estando en el chat con Wilson.
   *
   * Devolver `true` significa «ya me encargué»; `false` deja pasar a Android.
   */
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (decidirAtras({ pantalla: 'chat' }) === 'ir-a-lista') {
        onBack();
        return true;
      }
      return false;
    });
    return () => suscripcion.remove();
  }, [onBack]);
  const [mediaError, setMediaError] = useState('');
  /** El resultado de descargar/compartir, que se pinta DENTRO del visor. */
  const [avisoVisor, setAvisoVisor] = useState('');

  /**
   * La foto que se esta subiendo, para pintarla YA en el chat.
   *
   * Vive en memoria y no en la cola persistida: un `file://` deja de valer
   * cuando el sistema limpia su cache, asi que una foto pendiente guardada en
   * disco reaparecia como una burbuja rota al reabrir la app.
   */
  const [subiendo, setSubiendo] = useState<{
    clientKey: string;
    uri: string;
    mime: string;
    nombre: string;
  } | null>(null);
  /** La foto abierta a pantalla completa, o `null`. */
  /** El `seq` de la foto abierta a pantalla completa, o `null`. */
  const [viendoSeq, setViendoSeq] = useState<number | null>(null);
  /** El mensaje seleccionado con pulsación larga, o `null`. */
  const [elegido, setElegido] = useState<number | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);
  /**
   * Lo que se cambió en el detalle, para pintarlo YA en esta cabecera.
   *
   * Los props vienen de la lista, que es una foto del momento en que se abrió
   * el chat: sin esto, cambiar el nombre del grupo lo mostraba nuevo adentro
   * del detalle y viejo al cerrarlo, que se lee como que no se guardó.
   */
  const [infoPropia, setInfoPropia] = useState<{ name?: string; avatarUrl?: string }>({});

  const voz = useGrabadorDeVoz();

  /**
   * Terminar la grabación y mandarla.
   *
   * Pasa por el MISMO `upload` que una foto: la nota de voz es media como
   * cualquier otra, y duplicar el camino sería duplicar la cola, el progreso y
   * el manejo de errores.
   */
  const mandarVoz = async (cancelar = false) => {
    const nota = await voz.terminar({ cancelar });
    if (!nota) return;
    await upload({
      uri: nota.uri,
      fileName: `nota-de-voz.m4a`,
      mimeType: nota.mime,
      sizeBytes: nota.bytes,
    });
  };

  const nombreVisible = infoPropia.name ?? chatName;
  const fotoVisible = infoPropia.avatarUrl ?? chatAvatarUrl;

  /**
   * Las fotos del chat, en el formato que consume el visor.
   *
   * Se arman ACÁ y no en el visor: el nombre del autor sale de la agenda del
   * teléfono y la hora de un formateador nuestro. Un visor que resolviera eso
   * solo tendría que conocer la agenda, la sesión y el formato de fechas — tres
   * cosas que no son suyas.
   */
  const fotos = messages
    .filter((m) => m.media?.thumbUrl && !m.deletedAt)
    .map((m) => ({
      // El archivo COMPLETO, no la miniatura. Con `thumbUrl` el visor mostraba
      // una foto borrosa a pantalla completa —y un video no se reproducía nunca,
      // porque lo que le llegaba era su cuadro de portada en JPG—. La miniatura
      // sigue siendo la de la burbuja.
      url: m.media!.url ?? m.media!.thumbUrl!,
      mime: m.media!.mime,
      nombre: m.media!.fileName,
      cuandoReal: new Date(m.at),
      seq: m.seq,
      mia: m.senderId === credential.userId,
      autor: m.senderId === credential.userId ? 'Vos' : chatName,
      cuando: formatClock(new Date(m.at)),
    }));
  const fotoAbierta = fotos.find((f) => f.seq === viendoSeq) ?? null;

  const upload = async (file: {
    uri: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }) => {
    setUploading(true);
    setProgress(0);
    setMediaError('');
    // La burbuja aparece ANTES de subir nada: es lo que hace WhatsApp y lo que
    // Jose pidio el 27/08/2026. El check llega despues, cuando el server
    // confirma.
    setSubiendo({
      clientKey: `local-${file.uri}`,
      uri: file.uri,
      mime: file.mimeType,
      nombre: file.fileName,
    });
    const result = await sendMedia({ ...file, onProgress: setProgress });
    setUploading(false);
    setSubiendo(null);
    // El fallo se DICE: una foto que desaparece sin explicación es lo que hace
    // que la gente deje de mandar fotos por la app.
    if (!result.ok) setMediaError(result.reason);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMediaError('Permite la cámara para poder tomar fotos.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 1 });
    const asset = shot.assets?.[0];
    if (shot.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.fileName ?? 'foto.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    });
  };

  const pickFromGallery = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      // `quality: 1` y sin edición: la foto se manda como está. Recomprimir es
      // justo la queja que esta app viene a no repetir.
      quality: 1,
      mediaTypes: ['images', 'videos'],
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.fileName ?? 'archivo',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    });
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      sizeBytes: asset.size ?? 0,
    });
  };

  /**
   * La foto en vuelo se suma como una fila pendiente mas. Va al FINAL: es lo
   * ultimo que mando la persona y tiene que verse abajo de todo, no intercalada.
   */
  /**
   * La lista, para poder mandarla al final.
   *
   * Hace falta porque con MENOS contenido que pantalla el ancla al fondo deja
   * la última fila debajo de la barra de escribir: se veía cortada hasta que la
   * persona scrolleaba. Con la conversación llena no pasa, así que el defecto
   * solo aparecía en chats nuevos — que ahora, con los avisos del grupo, es
   * todo grupo recién creado.
   */
  const listaRef = useRef<FlashListRef<Row> | null>(null);

  const rows: Row[] = [
    ...messages,
    ...pending,
    ...(subiendo
      ? [
          {
            clientKey: subiendo.clientKey,
            queuedAt: new Date().toISOString(),
            pending: true as const,
            mediaUri: subiendo.uri,
            mediaMime: subiendo.mime,
            mediaNombre: subiendo.nombre,
            progreso: progress,
          },
        ]
      : []),
  ]

  const hayContenido = rows.length > 0;
  useEffect(() => {
    if (!hayContenido) return;
    // Un tick después del primer pintado: antes de eso la lista todavía no
    // midió y el scroll no llega a ningún lado.
    // 150 ms y no 0: con 0 la lista todavía no midió y el scroll no llega a
    // ningún lado — probado en el emulador.
    const t = setTimeout(() => listaRef.current?.scrollToEnd({ animated: false }), 150);
    return () => clearTimeout(t);
    // Solo al pasar de vacío a con contenido: reaccionar a cada mensaje pelearía
    // con quien está leyendo mensajes viejos más arriba.
  }, [hayContenido]);
;

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) markRead(last.seq);
  }, [messages, markRead]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      /**
       * `padding` TAMBIEN en Android, y no es un descuido.
       *
       * Android trae `adjustResize` en el manifiesto, que historicamente
       * alcanzaba: el sistema encogia la ventana y el compositor subia solo. Pero
       * este proyecto tiene `edgeToEdgeEnabled=true` (Expo SDK 57), y con
       * edge-to-edge la ventana YA NO se encoge — la app dibuja por debajo del
       * teclado. Resultado: el campo de escribir desaparecia y quedaba una
       * pantalla vacia con el teclado encima (visto por Jose el 27/08/2026,
       * chateando con Wilson).
       */
      behavior="padding"
      testID="pantalla-chat"
    >
      {/**
       * Con un mensaje seleccionado, la cabecera se REEMPLAZA por la barra de
       * acciones — no se apila encima. Es lo que hace WhatsApp: mientras estás
       * eligiendo qué borrar, el nombre y las llamadas no sirven de nada, y dos
       * barras a la vez empujan la conversación fuera de la pantalla.
       */}
      {elegido !== null ? (
        <View
          testID="barra-seleccion"
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cancelar-seleccion"
            accessibilityLabel="Cancelar la selección"
            onPress={() => setElegido(null)}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={22} color={colores['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-base font-semibold text-on-surface">1 seleccionado</Text>
          <Pressable
            testID="btn-eliminar-mensaje"
            accessibilityLabel="Eliminar el mensaje"
            onPress={async () => {
              const seq = elegido;
              setElegido(null);
              const r = await eliminar(seq);
              // El motivo del server se DICE: un «no» mudo se lee como que la
              // app se colgó. El caso típico es intentar borrar lo de otro.
              if (!r.ok) setMediaError(r.motivo ?? 'No se pudo eliminar.');
            }}
            className="h-11 w-11 items-center justify-center"
          >
            <Trash2 size={20} color={colores.error} />
          </Pressable>
        </View>
      ) : (
      <>
      {/* Header como el diseño: FLECHA (no la palabra «Atrás»), avatar del chat
          junto al nombre, y el menú al final. Video y llamada llegan con F10. */}
      <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3" style={{ paddingTop: margenes.cabecera }}>
        <Pressable onPress={onBack} testID="btn-volver" className="h-11 w-9 items-center justify-center">
          <ArrowLeft size={22} color={colores["on-surface"]} />
        </Pressable>
        {/* Tocar el avatar Y el nombre abre el detalle, como en WhatsApp: es
            donde la gente lo busca, mucho antes que en el menú de tres puntos.
            Los dos van dentro del MISMO Pressable — que solo responda el avatar
            deja un área táctil chiquita al lado de un nombre que parece tocable. */}
        <Pressable
          testID="btn-abrir-detalle"
          accessibilityLabel="Ver el detalle del chat"
          onPress={() => setVerDetalle(true)}
          className="min-w-0 flex-1 flex-row items-center gap-2"
        >
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {fotoVisible ? (
            <Image source={{ uri: fotoVisible }} style={{ width: 36, height: 36 }} contentFit="cover" />
          ) : (
            <Text className="text-sm font-bold text-primary">
              {nombreVisible.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {/* El candado va PEGADO al nombre y no en una banda aparte: es una
                propiedad de con quién se está hablando, y tiene que verse en la
                misma mirada que el nombre. */}
            {encrypted ? <Lock size={13} color={colores.primary} /> : null}
            <Text className="min-w-0 flex-1 text-base font-bold text-on-surface" numberOfLines={1}>
              {nombreVisible}
            </Text>
          </View>
          {/* El estado de conexión se DICE: un mensaje que no sale sin
              explicación es lo que hace desconfiar de una app de mensajería. */}
          {!connected ? (
            <Text className="text-xs text-on-surface-variant" testID="estado-conexion">
              Sin conexión · se enviará cuando vuelva
            </Text>
          ) : null}
        </View>
        </Pressable>
        {/* Llamadas: dejan de ser inertes (F10). Solo en 1:1 — una llamada
            grupal es otra cosa (varias conexiones a la vez) y prometerla con el
            mismo botón sería mentir. */}
        {otherUserId ? (
          <>
            <Pressable
              testID="btn-videollamada"
              onPress={() => llamada.llamar(true)}
              className="h-11 w-9 items-center justify-center"
            >
              <Video size={20} color={colores["on-surface-variant"]} />
            </Pressable>
            <Pressable
              testID="btn-llamada"
              onPress={() => llamada.llamar(false)}
              className="h-11 w-9 items-center justify-center"
            >
              <Phone size={20} color={colores["on-surface-variant"]} />
            </Pressable>
          </>
        ) : null}
        <Pressable testID="btn-menu-chat" className="h-11 w-9 items-center justify-center">
          <MoreVertical size={20} color={colores["on-surface-variant"]} />
        </Pressable>
      </View>
      </>
      )}

      {creando === 'event' ? (
        <CreateEventScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : creando === 'poll' ? (
        <CreatePollScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : null}

      {/* En un chat cifrado NO se ofrece «ponme al día»: Lila no puede leerlo,
          y un botón que siempre falla es peor que no tenerlo. */}
      {/* La pantalla de llamada se monta SOBRE el chat: al colgar se vuelve a
          la conversación, que es donde uno estaba. */}
      {llamada.state ? (
        <CallScreen
          visible
          state={llamada.state}
          peerName={chatName}
          video={llamada.video}
          muted={llamada.muted}
          speaker={llamada.speaker}
          onToggleMute={llamada.alternarMute}
          onToggleSpeaker={llamada.alternarAltavoz}
          onToggleVideo={llamada.alternarVideo}
          onAccept={llamada.contestar}
          onHangUp={() => {
            llamada.colgar();
            // Se cierra un instante después para que se vea «terminada» en vez
            // de desaparecer de golpe, que se siente como que se cortó sola.
            setTimeout(llamada.cerrar, 900);
          }}
        />
      ) : null}

      {falloCifrado ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-cifrado">
          No se pudo cifrar el mensaje. No se envió.
        </Text>
      ) : null}

      {encrypted ? (
        <SecretChatBanner session={secreto} />
      ) : (
        <CatchUpBanner chatId={chatId} credential={credential} unread={unread} />
      )}

      <FlashList
        ref={listaRef}
        data={rows}
        // Cuando la lista terminó de montar, al final. Es el momento exacto en
        // que ya midió, sin adivinar con un temporizador.
        onLoad={() => listaRef.current?.scrollToEnd({ animated: false })}
        testID="lista-mensajes"
        /**
         * `flex-1` NO es cosmético: sin él la lista no está acotada por la
         * columna y su borde inferior queda DEBAJO de la barra de escribir. Con
         * la conversación llena no se nota —lo que sobra queda fuera de la
         * pantalla y el último mensaje cae justo arriba de la barra— pero con
         * pocos mensajes el contenido se ancla al fondo de la lista, o sea
         * tapado. Se vio con un grupo cuyo único contenido era un aviso: la
         * línea aparecía cortada a la mitad detrás del campo de texto.
         */
        className="flex-1"
        // El scroll hacia arriba trae los mensajes viejos, como WhatsApp. El
        // umbral es 0.5 pantallas: pedirlos recién al tocar el borde deja un
        // hueco visible mientras viajan.
        onStartReached={() => void cargarAnteriores()}
        onStartReachedThreshold={0.5}
        maintainVisibleContentPosition={{ startRenderingFromBottom: true }}
        ListHeaderComponent={
          cargandoAnteriores ? (
            <View className="items-center py-3" testID="cargando-anteriores">
              <ActivityIndicator color={colores.primary} />
            </View>
          ) : !hayAnteriores && rows.length > 0 ? (
            // El final de la conversación se DICE: sin esto, quien scrollea
            // hasta arriba no sabe si ya vio todo o si falta cargar.
            <Text className="py-3 text-center text-[11px] text-on-surface-variant">
              Este es el principio de la conversación
            </Text>
          ) : null
        }
        keyExtractor={(row) => (isPending(row) ? `p-${row.clientKey}` : `m-${row.seq}`)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        renderItem={({ item, index }) => {
          const previous = rows[index - 1];
          const next = rows[index + 1];
          const at = isPending(item) ? item.queuedAt : item.at;
          const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
          return (
            <>
              {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
              <MessageRow
                item={item}
                previous={previous}
                next={next}
                myUserId={credential.userId}
                othersReadSeq={Math.max(othersReadSeq, othersRead)}
                othersDeliveredSeq={othersDeliveredSeq}
                senderInitial={nombreVisible.slice(0, 1).toUpperCase()}
                onVerImagen={(_url) => setViendoSeq(!isPending(item) ? item.seq : null)}
                onSeleccionar={setElegido}
                seleccionado={!isPending(item) && item.seq === elegido}
              />
            </>
          );
        }}
      />

      {uploading ? (
        <Text className="px-4 pb-1 text-sm text-on-surface-variant" testID="subida-progreso">
          {textoDeSubida(progress)}
        </Text>
      ) : null}

      {mediaError ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-media">
          {mediaError}
        </Text>
      ) : null}

      {/* La barra, tal como está COMPUESTA en el diseño — y no era «los mismos
          iconos en una fila»:
            · el «+» va PLANO, sin círculo de fondo;
            · hay UNA píldora larga y el emoji vive DENTRO, contra su borde;
            · a la derecha hay UN SOLO botón circular, y es excluyente:
              micrófono con el campo vacío, enviar apenas se escribe algo.
          La primera versión puso los cinco controles como hermanos: entraban
          todos, pero el campo quedaba tan angosto que el placeholder se partía
          en dos líneas. */}
      <View className="flex-row items-end gap-1.5 border-t border-outline/10 bg-surface px-3 pt-3" style={{ paddingBottom: margenes.pie }}>
        {voz.estado.fase === 'grabando' ? (
          /**
           * Mientras se graba, la barra ES la grabación: cancelar, el tiempo
           * corriendo y mandar. Dejar el campo de texto al lado invita a
           * escribir mientras se habla, que no es una cosa que se pueda hacer.
           */
          <>
            <Pressable
              testID="btn-cancelar-voz"
              accessibilityLabel="Cancelar la nota de voz"
              onPress={() => void mandarVoz(true)}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={22} color={colores.error} />
            </Pressable>
            <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-background px-4 py-2.5">
              <View className="h-2.5 w-2.5 rounded-full bg-error" />
              <Text testID="tiempo-voz" className="text-base font-semibold text-on-surface">
                {duracionDeVoz(voz.estado.ms)}
              </Text>
              <Text className="text-[12px] text-on-surface-variant">Grabando…</Text>
            </View>
            <Pressable
              testID="btn-enviar-voz"
              accessibilityLabel="Enviar la nota de voz"
              onPress={() => void mandarVoz()}
              className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            >
              <Send size={18} color={colores['on-primary']} />
            </Pressable>
          </>
        ) : (
        <>
        {/* El «+» SIGUE SIENDO un «+» mientras sube.
            Antes se convertía en un spinner, y eso es contar la misma cosa dos
            veces y en el lugar equivocado: el progreso ya se ve en la burbuja
            que se está subiendo, que es donde uno mira. Un botón que cambia de
            forma además hace perder el punto donde estaba el dedo. Queda
            atenuado y sin responder —no se puede subir dos cosas a la vez—,
            pero se sigue viendo lo que es. */}
        <Pressable
          testID="btn-adjuntar"
          onPress={() => setAttachOpen(true)}
          disabled={uploading}
          className={`h-11 w-11 items-center justify-center ${uploading ? 'opacity-40' : ''}`}
        >
          <Plus size={24} color={colores["on-surface-variant"]} />
        </Pressable>

        <View className="min-w-0 flex-1 flex-row items-end rounded-xl border border-outline/15 bg-background pr-1">
          <TextInput
            testID="input-mensaje"
            className="max-h-28 min-h-[44px] min-w-0 flex-1 px-4 py-2.5 text-base text-on-surface"
            placeholder="Escribe un mensaje"
            placeholderTextColor={colores.outline}
            multiline
            value={draft}
            onChangeText={setDraft}
          />
          <Pressable testID="btn-emoji" className="h-11 w-9 items-center justify-center">
            <Smile size={20} color={colores.outline} />
          </Pressable>
        </View>

        {draft.trim() ? (
          <Pressable
            testID="btn-enviar"
            onPress={() => {
              const text = draft;
              setDraft('');
              void (async () => {
                const resultado = await send(text);
                // Si NO se pudo cifrar, el mensaje no salió y hay que decirlo:
                // en un chat con candado, un envío que falla en silencio deja a
                // la persona creyendo que el otro lo recibió.
                if (!resultado?.ok) {
                  setDraft(text);
                  setFalloCifrado(true);
                }
              })();
            }}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
          >
            <Send size={18} color={colores["on-primary"]} />
          </Pressable>
        ) : (
          <Pressable
            testID="btn-voz"
            accessibilityLabel="Grabar una nota de voz"
            disabled={uploading}
            onPress={() => void voz.empezar()}
            className={`h-11 w-11 items-center justify-center rounded-full bg-primary ${uploading ? 'opacity-40' : ''}`}
          >
            <Mic size={18} color={colores["on-primary"]} />
          </Pressable>
        )}
        </>
        )}
      </View>

      {voz.estado.fase === 'sin-permiso' || voz.estado.fase === 'error' ? (
        <Pressable onPress={voz.limpiarAviso} className="px-4 pb-2">
          <Text testID="aviso-voz" className="text-sm text-error">
            {voz.estado.fase === 'sin-permiso'
              ? 'Permití el micrófono para mandar notas de voz.'
              : voz.estado.motivo}
          </Text>
        </Pressable>
      ) : null}

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickCamera={() => void pickFromCamera()}
        onPickGallery={() => void pickFromGallery()}
        onCreateEvent={() => setCreando('event')}
        onCreatePoll={() => setCreando('poll')}
        onPickFile={() => void pickFile()}
      />
      <VisorDeImagen
        foto={fotoAbierta}
        otras={fotos}
        onCerrar={() => setViendoSeq(null)}
        onCambiar={(otra) => setViendoSeq(otra.seq)}
        aviso={avisoVisor}
        onDescargar={async (f) => {
          // El resultado se DICE en los dos sentidos, y DENTRO del visor: una
          // descarga que no avisa nada deja sin saber si hay que reintentar.
          setAvisoVisor('Guardando…');
          const r = await guardarEnGaleria({ url: f.url, cuando: f.cuandoReal, mime: f.mime, seq: f.seq });
          setAvisoVisor(r.ok ? 'Guardada en tu galería' : r.motivo);
          setTimeout(() => setAvisoVisor(''), 3000);
        }}
        onCompartir={async (f) => {
          const r = await compartirFoto({ url: f.url, cuando: f.cuandoReal, mime: f.mime, seq: f.seq });
          if (!r.ok) {
            setAvisoVisor(r.motivo);
            setTimeout(() => setAvisoVisor(''), 3000);
          }
        }}
        onEliminar={async (f) => {
          setViendoSeq(null);
          const r = await eliminar(f.seq);
          if (!r.ok) setMediaError(r.motivo ?? 'No se pudo eliminar.');
        }}
        onAbrirArchivo={async (f) => {
          setAvisoVisor('Abriendo…');
          const r = await abrirConOtraApp({
            url: f.url,
            cuando: f.cuandoReal,
            mime: f.mime,
            seq: f.seq,
          });
          setAvisoVisor(r.ok ? '' : r.motivo);
          if (!r.ok) setTimeout(() => setAvisoVisor(''), 4000);
        }}
      />

      <ChatDetailScreen
        visible={verDetalle}
        chatId={chatId}
        chatName={nombreVisible}
        credential={credential}
        mensajes={messages}
        onInfoCambiada={(info) => setInfoPropia((antes) => ({ ...antes, ...info }))}
        onCerrar={() => setVerDetalle(false)}
        onSalio={() => {
          setVerDetalle(false);
          // Y afuera del chat: ya no es suyo.
          onBack();
        }}
        onLlamar={otherUserId ? (video) => llamada.llamar(video) : undefined}
        onVerImagen={(url) => {
          setVerDetalle(false);
          setViendoSeq(fotos.find((f) => f.url === url)?.seq ?? null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
