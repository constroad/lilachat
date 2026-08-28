import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { formatDayLabel, startsNewDay } from '@lilachat/shared';
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

  /**
   * La foto que se esta subiendo, para pintarla YA en el chat.
   *
   * Vive en memoria y no en la cola persistida: un `file://` deja de valer
   * cuando el sistema limpia su cache, asi que una foto pendiente guardada en
   * disco reaparecia como una burbuja rota al reabrir la app.
   */
  const [subiendo, setSubiendo] = useState<{ clientKey: string; uri: string } | null>(null);
  /** La foto abierta a pantalla completa, o `null`. */
  /** El `seq` de la foto abierta a pantalla completa, o `null`. */
  const [viendoSeq, setViendoSeq] = useState<number | null>(null);
  /** El mensaje seleccionado con pulsación larga, o `null`. */
  const [elegido, setElegido] = useState<number | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);

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
      url: m.media!.thumbUrl!,
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
    setSubiendo({ clientKey: `local-${file.uri}`, uri: file.uri });
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
            progreso: progress,
          },
        ]
      : []),
  ];

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
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-sm font-bold text-primary">
            {chatName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {/* El candado va PEGADO al nombre y no en una banda aparte: es una
                propiedad de con quién se está hablando, y tiene que verse en la
                misma mirada que el nombre. */}
            {encrypted ? <Lock size={13} color={colores.primary} /> : null}
            <Text className="min-w-0 flex-1 text-base font-bold text-on-surface" numberOfLines={1}>
              {chatName}
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
        data={rows}
        testID="lista-mensajes"
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
                senderInitial={chatName.slice(0, 1).toUpperCase()}
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
        <Pressable
          testID="btn-adjuntar"
          onPress={() => setAttachOpen(true)}
          disabled={uploading}
          className="h-11 w-11 items-center justify-center"
        >
          {uploading ? <ActivityIndicator color={colores.primary} /> : <Plus size={24} color={colores["on-surface-variant"]} />}
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
          // Inerte hasta que existan las notas de voz, pero ocupa su lugar: si
          // apareciera recién con la función, la barra cambiaría de forma.
          <View testID="btn-voz" className="h-11 w-11 items-center justify-center rounded-full bg-primary/30">
            <Mic size={18} color={colores["on-primary"]} />
          </View>
        )}
      </View>

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
        onEliminar={async (f) => {
          setViendoSeq(null);
          const r = await eliminar(f.seq);
          if (!r.ok) setMediaError(r.motivo ?? 'No se pudo eliminar.');
        }}
      />

      <ChatDetailScreen
        visible={verDetalle}
        chatId={chatId}
        chatName={chatName}
        credential={credential}
        mensajes={messages}
        onCerrar={() => setVerDetalle(false)}
        onLlamar={otherUserId ? (video) => llamada.llamar(video) : undefined}
        onVerImagen={(url) => {
          setVerDetalle(false);
          setViendoSeq(fotos.find((f) => f.url === url)?.seq ?? null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
