import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ProgramarMensajeModal } from './ProgramarMensajeModal';
import type { FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { formatDayLabel, startsNewDay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { AttachSheet } from './AttachSheet';
import { CrearDesdeElChat } from './CrearDesdeElChat';
import { CatchUpBanner } from './CatchUpBanner';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { DaySeparator, MessageRow, isPending, previewDeMensaje, type Row } from './MessageRow';
import { abrirConOtraApp } from './guardarYCompartir';
import { Composer, type ComposerHandle } from './Composer';
import { ChatDetailScreen } from './ChatDetailScreen';
import { useChat } from './useChat';
import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { useArchivosDelChat } from './useArchivosDelChat';
import { useLimpiarAvisoDelChat } from './useLimpiarAvisoDelChat';
import { SeleccionDeMensaje } from './SeleccionDeMensaje';
import { useProgramados } from './useProgramados';
import { VisorDelChat } from './VisorDelChat';
import { EncabezadoDelChat } from './EncabezadoDelChat';
import { EnviarFotos } from './EnviarFotos';
import { useAdjuntosDelChat } from './useAdjuntosDelChat';
import { sinOcultos, useOcultos } from './ocultos';
import { DivisorNoLeidos, useDivisorNoLeidos } from './useDivisorNoLeidos';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { BuscadorDelChat } from './BuscadorDelChat';
import { useBuscarEnChat } from './useBuscarEnChat';
import { textoDeSubida } from './progresoDeSubida';
import { citadosPorSeq, fotosDelChat } from './filasDelChat';
import { useNombresDelGrupo } from './useNombresDelGrupo';
import { subtituloDelChat } from './cabeceraDelChat';
import { ListaDeMensajes } from './ListaDeMensajes';
import { useRespuestaYEdicion } from './useRespuestaYEdicion';
import { useAtrasDelChat } from './useAtrasDelChat';
import { useMensajeFallido } from './useMensajeFallido';
import { useAlAbrirElChat } from './useAlAbrirElChat';

/** El pie del composer con el teclado abierto (dp). */
const MARGEN_CON_TECLADO = 8;
/** El segundo `scrollToIndex`, cuando la zona ya se midió. */
const SEGUNDO_PASE_MS = 400;
/** Cuánto queda resaltado el original de una cita. */
const RESALTADO_DE_CITA_MS = 1500;

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
  useLimpiarAvisoDelChat(chatId);
  const {
    eliminar,
    editar,
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
  const [mediaError, setMediaError] = useState('');
  /** Respondiendo (deslizando sobre un mensaje) o editando uno propio. */
  const respuesta = useRespuestaYEdicion({ editar, onError: setMediaError });

  // Mensajes programados (F11): long-press en enviar abre el modal.
  const programados = useProgramados({ jwt: credential.jwt, chatId, alProgramado: () => composerRef.current?.limpiar() });
  const [attachOpen, setAttachOpen] = useState(false);
  const [creando, setCreando] = useState<'event' | 'poll' | null>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  // Las llamadas son de la sesión (FL8): suenan en cualquier pantalla.
  const { llamar } = useLlamadas();

  const archivosEnCola = useArchivosDelChat(chatId);
  const subidaEnCurso = archivosEnCola.find((uno) => uno.progreso !== undefined)?.progreso;
  /** El `seq` de la foto abierta a pantalla completa, o `null`. */
  const [viendoSeq, setViendoSeq] = useState<number | null>(null);
  /** El mensaje seleccionado con pulsación larga, o `null`. */
  const [elegido, setElegido] = useState<number | null>(null);
  /** El mensaje resaltado un momento al saltar desde una cita (FL9). */
  const [resaltado, setResaltado] = useState<number | null>(null);
  const { ocultos, ocultar } = useOcultos(chatId);
  const [verDetalle, setVerDetalle] = useState(false);
  /**
   * Lo que se cambió en el detalle, para pintarlo YA en esta cabecera.
   *
   * Los props vienen de la lista, que es una foto del momento en que se abrió
   * el chat: sin esto, cambiar el nombre del grupo lo mostraba nuevo adentro
   * del detalle y viejo al cerrarlo, que se lee como que no se guardó.
   */
  const [infoPropia, setInfoPropia] = useState<{ name?: string; avatarUrl?: string }>({});

  const { cancelarRespuesta } = respuesta;
  const alEnviar = useCallback(
    async (texto: string, respondeA?: number) => {
      cancelarRespuesta();
      // Lo que mando yo SIEMPRE se ve: aunque estuviera leyendo arriba.
      requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: true }));
      const resultado = await send(texto, respondeA);
      // Si NO se pudo cifrar, el mensaje no salió y hay que decirlo: en un chat
      // con candado, un envío que falla en silencio engaña.
      if (resultado?.ok) return true;
      setFalloCifrado(true);
      return false;
    },
    [send, cancelarRespuesta]
  );
  const alAdjuntar = useCallback(() => setAttachOpen(true), []);
  const { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickFile } =
    useAdjuntosDelChat({ chatId, onError: setMediaError });

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

  /** Las fotos del chat para el visor: el archivo completo y el autor resuelto. */
  const fotos = useMemo(
    () => fotosDelChat(messages, { yo: credential.userId, esGrupo: esGrupoChat, nombres: nombresDelGrupo, nombreDelChat: chatName }),
    [messages, credential.userId, esGrupoChat, nombresDelGrupo, chatName]
  );

  /**
   * La lista, para poder mandarla al final: con MENOS contenido que pantalla
   * el ancla al fondo dejaba la última fila debajo de la barra de escribir.
   */
  const listaRef = useRef<FlashListRef<Row> | null>(null);

  // Memoizadas: sin esto cada render (una tecla, un «escribiendo») rearmaba
  // las filas y la lista volvía a dibujar todas las burbujas (FL2).
  const rows: Row[] = useMemo(
    () => [
      // «Eliminar para mí» (FL9): ocultos en este teléfono.
      ...sinOcultos(messages, ocultos),
      ...pending,
      ...archivosEnCola.map(({ archivo, progreso }) => ({
        clientKey: archivo.clientKey,
        queuedAt: archivo.queuedAt,
        pending: true as const,
        mediaUri: archivo.uri,
        mediaMime: archivo.mimeType,
        mediaNombre: archivo.fileName,
        body: archivo.caption,
        progreso,
        fallo: archivo.fallo,
      })),
    ],
    [messages, ocultos, pending, archivosEnCola]
  );

  const { divisorSeq, noLeidos: noLeidosAlAbrir, irAlInicio } = useDivisorNoLeidos({
    rows,
    yo: credential.userId,
    noLeidos: unread,
    listaRef,
  });

  /** Llevar la lista a un mensaje (la cita y la búsqueda, FL9). */
  const irAMensaje = useCallback(
    (seq: number): boolean => {
      const indice = rows.findIndex((fila) => !isPending(fila) && fila.seq === seq);
      if (indice < 0) return false;
      listaRef.current?.scrollToIndex({ index: indice, animated: true, viewPosition: 0.4 });
      // Segundo pase: con alturas variables, si esa zona todavía no se midió el
      // primero cae corto o no se mueve (visto en el E2E con el chat recién abierto).
      setTimeout(() => listaRef.current?.scrollToIndex({ index: indice, animated: false, viewPosition: 0.4 }), SEGUNDO_PASE_MS);
      return true;
    },
    [rows]
  );

  /** Tocar una cita: al original, resaltado un momento (FL9). */
  const alTocarCita = useCallback(
    (seq: number) => {
      if (!irAMensaje(seq)) return setMediaError('El mensaje original está más arriba: sube para cargarlo.');
      setResaltado(seq);
      setTimeout(() => setResaltado((actual) => (actual === seq ? null : actual)), RESALTADO_DE_CITA_MS);
    },
    [irAMensaje]
  );

  // Buscar dentro del chat (FL9): sobre lo que se ve —sin lo «eliminado para mí»—.
  const visiblesParaBuscar = useMemo(() => sinOcultos(messages, ocultos), [messages, ocultos]);
  const busqueda = useBuscarEnChat({ mensajes: visiblesParaBuscar, irA: irAMensaje });

  useAtrasDelChat(
    {
      haySeleccion: elegido !== null,
      buscando: busqueda.activo,
      editando: respuesta.editando !== null,
      respondiendo: respuesta.respondiendoA !== null,
    },
    {
      soltarSeleccion: () => setElegido(null),
      cerrarBusqueda: busqueda.cerrar,
      cancelarEdicion: respuesta.cancelarEdicion,
      cancelarRespuesta,
      volver: onBack,
    }
  );

  const mensajeElegido = elegido === null ? null : (messages.find((mensaje) => mensaje.seq === elegido) ?? null);

  /** Las citas, una vez por cambio de mensajes (antes un `find` por fila y por render). */
  const citados = useMemo(
    () =>
      citadosPorSeq(
        messages,
        { yo: credential.userId, esGrupo: esGrupoChat, nombreDelOtro: nombreVisible, nombres: nombresDelGrupo },
        previewDeMensaje
      ),
    [messages, credential.userId, esGrupoChat, nombreVisible, nombresDelGrupo]
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
  const { alResponder } = respuesta;
  const alFallido = useMensajeFallido(archivosEnCola);

  /**
   * Una fila. Estable mientras no cambien los mensajes ni los acuses: con
   * `MessageRow` memoizado, un mensaje nuevo dibuja SU burbuja y la de al lado
   * (por el agrupado), no la pantalla entera (FL2).
   */
  const dibujarFila = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      const previous = rows[index - 1];
      const next = rows[index + 1];
      const at = isPending(item) ? item.queuedAt : item.at;
      const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
      return (
        <>
          {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
          {!isPending(item) && item.seq === divisorSeq ? <DivisorNoLeidos cantidad={noLeidosAlAbrir} /> : null}
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
            seleccionado={!isPending(item) && (item.seq === elegido || item.seq === resaltado || item.seq === busqueda.seqActual)}
            onFallido={alFallido}
            onTocarCita={alTocarCita}
          />
        </>
      );
    },
    [rows, credential.userId, leidoHasta, entregadoHasta, esGrupoChat, nombresDelGrupo, alVerImagen, alResponder, citados, elegido, resaltado, busqueda.seqActual, divisorSeq, noLeidosAlAbrir, alFallido, alTocarCita]
  );

  // Con el teclado abierto no hay barra de navegación debajo: el margen del pie
  // dejaba un hueco entre el campo y el teclado (auditoría del 16/10).
  const tecladoAbierto = useKeyboardState((estado) => estado.isVisible);

  useAlAbrirElChat({ hayContenido: rows.length > 0, irAlInicio, mensajes: messages, lastSeqInicial, markRead });

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
      {elegido !== null && mensajeElegido ? (
        <SeleccionDeMensaje
          mensaje={mensajeElegido}
          yo={credential.userId}
          chatSecreto={Boolean(encrypted)}
          onCancelar={() => setElegido(null)}
          onResponder={(seq) => alResponder(seq, previewDeMensaje(mensajeElegido), mensajeElegido.senderId === credential.userId)}
          onEliminarParaTodos={eliminar}
          onEliminarParaMi={ocultar}
          onEditar={respuesta.empezarEdicion}
          onError={setMediaError}
        />
      ) : busqueda.activo ? (
        <BuscadorDelChat
          consulta={busqueda.consulta}
          onConsulta={busqueda.setConsulta}
          posicion={busqueda.posicion}
          total={busqueda.total}
          onAnterior={busqueda.anterior}
          onSiguiente={busqueda.siguiente}
          onCerrar={busqueda.cerrar}
        />
      ) : (
        <EncabezadoDelChat
          nombre={nombreVisible}
          foto={fotoVisible}
          secreto={Boolean(encrypted)}
          conectado={connected}
          subtitulo={subtitulo}
          otroEscribe={otroEscribe}
          puedeLlamar={Boolean(otherUserId)}
          onVolver={onBack}
          onAbrirDetalle={() => setVerDetalle(true)}
          onLlamar={(conVideo) => llamar(chatId, chatName, conVideo)}
        />
      )}

      <CrearDesdeElChat
        creando={creando}
        credential={credential}
        chat={{ id: chatId, name: chatName }}
        onCerrar={() => setCreando(null)}
      />

      <ProgramarMensajeModal
        visible={programados.visible}
        texto={programados.texto}
        onProgramar={programados.programar}
        onCerrar={programados.cerrar}
      />

      {programados.aviso ? (
        <View className="mx-4 mb-1 rounded-lg bg-primary/[0.10] px-3 py-2" testID="aviso-programado">
          <Text className="text-[12px] text-primary">🗓️ Programado. {programados.aviso}.</Text>
        </View>
      ) : null}

      {falloCifrado ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-cifrado">
          No se pudo cifrar el mensaje. No se envió.
        </Text>
      ) : null}

      {/* En un chat cifrado NO se ofrece «ponme al día»: Lila no puede leerlo,
          y un botón que siempre falla es peor que no tenerlo. */}
      {encrypted ? (
        <SecretChatBanner session={secreto} />
      ) : (
        <CatchUpBanner chatId={chatId} credential={credential} unread={unread} />
      )}

      <ListaDeMensajes
        listaRef={listaRef}
        rows={rows}
        mensajes={messages}
        yo={credential.userId}
        dibujarFila={dibujarFila}
        onListo={irAlInicio}
        onCargarAnteriores={() => void cargarAnteriores()}
        cargandoAnteriores={cargandoAnteriores}
        hayAnteriores={hayAnteriores}
      />

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
        chatId={chatId}
        respondiendoA={respuesta.respondiendoA}
        onCancelarRespuesta={cancelarRespuesta}
        editando={respuesta.editando}
        onCancelarEdicion={respuesta.cancelarEdicion}
        onEditar={respuesta.guardarEdicion}
        subiendo={false}
        margenPie={tecladoAbierto ? MARGEN_CON_TECLADO : margenes.pie}
        onAdjuntar={alAdjuntar}
        onCamara={alCamara}
        onEscribiendo={avisarEscribiendo}
        onEnviar={alEnviar}
        onProgramar={programados.abrir}
        onNotaDeVoz={alNotaDeVoz}
        // Chat secreto: sin clave no se manda nada; con clave, solo texto.
        modoSecreto={encrypted ? (sesionLista ? 'solo-texto' : 'bloqueado') : undefined}
      />

      <EnviarFotos fotos={fotosElegidas} onCancelar={cerrarFotos} onEnviar={(lista) => void alEnviarFotos(lista)} />

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickCamera={() => void pickFromCamera()}
        onPickGallery={() => void pickFromGallery()}
        onCreateEvent={() => setCreando('event')}
        onCreatePoll={() => setCreando('poll')}
        onPickFile={() => void pickFile()}
      />
      <VisorDelChat
        fotos={fotos}
        viendoSeq={viendoSeq}
        onCambiar={setViendoSeq}
        onEliminar={eliminar}
        onError={setMediaError}
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
        onBuscar={() => {
          setVerDetalle(false);
          busqueda.abrir();
        }}
      />
    </KeyboardAvoidingView>
  );
}
