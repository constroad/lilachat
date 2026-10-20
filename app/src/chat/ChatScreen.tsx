import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ProgramarMensajeModal } from './ProgramarMensajeModal';
import { ProgramadosDelChat } from './ProgramadosDelChat';
import type { FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { etiquetaDeRecordatorioEnElChat, type MencionEnMensaje } from '@lilachat/shared';
import { AttachSheet } from './AttachSheet';
import { CrearDesdeElChat, type QueSeCrea } from './CrearDesdeElChat';
import { AccionesDeTarjetaContext } from './accionesDeTarjeta';
import type { AgendaReminder } from '../agenda/agendaApi';
import { CatchUpBanner } from './CatchUpBanner';
import { cuantosParaPonerAlDia } from './ponerAlDia';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { previewDeMensaje, type Row } from './MessageRow';
import { abrirConOtraApp } from './guardarYCompartir';
import { Composer, type ComposerHandle } from './Composer';
import { ChatDetailScreen } from './ChatDetailScreen';
import { useChat } from './useChat';
import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { useArchivosDelChat } from './useArchivosDelChat';
import { useLimpiarAvisoDelChat } from './useLimpiarAvisoDelChat';
import { SeleccionDeMensaje } from './SeleccionDeMensaje';
import { useSeleccionDeMensajes } from './useSeleccionDeMensajes';
import { useProgramados } from './useProgramados';
import { VisorDelChat } from './VisorDelChat';
import { EncabezadoDelChat } from './EncabezadoDelChat';
import { EnviarFotos } from './EnviarFotos';
import { useAdjuntosDelChat } from './useAdjuntosDelChat';
import { sinOcultos, useOcultos } from './ocultos';
import { useDivisorNoLeidos } from './useDivisorNoLeidos';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { BuscadorDelChat } from './BuscadorDelChat';
import { useBuscarEnChat } from './useBuscarEnChat';
import { citadosPorSeq, filaDeArchivoEnCola, fotosDelChat, pendientesEnOrden, sinPendientesConfirmados } from './filasDelChat';
import { useGrupo } from './useGrupo';
import { FueraDelGrupo } from './FueraDelGrupo';
import { subtituloDelChat } from './cabeceraDelChat';
import { useDibujarFila } from './useDibujarFila';
import { useUltimaVez } from './useUltimaVez';
import { ListaDeMensajes } from './ListaDeMensajes';
import { useRespuestaYEdicion } from './useRespuestaYEdicion';
import { useAtrasDelChat } from './useAtrasDelChat';
import { useMensajeFallido } from './useMensajeFallido';
import { useAlAbrirElChat } from './useAlAbrirElChat';
import { useIrAMensaje } from './useIrAMensaje';
import { useFijarMensajes } from './useFijarMensajes';
import { useAcuseVivo } from './acuseVivo';
import { useHilosEnElChat } from './useHilosEnElChat';
import { HiloScreen } from './HiloScreen';
import type { PropsDelChat } from './propsDelChat';
import { useReaccionesEnPantalla } from './reacciones/useReaccionesEnPantalla';
import { TarjetaDeFijados } from './fijados/TarjetaDeFijados';
import { CamaraDelChat } from './camara/CamaraDelChat';

/** El pie del composer con el teclado abierto (dp). */
const MARGEN_CON_TECLADO = 8;

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
  readSeq,
  lastSeqInicial,
  irASeq,
  encrypted,
  otherUserId,
  esBorrador = false,
  onBack,
}: PropsDelChat) {
  const colores = useColores();
  const margenes = useMargenes();
  const secreto = useSecretChat({
    credential,
    otherUserId: otherUserId ?? null,
    enabled: Boolean(encrypted),
  });
  const sesionLista = encrypted && secreto.estado === 'listo' ? secreto : null;
  useLimpiarAvisoDelChat(chatId);
  const acuseDeLaLista = useAcuseVivo(chatId);
  const {
    eliminar,
    editar,
    reaccionar,
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
    // Lo que la lista sabe ahora (en vivo y releído al reconectar), no solo la foto de la ruta.
    baseLeido: Math.max(othersReadSeq, acuseDeLaLista.leido),
    baseEntregado: Math.max(othersDeliveredSeq, acuseDeLaLista.entregado),
  });
  // El borrador vive en el Composer (FL2): una tecla ya no re-renderiza esto.
  const composerRef = useRef<ComposerHandle>(null);
  const [mediaError, setMediaError] = useState('');
  /** Respondiendo (deslizando sobre un mensaje) o editando uno propio. */
  const respuesta = useRespuestaYEdicion({ editar, onError: setMediaError });

  // Mensajes programados (F11): long-press en enviar abre el modal.
  const programados = useProgramados({ jwt: credential.jwt, chatId, alProgramado: () => composerRef.current?.limpiar() });
  const [attachOpen, setAttachOpen] = useState(false);
  const [creando, setCreando] = useState<QueSeCrea>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  // Las llamadas son de la sesión (FL8): suenan en cualquier pantalla.
  const { llamar } = useLlamadas();

  const archivosEnCola = useArchivosDelChat(chatId);
  /** El `seq` de la foto abierta a pantalla completa, o `null`. */
  const [viendoSeq, setViendoSeq] = useState<number | null>(null);
  // E3: las respuestas de un hilo no van en el chat; el hilo abierto, en su pantalla.
  const hilos = useHilosEnElChat({ chatId, yo: credential.userId, jwt: credential.jwt, messages, pending });
  /** Los mensajes elegidos con pulsación larga (FL9: uno o varios). */
  const seleccion = useSeleccionDeMensajes(messages);
  const { ocultos, ocultar } = useOcultos(chatId);
  const [verDetalle, setVerDetalle] = useState(false);
  /**
   * El detalle se monta la PRIMERA vez que se abre y queda (FL12, §49 #13):
   * cerrado igual clasificaba las medias del chat en cada mensaje nuevo, y la
   * mayoría de las veces nadie lo abre. Quedarse montado conserva la animación.
   */
  const [detalleUsado, setDetalleUsado] = useState(false);
  if (verDetalle && !detalleUsado) setDetalleUsado(true);
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
    async (texto: string, respondeA?: number, menciones?: (texto: string) => MencionEnMensaje[]) => {
      cancelarRespuesta();
      // Lo que mando yo SIEMPRE se ve: aunque estuviera leyendo arriba.
      requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: true }));
      const resultado = await send(texto, respondeA, menciones);
      // Si NO se pudo cifrar, no salió y se dice: en un chat con candado, callar engaña.
      if (resultado?.ok) return true;
      setFalloCifrado(true);
      return false;
    },
    [send, cancelarRespuesta]
  );
  const alAdjuntar = useCallback(() => setAttachOpen(true), []);
  const { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickFile, camara } =
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
  const esGrupoChat = !esBorrador && (otherUserId === null || otherUserId === undefined);
  const otroEscribe = otherUserId ? escribiendo.has(otherUserId) : escribiendo.size > 0;
  const otroEnLinea = otherUserId ? enLinea.has(otherUserId) : false;
  const ultimaVez = useUltimaVez(otherUserId);
  const grupo = useGrupo(chatId, credential.jwt, esGrupoChat);
  const nombresDelGrupo = grupo.nombres;
  const fotosDelGrupo = grupo.fotos;
  // En un 1:1 el otro se llama como el chat (reacciones y fijados).
  const nombresDeReacciones = useMemo(() => (esGrupoChat ? nombresDelGrupo : new Map(otherUserId ? [[otherUserId, chatName]] : [])), [esGrupoChat, nombresDelGrupo, otherUserId, chatName]);
  const nombreDe = useCallback((id: string) => (id === credential.userId ? 'Tú' : (nombresDeReacciones.get(id) ?? 'Alguien')), [credential.userId, nombresDeReacciones]);
  // Memo: un arreglo nuevo en cada render redibujaría la barra de escribir (FL12).
  const mencionables = useMemo(() => (esGrupoChat ? grupo.mencionables(credential.userId) : undefined), [esGrupoChat, grupo.mencionables, credential.userId]);
  /** Me sacaron del grupo (FL9d): se lee, pero ya no se escribe. */
  const fueraDelGrupo = esGrupoChat && grupo.soyMiembro === false;
  const soyAdminDelGrupo = esGrupoChat && grupo.soyAdmin(credential.userId);
  // Un admin edita el recordatorio del grupo tocando su tarjeta (José, 19/10).
  // Editar el recordatorio del chat: en un grupo, sus admins; en un 1:1 o un borrador, cualquiera (20/10).
  const puedeEditarRecordatorios = !esGrupoChat || soyAdminDelGrupo;
  const accionesDeTarjeta = useMemo(() => ({ editarRecordatorio: puedeEditarRecordatorios ? (recordatorio: AgendaReminder) => setCreando({ recordatorio }) : undefined }), [puedeEditarRecordatorios]);
  // Fuera del grupo no se listan miembros: ya no es «QA Ana, Vos».
  const subtitulo = fueraDelGrupo ? '' : esBorrador ? 'Solo tú lo ves' : subtituloDelChat({
    esGrupo: esGrupoChat,
    escriben: [...escribiendo],
    otroEnLinea,
    ultimaVez,
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

  // Memoizadas: cada render (una tecla, un «escribiendo») redibujaba todas las burbujas (FL2).
  const rows: Row[] = useMemo(
    () => [
      // «Eliminar para mí» (FL9): ocultos en este teléfono.
      ...sinOcultos(hilos.delChat, ocultos),
      // Lo pendiente, en el orden en que se mandó. El eco puede llegar antes que
      // el ack: sin el filtro la burbuja salía doble (los archivos comparten `clientKey`).
      ...pendientesEnOrden(
        sinPendientesConfirmados(hilos.pendientesDelChat, messages),
        sinPendientesConfirmados(archivosEnCola.map(({ archivo, progreso }) => filaDeArchivoEnCola(archivo, progreso)), messages)
      ),
    ],
    [messages, ocultos, archivosEnCola, hilos.delChat, hilos.pendientesDelChat]
  );

  const { divisorSeq, noLeidos: noLeidosAlAbrir, irAlInicio } = useDivisorNoLeidos({
    rows,
    yo: credential.userId,
    noLeidos: unread,
    leidoHasta: readSeq,
    listaRef,
  });

  const { irAMensaje, alTocarCita, alAbrir, saltarA, resaltado } = useIrAMensaje({ rows, listaRef, irASeq, irAlInicio, onNoEsta: setMediaError });
  const fijar = useFijarMensajes({
    chatId,
    jwt: credential.jwt,
    puedeFijar: esBorrador || !esGrupoChat || soyAdminDelGrupo,
    textoLocal: (seq) => messages.find((uno) => uno.seq === seq)?.body,
    nombreDe,
    fotoDe: (id) => fotosDelGrupo.get(id),
    onIr: (seq) => saltarA(seq, 'Ese mensaje está más arriba: sube para cargarlo.'),
    onError: setMediaError,
  });

  // Buscar dentro del chat (FL9): sobre lo que se ve —sin lo «eliminado para mí»—.
  const visiblesParaBuscar = useMemo(() => sinOcultos(messages, ocultos), [messages, ocultos]);
  const busqueda = useBuscarEnChat({ mensajes: visiblesParaBuscar, irA: irAMensaje });

  useAtrasDelChat(
    {
      haySeleccion: seleccion.enSeleccion,
      buscando: busqueda.activo,
      editando: respuesta.editando !== null,
      respondiendo: respuesta.respondiendoA !== null,
    },
    {
      soltarSeleccion: seleccion.soltar,
      cerrarBusqueda: busqueda.cerrar,
      cancelarEdicion: respuesta.cancelarEdicion,
      cancelarRespuesta,
      volver: onBack,
    }
  );


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
  // «Ponme al día» con sentido: 10 o más mensajes ajenos de verdad (José, 18/10).
  const paraPonerAlDia = useMemo(() => cuantosParaPonerAlDia(messages, unread, credential.userId), [messages, unread, credential.userId]);
  const [leyoHastaElFinal, setLeyoHastaElFinal] = useState(false);
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

  const reacciones = useReaccionesEnPantalla({ mensajes: messages, reaccionar, yo: credential.userId, nombres: nombresDeReacciones, fotos: fotosDelGrupo, alReaccionar: seleccion.soltar });
  // Una fila, estable mientras no cambien mensajes ni acuses: un mensaje nuevo dibuja SU burbuja (FL2).
  const dibujarFila = useDibujarFila({
    rows,
    yo: credential.userId,
    jwt: credential.jwt,
    encrypted: Boolean(encrypted),
    esGrupo: esGrupoChat,
    nombres: nombresDelGrupo,
    fotos: fotosDelGrupo,
    leidoHasta,
    entregadoHasta,
    divisorSeq,
    noLeidosAlAbrir,
    citados,
    elegidos: seleccion.elegidos,
    enSeleccion: seleccion.enSeleccion,
    resaltado,
    seqBuscado: busqueda.seqActual,
    onVerImagen: alVerImagen,
    onSeleccionar: seleccion.alternar,
    onResponder: alResponder,
    onFallido: alFallido,
    onTocarCita: alTocarCita,
    onAbrirHilo: hilos.abrir,
    hiloConNuevas: hilos.hiloConNuevas,
    onReaccionar: reacciones.elegir,
    onMasEmojis: reacciones.masEmojis,
    onVerReacciones: reacciones.verReacciones,
  });

  // Teclado abierto = sin barra de navegación: el margen del pie dejaba un hueco (16/10).
  const tecladoAbierto = useKeyboardState((estado) => estado.isVisible);

  useAlAbrirElChat({ hayContenido: rows.length > 0, irAlInicio: alAbrir, mensajes: messages, lastSeqInicial, markRead });

  return (
    <View style={{ flex: 1, backgroundColor: colores['fondo-chat'] }} testID="pantalla-chat">
      {/* La cabecera queda FUERA de lo que sube con el teclado y por encima: la conversación pasa por debajo. */}
      <View style={{ zIndex: 2, elevation: 2 }}>
      {/**
       * Con un mensaje seleccionado, la cabecera se REEMPLAZA por la barra de
       * acciones — no se apila encima. Es lo que hace WhatsApp: mientras estás
       * eligiendo qué borrar, el nombre y las llamadas no sirven de nada, y dos
       * barras a la vez empujan la conversación fuera de la pantalla.
       */}
      {seleccion.enSeleccion ? (
        <SeleccionDeMensaje
          mensajes={seleccion.mensajes}
          chatId={chatId}
          jwt={credential.jwt}
          yo={credential.userId}
          chatSecreto={Boolean(encrypted)}
          onCancelar={seleccion.soltar}
          onResponder={(seq) => {
            const elegido = seleccion.mensajes.find((uno) => uno.seq === seq);
            if (elegido) alResponder(seq, previewDeMensaje(elegido), elegido.senderId === credential.userId);
          }}
          onEliminarParaTodos={eliminar}
          onEliminarParaMi={ocultar}
          onEditar={respuesta.empezarEdicion}
          onError={setMediaError}
          puedeFijar={esBorrador || !esGrupoChat || soyAdminDelGrupo}
          fijados={fijar.seqsFijados}
          onFijar={fijar.pedirFijar}
          onDesfijar={(seq) => void fijar.desfijar(seq)}
          onAbrirHilo={encrypted ? undefined : hilos.abrir}
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
          borrador={esBorrador}
          conectado={connected}
          subtitulo={subtitulo}
          otroEscribe={otroEscribe}
          puedeLlamar={Boolean(otherUserId)}
          onVolver={onBack}
          onAbrirDetalle={() => setVerDetalle(true)}
          onLlamar={(conVideo) => llamar(chatId, chatName, conVideo)}
        />
      )}

      {fijar.franja}
      </View>
      {/**
       * El teclado (José, 20/10: «la animación de subida y bajada se siente
       * torpe; WhatsApp es más ágil»). Con `padding` la lista se volvía a
       * medir en CADA cuadro de la animación. `translate-with-padding` mueve
       * la conversación como un bloque (transform, sin medir) y ajusta el
       * tamaño una sola vez al final. Ver §59.
       */}
      <KeyboardAvoidingView style={{ flex: 1, zIndex: 1 }} behavior="translate-with-padding">
      {fijar.hoja}

      <CrearDesdeElChat
        creando={creando}
        credential={credential}
        chat={{ id: chatId, name: chatName, kind: esBorrador ? 'notas' : esGrupoChat ? 'group' : 'direct' }}
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

      {/* En un chat cifrado NO hay «ponme al día»: Lila no puede leerlo. */}
      {encrypted ? (
        <SecretChatBanner session={secreto} />
      ) : (
        <CatchUpBanner chatId={chatId} credential={credential} unread={paraPonerAlDia} leido={leyoHastaElFinal} />
      )}

      <AccionesDeTarjetaContext.Provider value={accionesDeTarjeta}>
        <ListaDeMensajes
          listaRef={listaRef}
          rows={rows}
          mensajes={messages}
          yo={credential.userId}
          dibujarFila={dibujarFila}
          onListo={alAbrir}
          onCargarAnteriores={() => void cargarAnteriores()}
          cargandoAnteriores={cargandoAnteriores}
          hayAnteriores={hayAnteriores}
          onLlegoAlFinal={() => setLeyoHastaElFinal(true)}
        />
      </AccionesDeTarjetaContext.Provider>

      {mediaError ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-media">
          {mediaError}
        </Text>
      ) : null}

      <ProgramadosDelChat pendientes={programados.pendientes} onCancelar={programados.cancelar} />

      {/* La barra de escribir: su composición (la píldora con emoji, clip y cámara; UN botón afuera) se explica en `Composer`. */}
      {fueraDelGrupo ? (
        <FueraDelGrupo margenPie={tecladoAbierto ? MARGEN_CON_TECLADO : margenes.pie} />
      ) : (
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
          jwt={credential.jwt}
          conVistaPrevia={!encrypted}
          miembros={mencionables}
          onEnviar={alEnviar}
          onProgramar={programados.abrir}
          onNotaDeVoz={alNotaDeVoz}
          // Chat secreto: sin clave no se manda nada; con clave, solo texto.
          modoSecreto={encrypted ? (sesionLista ? 'solo-texto' : 'bloqueado') : undefined}
        />
      )}

      <CamaraDelChat visible={camara.abierta} nombreDelChat={nombreVisible} onEnviar={(lista, opciones) => void camara.enviar(lista, opciones)} onGaleria={camara.aLaGaleria} onCerrar={camara.cerrar} />
      <EnviarFotos fotos={fotosElegidas} onCancelar={cerrarFotos} onEnviar={(lista, opciones) => void alEnviarFotos(lista, opciones)} />
      <HiloScreen
        raiz={hilos.raiz}
        chatId={chatId}
        chatName={chatName}
        yo={credential.userId}
        esGrupo={esGrupoChat}
        nombres={nombresDelGrupo}
        fotos={fotosDelGrupo}
        respuestas={hilos.respuestas}
        pendientes={hilos.pendientesDelHilo}
        leidoHasta={leidoHasta}
        entregadoHasta={entregadoHasta}
        onEnviar={(texto, enElChat) => send(texto, undefined, undefined, { de: hilos.abierto!, enElChat })}
        reaccionar={reaccionar}
        onCerrar={hilos.cerrar}
      />
      {reacciones.hojas}

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickCamera={() => void pickFromCamera()}
        onPickGallery={() => void pickFromGallery()}
        onCreateEvent={() => setCreando('event')}
        onCreatePoll={() => setCreando('poll')}
        // 20/10: también en un 1:1 y en un borrador; en un grupo, sus admins. No en un chat secreto.
        onCreateReminder={!encrypted && (!esGrupoChat || soyAdminDelGrupo) ? () => setCreando('reminder') : undefined}
        etiquetaDelRecordatorio={etiquetaDeRecordatorioEnElChat(esBorrador ? 'notas' : esGrupoChat ? 'group' : 'direct')}
        onPickFile={() => void pickFile()}
      />
      <VisorDelChat
        fotos={fotos}
        viendoSeq={viendoSeq}
        onCambiar={setViendoSeq}
        onEliminar={eliminar}
        onError={setMediaError}
      />

      {detalleUsado ? (
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
        tarjetas={<TarjetaDeFijados fijados={fijar.fijados} textoDe={fijar.textoDe} nombreDe={nombreDe} onVerTodos={() => { setVerDetalle(false); fijar.verTodos(); }} />}
      />
      ) : null}
    </KeyboardAvoidingView>
    </View>
  );
}
