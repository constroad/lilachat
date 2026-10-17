import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from 'react-native';
import { ProgramarMensajeModal } from './ProgramarMensajeModal';
import { programarMensaje } from '../api/client';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { terminarCronometro } from '../diagnostico/diagnostico';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  ChevronDown,
  Lock,
  MoreVertical,
  Phone,
  Video,
  Trash2,
  X,
} from 'lucide-react-native';
import { formatDayLabel, startsNewDay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { AttachSheet } from './AttachSheet';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CatchUpBanner } from './CatchUpBanner';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { DaySeparator, MessageRow, isPending, type Row } from './MessageRow';
import { formatClock } from '@lilachat/shared';
import { abrirConOtraApp, compartirFoto, guardarEnGaleria } from './guardarYCompartir';
import type { NotaGrabada } from './useGrabadorDeVoz';
import { Composer, type ComposerHandle } from './Composer';
import { previewDeMensaje } from './MessageRow';
import { VisorDeImagen } from './VisorDeImagen';
import { ChatDetailScreen } from './ChatDetailScreen';
import { useChat } from './useChat';
import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { descartarMensaje, reintentarMensaje } from './outboxStore';
import { descartarArchivo, encolarArchivo, reintentarArchivo } from './colaDeArchivos';
import { useArchivosDelChat } from './useArchivosDelChat';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { decidirAtras } from '../ui/botonAtras';
import { textoDeSubida } from './progresoDeSubida';
import { reportarError } from '../ui/reportarError';
import { citadosPorSeq, tipoDeFila } from './filasDelChat';
import { useNombresDelGrupo } from './useNombresDelGrupo';
import { subtituloDelChat } from './cabeceraDelChat';
import { FondoDelChat } from './FondoDelChat';
import { useFinalDeLaConversacion } from './useFinalDeLaConversacion';

/**
 * La conversación (diseño Stitch «Chat de Grupo»). Burbuja propia a la derecha
 * en acento; la ajena a la izquierda en superficie — y la esquina-cola de 4px
 * apunta al emisor, que es el token `rounded-tail` de Vivid Pulse.
 */
/** El pie del composer con el teclado abierto (dp). */
const MARGEN_CON_TECLADO = 8;

export function ChatScreen({
  chatId,
  chatName,
  chatAvatarUrl,
  credential,
  othersReadSeq,
  acuseDe,
  othersDeliveredSeq,
  unread,
  lastSeqInicial,
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
  /** Quiénes cuentan para el check azul (FL8): en un grupo, todos menos yo y Lila. */
  acuseDe?: readonly string[];
  othersDeliveredSeq: number;
  /** Cuántos sin leer traía la lista: decide si la banda de Lila aparece. */
  unread: number;
  /**
   * El `lastSeq` que el server reportó al abrir. Se marca leído HASTA acá, no
   * solo hasta el último mensaje cargado: si un mensaje del final se borró en
   * duro, `lastSeq` queda por delante y el cliente nunca llegaria a marcarlo
   * —dejando un «sin leer» fantasma que no baja (José, 31/08/2026)—. Abrir el
   * chat es haberlo visto todo lo que el server dice que hay.
   */
  lastSeqInicial?: number;
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
    othersDelivered,
    enLinea,
    escribiendo,
    avisarEscribiendo,
    send,
    markRead,
    cargandoAnteriores,
    hayAnteriores,
    cargarAnteriores,
  } = useChat({
    chatId,
    token: credential.jwt,
    miUserId: credential.userId,
    seal: sesionLista?.seal,
    open: sesionLista?.open,
    acuseDe,
    baseLeido: othersReadSeq,
    baseEntregado: othersDeliveredSeq,
  });
  // El borrador vive en el Composer (FL2): una tecla ya no re-renderiza esto.
  const composerRef = useRef<ComposerHandle>(null);
  const [textoAProgramar, setTextoAProgramar] = useState('');
  /** El mensaje al que se está respondiendo (deslizando sobre él), o null. */
  const [respondiendoA, setRespondiendoA] = useState<{ seq: number; texto: string; mio: boolean } | null>(null);

  // Mensajes programados (F11): long-press en enviar abre el modal.
  const [programarVisible, setProgramarVisible] = useState(false);
  const [avisoProgramado, setAvisoProgramado] = useState<string | null>(null);

  const alProgramar = async (cuando: Date) => {
    const texto = textoAProgramar.trim();
    if (!texto) {
      setProgramarVisible(false);
      return;
    }
    // La clave hace idempotente el envío si el tick del server reintenta.
    const clientKey = `prog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resultado = await programarMensaje(
      credential.jwt,
      chatId,
      texto,
      cuando.toISOString(),
      clientKey
    );
    setProgramarVisible(false);
    if (resultado.ok) {
      composerRef.current?.limpiar();
      setAvisoProgramado(
        `Se enviará ${cuando.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`
      );
      setTimeout(() => setAvisoProgramado(null), 4000);
    } else {
      Alert.alert('No se pudo programar', resultado.message ?? 'Probá de nuevo.');
    }
  };
  const [attachOpen, setAttachOpen] = useState(false);
  // Crear desde la conversación: el chat YA está elegido, así que las pantallas
  // de crear no vuelven a preguntar dónde.
  const [creando, setCreando] = useState<'event' | 'poll' | null>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  // Las llamadas son de la sesión (FL8): suenan en cualquier pantalla.
  const { llamar } = useLlamadas();

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

  const archivosEnCola = useArchivosDelChat(chatId);
  const subidaEnCurso = archivosEnCola.find((uno) => uno.progreso !== undefined)?.progreso;
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


  /**
   * Terminar la grabación y mandarla.
   *
   * Pasa por el MISMO `upload` que una foto: la nota de voz es media como
   * cualquier otra, y duplicar el camino sería duplicar la cola, el progreso y
   * el manejo de errores.
   */
  const alEnviar = useCallback(
    async (texto: string, respondeA?: number) => {
      setRespondiendoA(null);
      // Lo que mando yo SIEMPRE se ve: aunque estuviera leyendo arriba.
      requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: true }));
      const resultado = await send(texto, respondeA);
      // Si NO se pudo cifrar, el mensaje no salió y hay que decirlo: en un chat
      // con candado, un envío que falla en silencio engaña.
      if (resultado?.ok) return true;
      setFalloCifrado(true);
      return false;
    },
    [send]
  );
  const alProgramarDesdeComposer = useCallback((texto: string) => {
    setTextoAProgramar(texto);
    setProgramarVisible(true);
  }, []);
  const alAdjuntar = useCallback(() => setAttachOpen(true), []);
  // Por un ref: `pickFromCamera` se rearma en cada render y el Composer es memo.
  const camaraRef = useRef<() => Promise<void>>(async () => undefined);
  const alCamara = useCallback(() => void camaraRef.current(), []);
  const alCancelarRespuesta = useCallback(() => setRespondiendoA(null), []);

  const nombreVisible = infoPropia.name ?? chatName;

  /**
   * El subtítulo del header: «escribiendo…» / «en línea» como WhatsApp.
   *
   * En un 1:1 se sabe quién es el otro (`otherUserId`). En un grupo puede
   * escribir cualquiera y acá no está la lista de miembros con sus nombres, así
   * que se dice que ALGUIEN escribe —nombrarlo pediría un fetch de miembros que
   * no vale la pena para un cartel—. «En línea» no se muestra en grupo: con
   * varios conectados sería ruido permanente.
   */
  const esGrupoChat = otherUserId === null || otherUserId === undefined;
  const otroEscribe = otherUserId ? escribiendo.has(otherUserId) : escribiendo.size > 0;
  const otroEnLinea = otherUserId ? enLinea.has(otherUserId) : false;
  const nombresDelGrupo = useNombresDelGrupo(chatId, credential.jwt, esGrupoChat);
  const subtitulo = subtituloDelChat({
    esGrupo: esGrupoChat,
    escriben: [...escribiendo],
    otroEnLinea,
    nombres: nombresDelGrupo,
    yo: credential.userId,
  });
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
      // En un grupo, quién la mandó; antes decía el nombre del GRUPO.
      autor:
        m.senderId === credential.userId
          ? 'Tú'
          : esGrupoChat
            ? (nombresDelGrupo.get(String(m.senderId)) ?? chatName)
            : chatName,
      cuando: formatClock(new Date(m.at)),
      miniatura: m.media!.thumbUrl,
    }));
  const fotoAbierta = fotos.find((f) => f.seq === viendoSeq) ?? null;

  /**
   * Foto, archivo o nota de voz: a la cola PERSISTIDA (FL8). La burbuja aparece
   * al instante —como WhatsApp— y sube cuando hay red, aunque se salga del chat
   * o se cierre la app; si el server la rechaza queda «No se envió» a la vista.
   */
  const upload = async (file: { uri: string; fileName: string; mimeType: string; sizeBytes: number; durationMs?: number }) => {
    setMediaError('');
    try {
      await encolarArchivo({ chatId, ...file });
    } catch (error) {
      reportarError('encolarArchivo', error);
      setMediaError('No se pudo preparar el archivo para enviarlo.');
    }
  };

  /**
   * La nota de voz pasa por el MISMO `upload` que una foto. Por un ref: el
   * callback queda estable y el Composer memoizado no se vuelve a dibujar.
   */
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const alNotaDeVoz = useCallback(
    (nota: NotaGrabada) =>
      uploadRef.current({
        uri: nota.uri,
        fileName: 'nota-de-voz.m4a',
        mimeType: nota.mime,
        sizeBytes: nota.bytes,
        durationMs: nota.ms,
      }),
    []
  );
  camaraRef.current = () => pickFromCamera();
  async function pickFromCamera() {
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
  }

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

  // Memoizadas: sin esto cada render (una tecla, un «escribiendo») rearmaba
  // las filas y la lista volvía a dibujar todas las burbujas (FL2).
  const rows: Row[] = useMemo(
    () => [
      ...messages,
      ...pending,
      ...archivosEnCola.map(({ archivo, progreso }) => ({
        clientKey: archivo.clientKey,
        queuedAt: archivo.queuedAt,
        pending: true as const,
        mediaUri: archivo.uri,
        mediaMime: archivo.mimeType,
        mediaNombre: archivo.fileName,
        progreso,
        fallo: archivo.fallo,
      })),
    ],
    [messages, pending, archivosEnCola]
  );

  /** Las citas, una vez por cambio de mensajes (antes un `find` por fila y por render). */
  const citados = useMemo(
    () =>
      citadosPorSeq(
        messages,
        { yo: credential.userId, esGrupo: esGrupoChat, nombreDelOtro: nombreVisible },
        previewDeMensaje
      ),
    [messages, credential.userId, esGrupoChat, nombreVisible]
  );
  const leidoHasta = Math.max(othersReadSeq, othersRead);
  const entregadoHasta = Math.max(othersDeliveredSeq, othersDelivered);
  // En refs: `alVerImagen` tiene que ser estable (las burbujas son `memo`).
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const mensajesRef = useRef(messages);
  mensajesRef.current = messages;
  /**
   * Tocar una foto, un video o un archivo. Lo que tiene miniatura va al visor;
   * un documento SIN miniatura (Word, Excel, zip, mp3: lila solo la genera
   * para PDF) no estaba en el visor y el toque no hacía nada (FL8). Ahora se
   * abre directo con la app del teléfono que sepa hacerlo.
   */
  const alVerImagen = useCallback((seq: number) => {
    if (fotosRef.current.some((foto) => foto.seq === seq)) return setViendoSeq(seq);
    const mensaje = mensajesRef.current.find((m) => m.seq === seq);
    if (!mensaje?.media?.url) return;
    void abrirConOtraApp({
      url: mensaje.media.url,
      cuando: new Date(mensaje.at),
      mime: mensaje.media.mime,
      seq,
      nombre: mensaje.media.fileName,
    }).then((r) => {
      if (!r.ok) setMediaError(r.motivo);
    });
  }, []);
  const alResponder = useCallback(
    (seq: number, texto: string, mio: boolean) => setRespondiendoA({ seq, texto, mio }),
    []
  );

  /**
   * Una fila. Estable mientras no cambien los mensajes ni los acuses: con
   * `MessageRow` memoizado, un mensaje nuevo dibuja SU burbuja y la de al lado
   * (por el agrupado), no la pantalla entera (FL2).
   */
  /**
   * Un mensaje que el server rechazó para siempre (FL8). Antes desaparecía sin
   * aviso; ahora se ve «No se envió» y se decide acá.
   */
  const archivosRef = useRef(archivosEnCola);
  archivosRef.current = archivosEnCola;
  const alFallido = useCallback((clientKey: string, motivo: string) => {
    // Texto y archivos viven en colas distintas: cada uno se reintenta en la suya.
    const esArchivo = archivosRef.current.some(({ archivo }) => archivo.clientKey === clientKey);
    Alert.alert('No se envió', motivo, [
      { text: 'Borrar', style: 'destructive', onPress: () => void (esArchivo ? descartarArchivo : descartarMensaje)(clientKey) },
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reintentar', onPress: () => void (esArchivo ? reintentarArchivo : reintentarMensaje)(clientKey) },
    ]);
  }, []);

  const dibujarFila = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
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
            othersReadSeq={leidoHasta}
            othersDeliveredSeq={entregadoHasta}
            esGrupo={esGrupoChat}
            nombreAutor={isPending(item) ? undefined : nombresDelGrupo.get(String(item.senderId))}
            onVerImagen={alVerImagen}
            onSeleccionar={setElegido}
            onResponder={alResponder}
            citado={isPending(item) ? null : (citados.get(item.seq) ?? null)}
            seleccionado={!isPending(item) && item.seq === elegido}
            onFallido={alFallido}
          />
        </>
      );
    },
    [rows, credential.userId, leidoHasta, entregadoHasta, esGrupoChat, nombresDelGrupo, alVerImagen, alResponder, citados, elegido]
  );

  const { alScrollear, abajoLejos, nuevosAbajo } = useFinalDeLaConversacion(listaRef, messages, credential.userId);

  // Con el teclado abierto no hay barra de navegación debajo: el margen del pie
  // dejaba un hueco entre el campo y el teclado (auditoría del 16/10).
  const tecladoAbierto = useKeyboardState((estado) => estado.isVisible);

  const hayContenido = rows.length > 0;
  useEffect(() => {
    if (!hayContenido) return;
    // Línea base de FL0 (spec §45): del toque en la lista a ver mensajes.
    terminarCronometro('abrir-chat');
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
    // Hasta el MÁXIMO entre lo cargado y lo que el server dijo que existe: así
    // un mensaje final borrado en duro no deja un «sin leer» que no baja.
    const hasta = Math.max(last?.seq ?? 0, lastSeqInicial ?? 0);
    if (hasta > 0) markRead(hasta);
  }, [messages, markRead, lastSeqInicial]);

  return (
    <KeyboardAvoidingView
      // `style` y no `className`: NativeWind no estiliza componentes de terceros
      // y sin `flex: 1` la pantalla se aplastaba.
      style={{ flex: 1, backgroundColor: colores['fondo-chat'] }}
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
          ) : subtitulo ? (
            <Text
              testID="estado-presencia"
              className={`text-xs ${otroEscribe ? 'text-primary' : 'text-on-surface-variant'}`}
              numberOfLines={1}
            >
              {subtitulo}
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
              accessibilityLabel="Videollamada"
              onPress={() => llamar(chatId, chatName, true)}
              className="h-11 w-11 items-center justify-center"
            >
              <Video size={20} color={colores["on-surface-variant"]} />
            </Pressable>
            <Pressable
              testID="btn-llamada"
              accessibilityLabel="Llamar"
              onPress={() => llamar(chatId, chatName, false)}
              className="h-11 w-11 items-center justify-center"
            >
              <Phone size={20} color={colores["on-surface-variant"]} />
            </Pressable>
          </>
        ) : null}
        {/* El ⋮ no hacía nada (auditoría del 16/10): un botón que no responde
            enseña que la app no responde. Abre la info del chat. */}
        <Pressable
          testID="btn-menu-chat"
          accessibilityLabel="Info del chat"
          onPress={() => setVerDetalle(true)}
          android_ripple={{ color: colores.outline, borderless: true, radius: 22 }}
          className="h-11 w-9 items-center justify-center"
        >
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

      <ProgramarMensajeModal
        visible={programarVisible}
        texto={textoAProgramar}
        onProgramar={alProgramar}
        onCerrar={() => setProgramarVisible(false)}
      />

      {avisoProgramado ? (
        <View className="mx-4 mb-1 rounded-lg bg-primary/[0.10] px-3 py-2" testID="aviso-programado">
          <Text className="text-[12px] text-primary">🗓️ Programado. {avisoProgramado}.</Text>
        </View>
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

      <View className="flex-1">
        <FondoDelChat />
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
          // `autoscrollToBottomThreshold`: si se está cerca del final (20 % de la
          // pantalla), lo que llega o se manda baja la lista solo, como
          // WhatsApp. Leyendo arriba, no mueve nada.
          maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
          onScroll={alScrollear}
          scrollEventThrottle={100}
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
          renderItem={dibujarFila}
          getItemType={tipoDeFila}
        />
        {abajoLejos ? (
          // «Bajar al final» con los que llegaron mientras se leía arriba, como
          // WhatsApp. Aparece solo lejos del final: abajo no hace falta.
          <Pressable
            testID="btn-bajar"
            accessibilityLabel="Ir al último mensaje"
            onPress={() => listaRef.current?.scrollToEnd({ animated: true })}
            className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md"
          >
            <ChevronDown size={22} color={colores['on-surface-variant']} />
            {nuevosAbajo > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
                <Text className="text-[11px] font-bold text-on-primary" testID="nuevos-abajo">
                  {nuevosAbajo}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>


      {subidaEnCurso !== undefined ? (
        <Text className="px-4 pb-1 text-sm text-on-surface-variant" testID="subida-progreso">
          {textoDeSubida(subidaEnCurso)}
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
      <Composer
        ref={composerRef}
        respondiendoA={respondiendoA}
        onCancelarRespuesta={alCancelarRespuesta}
        subiendo={false}
        margenPie={tecladoAbierto ? MARGEN_CON_TECLADO : margenes.pie}
        onAdjuntar={alAdjuntar}
        onCamara={alCamara}
        onEscribiendo={avisarEscribiendo}
        onEnviar={alEnviar}
        onProgramar={alProgramarDesdeComposer}
        onNotaDeVoz={alNotaDeVoz}
        // Chat secreto: sin clave no se manda nada; con clave, solo texto.
        modoSecreto={encrypted ? (sesionLista ? 'solo-texto' : 'bloqueado') : undefined}
      />

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
            nombre: f.nombre,
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
        onLlamar={otherUserId ? (video) => llamar(chatId, chatName, video) : undefined}
        onVerImagen={(seq) => {
          setVerDetalle(false);
          alVerImagen(seq);
        }}
      />
    </KeyboardAvoidingView>
  );
}
