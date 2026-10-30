import type { NotificationLevel } from '@lilachat/shared';
import { alreadyGreeted, newAlbumId } from '@lilachat/shared';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { PanelDeInfo } from './info/PanelDeInfo';
import type { ChatAction } from './menuDelChat';
import { fijadosVigentes, memberMay, memberPermissionDenied, puedeFijarEnElChat } from '@lilachat/shared';
import { DialogoFijar } from './DialogoFijar';
import { FranjaDeFijados } from './FranjaDeFijados';
import { ListaDeFijados, TarjetaDeFijados } from './fijados/ListaDeFijados';
import { ChecklistsCard } from './tarjetas/ChecklistsCard';
import { useFijarEnLaWeb } from './useFijarEnLaWeb';
import type { AccionSobreMensaje } from './contextoDeLaConversacion';
import { EnviarArchivos } from './EnviarArchivos';
import { PhotoViewer } from './VisorDeFotos';
import { PdfViewer } from './PdfViewer';
import type { MensajeEnPantalla } from './types';
import { comoMensaje, usePendientesDeArchivos } from './colaDeArchivos';
import { colaDeArchivosWeb, usarJwtParaSubir } from './colaDeArchivosWeb';
import { aplicarEntrante } from '../local/mensajesLocales';
import { useHilosWeb } from './hilos/useHilosWeb';
import { PanelDeHilo } from './hilos/PanelDeHilo';
import { OutsideMentionNotice } from './OutsideMentionNotice';
import { useMentionCandidatesWeb } from './useMentionCandidatesWeb';
import { useOutsideMentionsWeb } from './useOutsideMentionsWeb';
import { PanelBoundary } from '../ui/ErrorBoundary';
import { api } from '../api';
import { Conversation } from './Conversation';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import { DialogoEliminar, DialogoInfo } from './DialogosDelMensaje';
import { DialogoReenviar, TU_NUEVO } from './reenviar/DialogoReenviar';
import { useAccionesSobreMensajes, type AccionesDeSync } from './useAccionesSobreMensajes';
import { useDetalleDelChat } from './useDetalleDelChat';
import { cardPersonOf } from './personCard/cardPersonOf';
import { usePersonCardWeb } from './personCard/usePersonCardWeb';
import type { ChatSummary } from './types';
import { CallExtrasMenu } from './scheduledCall/CallExtrasMenu';
import type { BaseLocal } from '../local/baseLocal';
import { useDestacadosWeb } from './destacados/useDestacadosWeb';
import { TarjetaDeDestacados } from './destacados/TarjetaDeDestacados';
import { useStickers } from './stickers/useStickers';
import type { StickerAction } from './contextoDeLaConversacion';
import { memberBadge, opensInPhotoViewer, replyOpensThread, usesFlatLayout } from '@lilachat/shared';
import { useGroupsAsList } from '../ui/groupsAsList';
import { GroupCallStripFor, useCalls } from '../calls/CallProvider';
import { ChatQueue } from './queue/ChatQueue';
import { gifAsPendingMessage, useGifsInFlight } from './gifs/gifsInFlight';
import { useMessageWindow } from './useMessageWindow';
import { windowOnScreen } from './windowOnScreen';
import { BirthdayCardWeb } from './birthdays/BirthdayCardWeb';
import { insertIntoComposer } from './composerInsert';

type PropsDeConversacion = ComponentProps<typeof Conversation>;

/**
 * La conversación con todo lo que se hace sobre sus mensajes (W2): el menú de
 * cada burbuja, responder, editar, eliminar, reenviar e «Info», más los nombres
 * de los miembros para autores y menciones. Así `Shell` no crece.
 */
export function ConversacionConAcciones(
  props: Omit<PropsDeConversacion, 'contexto' | 'onCancelarContexto' | 'onSend' | 'mencionables' | 'onOutsideMentions' | 'avisoDeMencion' | 'jwtParaEnlaces' | 'onElegirArchivos' | 'onNotaDeVoz' | 'onEscribiendo' | 'franja' | 'queue' | 'salto' | 'onNoEsta' | 'ventana' | 'viewId'> & {
    jwt: string;
    base: BaseLocal | null;
    sync: AccionesDeSync;
    chats: ChatSummary[];
    onAviso: (texto: string) => void;
    /** Los fijados viajan con la lista: tras fijar o desfijar se relee. */
    onRecargarChats: () => void;
    /** Silenciar, salir o eliminar desde «Info.» (W3b): las mismas acciones de la lista. */
    onAccionDeChat: (chat: ChatSummary, accion: ChatAction) => void;
    /** E3b: a group's notification level, from «Info.». */
    onLevel: (chat: ChatSummary, level: NotificationLevel) => void;
    /** Ir a un mensaje pedido desde afuera (un destacado de la lista global, 20/10). */
    irA?: { seq: number; vez: number } | null;
    /** A 1:1 opened from a person's card (José, 25/10); a space's 1:1 comes with its summary. */
    onOpenChat?: (chatId: string, known?: ChatSummary) => void;
  }
) {
  const { chat, yo, sync, onAviso } = props;
  const mensajes = useConArchivosPendientes(props.mensajes, chat.id, yo, props.jwt, props.base);
  // E3: el chat sin las respuestas de los hilos; el hilo abierto, en su panel.
  const hilos = useHilosWeb({ chatId: chat.id, jwt: props.jwt, base: props.base, yo, mensajes });
  // El detalle se relee si cambian los miembros, el nombre o la foto (llega con la
  // lista), o tras editar algo desde «Info.» (W3b).
  const [versionDelDetalle, setVersionDelDetalle] = useState(0);
  const detalle = useDetalleDelChat(chat.id, props.jwt, props.base, `${versionDelDetalle}|${chat.memberIds.join(',')}|${chat.name ?? ''}|${chat.avatarUrl ?? ''}`);
  const [infoAbierta, setInfoAbierta] = useState(false);
  useEffect(() => {
    setInfoAbierta(false);
  }, [chat.id]);
  const nombres = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const miembro of detalle?.miembros.values() ?? []) mapa.set(miembro.id, miembro.nombre);
    if (!mapa.has(yo)) mapa.set(yo, 'Tú');
    return mapa;
  }, [detalle, yo]);
  /** Who has a photo, for the thread chip and root (backlog 18). */
  const photos = useMemo(() => new Map([...(detalle?.miembros.values() ?? [])].flatMap((member) => (member.foto ? [[member.id, member.foto] as const] : []))), [detalle]);
  const acciones = useAccionesSobreMensajes({ chatId: chat.id, sync, nombres, onAviso });
  // Solo en grupos se menciona; a uno mismo, no. In a space `@` lists the whole space, and whoever is not in the channel is offered to be added (José 25/10).
  const mencionables = useMentionCandidatesWeb({ jwt: props.jwt, workspaceId: chat.workspaceId, isGroup: chat.kind === 'group', detail: detalle, myUserId: yo });
  const outsideMentions = useOutsideMentionsWeb({ jwt: props.jwt, chatId: chat.id });
  const [archivos, setArchivos] = useState<File[] | null>(null);
  const [fotoAbierta, setFotoAbierta] = useState<number | null>(null);
  // Photos, GIFs and videos; never a sticker (José, 22/10: they showed up while swiping).
  const viewerPhotos = useMemo(() => (mensajes ?? []).filter(opensInPhotoViewer), [mensajes]);
  const openPhoto = useCallback((mensaje: MensajeEnPantalla) => setFotoAbierta(Math.max(0, viewerPhotos.findIndex((uno) => uno.clientKey === mensaje.clientKey))), [viewerPhotos]);
  const [pdfAbierto, setPdfAbierto] = useState<MensajeEnPantalla | null>(null);
  const greet = useCallback(() => void sync.enviarTexto(chat.id, '👋'), [sync, chat.id]);
  const canGreet = useCallback((noticeSeq: number) => !alreadyGreeted((mensajes ?? []).map((one) => ({ seq: one.seq, senderId: one.senderId, pending: Boolean(one.estado) })), noticeSeq, yo), [mensajes, yo]);
  /** A la cola (auditoría 19/10): cada burbuja aparece ya y sube por detrás; el pie va en el primero. */
  const subir = (lista: File[], pie: string, hd: boolean) => {
    setArchivos(null);
    // Two or more photos or videos together go as one album (pending 12).
    const albumId = lista.filter((archivo) => /^(image|video)\//.test(archivo.type)).length >= 2 ? newAlbumId() : undefined;
    lista.forEach((archivo, indice) => void colaDeArchivosWeb.encolar(chat.id, archivo, { caption: indice === 0 && pie ? pie : undefined, hd, albumId: /^(image|video)\//.test(archivo.type) ? albumId : undefined }));
  };
  const citado = useCallback((seq: number) => mensajes?.find((uno) => uno.seq === seq), [mensajes]);
  // Fijar mensajes (19/10): en un grupo, solo los admins.
  // Reminders stay with the admins; pinning follows the group's switch (pending 8).
  const administra = puedeFijarEnElChat({ kind: chat.kind, esAdmin: detalle?.soyAdmin ?? false });
  const miRol = detalle?.soyAdmin ? 'admin' : 'member';
  const puedeFijar = administra || (chat.kind === 'group' && memberMay({ permission: 'pinMessages', role: miRol, permissions: detalle?.memberPermissions }));
  const sendLock = chat.kind === 'group' && detalle && !memberMay({ permission: 'sendMessages', role: miRol, permissions: detalle.memberPermissions }) ? memberPermissionDenied('sendMessages') : null;
  const fijados = useMemo(() => fijadosVigentes(chat.fijados, Date.now()), [chat.fijados]);
  const seqsFijados = useMemo(() => new Set(fijados.map((uno) => uno.seq)), [fijados]);
  const fijar = useFijarEnLaWeb({ chatId: chat.id, jwt: props.jwt, onAviso, onCambio: props.onRecargarChats });
  const [salto, setSalto] = useState<{ seq: number; vez: number } | null>(null);
  // An old message opens with its context (pending 44) instead of «sube para cargarlo».
  const ventana = useMessageWindow(props.jwt, chat.id);
  // Leaving the window also forgets the jump: the remounted list would look for it again and reopen it.
  const closeWindow = useCallback(() => {
    setSalto(null);
    ventana.close();
  }, [ventana]);
  useEffect(() => {
    if (props.irA) setSalto(props.irA);
  }, [props.irA]);
  const destacados = useDestacadosWeb({ chatId: chat.id, jwt: props.jwt, secreto: Boolean(chat.encrypted) });
  const [verFijados, setVerFijados] = useState(false);
  const nombreDe = useCallback((id: string) => (id === yo ? 'Tú' : (nombres.get(id) ?? 'Alguien')), [yo, nombres]);
  const textoLocal = useCallback((seq: number) => citado(seq)?.body, [citado]);
  const abrirHilo = useCallback(
    (seq: number) => {
      setInfoAbierta(false);
      hilos.abrir(seq);
    },
    [hilos.abrir]
  );
  const { keepReceived, saveGif } = useStickers(props.jwt, yo);
  const calls = useCalls();
  const onStickerAction = useCallback(
    (mensaje: MensajeEnPantalla, action: StickerAction) => void (action === 'gif' ? saveGif({ chatId: chat.id, seq: mensaje.seq }) : keepReceived(chat.id, mensaje.seq, action === 'favorite')).then(onAviso),
    [keepReceived, saveGif, chat.id, onAviso]
  );
  // Groups as flat rows, like Slack (design `s-01`): always in a company space, on request in a personal group.
  const flat = usesFlatLayout(chat, { groupsAsList: useGroupsAsList() });
  const onAccion = useCallback(
    (mensaje: MensajeEnPantalla, accion: AccionSobreMensaje) => {
      if (accion === 'fijar') return fijar.pedir(mensaje.seq);
      if (accion === 'hilo') return abrirHilo(mensaje.seq);
      // In the Slack layout «Responder» answers in the thread, as in Slack (pending 110).
      if (accion === 'responder' && !chat.encrypted && replyOpensThread({ flat, message: mensaje })) return abrirHilo(mensaje.seq);
      if (accion === 'desfijar') return void fijar.desfijar(mensaje.seq);
      if (accion === 'destacar' || accion === 'quitarDestacado') return void destacados.alternar(mensaje.seq).then((r) => !r.ok && onAviso('No se pudo destacar. Revisa tu conexión.'));
      acciones.onAccion(mensaje, accion);
    },
    [fijar, acciones, abrirHilo, destacados, onAviso, chat.encrypted, flat]
  );
  const onReaccionar = useCallback(
    (seq: number, emoji: string | null) => void sync.reaccionar(chat.id, seq, emoji).then((r) => !r.ok && r.motivo && onAviso(r.motivo)),
    [sync, chat.id, onAviso]
  );
  // El recordatorio del chat (W3c): lo crean y editan quienes pueden fijar (en un grupo, sus admins), nunca en un secreto.
  const editarRecordatorio = !chat.encrypted && administra ? props.onEditReminder : undefined;
  const badgeOf = useCallback((senderId: string) => memberBadge({ ...detalle?.pills.get(senderId), isMe: senderId === yo }), [detalle, yo]);
  const isAppOf = useCallback((senderId: string) => detalle?.pills.get(senderId)?.role === 'app', [detalle]);
  const personCard = usePersonCardWeb({ jwt: props.jwt, myUserId: yo, spaceId: chat.workspaceId, onOpenChat: props.onOpenChat });
  const showPerson = useCallback((userId: string) => {
    const person = cardPersonOf({ userId, detail: detalle, names: nombres, myUserId: yo });
    if (person) personCard.show(person);
  }, [detalle, nombres, yo, personCard.show]);
  const contexto = useMemo<ContextoDeLaConversacion>(
    () => ({ yo, jwt: props.jwt, chat, detalle, nombres, photos, citado, onAccion, onVerFoto: openPhoto, onViewPerson: showPerson, onVerPdf: setPdfAbierto, onGreet: greet, canGreet, puedeFijar, fijados: seqsFijados, onAbrirHilo: chat.encrypted ? undefined : abrirHilo, hiloConNuevas: hilos.hiloConNuevas, onReaccionar: chat.encrypted ? undefined : onReaccionar, onEditarRecordatorio: editarRecordatorio, destacados: destacados.seqs, onStickerAction: chat.encrypted ? undefined : onStickerAction, flat, badgeOf, isAppOf }),
    [yo, props.jwt, chat, detalle, nombres, photos, citado, onAccion, openPhoto, showPerson, greet, canGreet, puedeFijar, seqsFijados, abrirHilo, hilos.hiloConNuevas, onReaccionar, editarRecordatorio, destacados.seqs, onStickerAction, flat, badgeOf, isAppOf]
  );

  // Nudges and winks: in a 1:1 (not the chat with yourself), or a group whose admin allows them (José, 21/10).
  const funAllowed = chat.kind === 'direct' ? !chat.propio : chat.kind === 'group' && chat.funAllowed === true;
  // Calls: a 1:1 with a person, never with yourself or an installed app (a bot does not answer).
  const otherId = chat.kind === 'direct' && !chat.propio ? chat.memberIds.find((id) => id !== yo) : undefined;
  const canCall = Boolean(otherId) && detalle?.pills.get(otherId ?? '')?.role !== 'app';
  // Pending 56: a group or channel calls everyone in it (not a secret one, not from outside).
  const groupCall = chat.kind === 'group' && !chat.encrypted && chat.memberIds.includes(yo);
  return (
    <ConversacionContext.Provider value={contexto}>
      <Conversation
        {...props}
        onCreateReminder={!chat.encrypted && administra ? props.onCreateReminder : undefined}
        sendLock={sendLock}
        // En un grupo, quién escribe (el socket trae su id).
        typingName={props.typingName ? nombres.get(props.typingName) ?? 'Alguien' : null}
        onEscribiendo={() => sync.avisarEscribiendo(chat.id)}
        contexto={acciones.contexto}
        onCancelarContexto={acciones.cancelarContexto}
        replyingTo={acciones.replyingTo}
        onNudge={funAllowed ? () => void sync.sendNudge(chat.id).then((result) => result.ok || onAviso(result.motivo)) : undefined}
        onCall={canCall ? (video) => calls.call(chat.id, chat.name ?? chat.phone ?? 'Llamada', video) : groupCall ? (video) => calls.callGroup(chat.id, chat.name ?? 'Grupo', video) : undefined}
        callStrip={groupCall ? <GroupCallStripFor chatId={chat.id} chatName={chat.name ?? 'Grupo'} /> : undefined}
        callExtras={canCall ? <CallExtrasMenu jwt={props.jwt} chat={{ id: chat.id, name: chat.name ?? chat.phone ?? 'Conversación' }} /> : undefined}
        onWink={funAllowed ? (wink) => void sync.sendWink(chat.id, wink).then((result) => result.ok || onAviso(result.motivo)) : undefined}
        mencionables={mencionables}
        onOutsideMentions={outsideMentions.notify}
        avisoDeMencion={<OutsideMentionNotice outside={outsideMentions} />}
        jwtParaEnlaces={chat.encrypted ? undefined : props.jwt}
        onElegirArchivos={setArchivos}
        onNotaDeVoz={(nota) => void colaDeArchivosWeb.encolar(chat.id, nota.file, { durationMs: nota.ms, onda: nota.onda, hd: true })}
        mensajes={ventana.window ? windowOnScreen(ventana.window, hilos.visibles ?? []) : hilos.visibles}
        hayAnteriores={ventana.window ? ventana.window.hasOlder : props.hayAnteriores}
        onCargarAnteriores={ventana.window ? () => void ventana.loadOlder() : props.onCargarAnteriores}
        ventana={ventana.window ? { hasNewer: ventana.window.hasNewer, onCargarSiguientes: () => void ventana.loadNewer(), onIrAlUltimo: closeWindow } : undefined}
        viewId={ventana.viewId}
        onReintentar={(clave) => (colaDeArchivosWeb.tiene(clave) ? void colaDeArchivosWeb.reintentar(clave) : props.onReintentar(clave))}
        onDescartar={(clave) => (colaDeArchivosWeb.tiene(clave) ? colaDeArchivosWeb.descartar(clave) : props.onDescartar(clave))}
        onSend={(texto, menciones) => {
          // Writing goes back to the end, like WhatsApp.
          closeWindow();
          void acciones.enviar(texto, menciones);
        }}
        franja={
          <FranjaDeFijados
            fijados={fijados}
            nombreDe={nombreDe}
            textoLocal={textoLocal}
            puedeDesfijar={puedeFijar}
            onIr={(seq) => setSalto({ seq, vez: Date.now() })}
            onDesfijar={(seq) => void fijar.desfijar(seq)}
            onVerTodos={() => setVerFijados(true)}
          />
        }
        queue={chat.kind === 'notas' ? null : <ChatQueue jwt={props.jwt} chatId={chat.id} onOpen={(seq) => setSalto({ seq, vez: Date.now() })} />}
        salto={salto}
        onIrA={(seq) => setSalto({ seq, vez: Date.now() })}
        onNoEsta={() => {
          if (!salto || chat.encrypted) return onAviso('Ese mensaje está más arriba: sube para cargarlo.');
          void ventana.jumpTo(salto.seq).then((outcome) => {
            if (outcome.status === 'thread') abrirHilo(outcome.root);
            else if (outcome.status === 'missing') onAviso('Ese mensaje ya no está en el chat.');
            else if (outcome.status === 'error') onAviso('No se pudo abrir ese mensaje. Revisa tu conexión.');
          });
        }}
        onAbrirInfo={() => {
          hilos.cerrar();
          setInfoAbierta(true);
        }}
      />
      {hilos.raiz ? (
        <PanelBoundary label="el hilo" onClose={hilos.cerrar}>
        <PanelDeHilo
          chat={chat}
          raiz={hilos.raiz}
          respuestas={hilos.respuestas}
          yo={yo}
          nombres={nombres}
          photos={photos}
          mencionables={mencionables}
          onOutsideMentions={outsideMentions.notify}
          avisoDeMencion={<OutsideMentionNotice outside={outsideMentions} />}
          onEnviar={(texto, enElChat, menciones) => void sync.enviarTexto(chat.id, texto, { hiloDe: hilos.raiz!.seq, ...(enElChat ? { enElChat: true } : {}), ...(menciones?.length ? { menciones } : {}) })}
          onReintentar={props.onReintentar}
          onDescartar={props.onDescartar}
          onEdit={(seq, text) => sync.editar(chat.id, seq, text)}
          stickers={chat.encrypted ? undefined : { jwt: props.jwt, me: yo, chatId: chat.id, chatName: chat.name ?? chat.phone ?? '' }}
          onCerrar={hilos.cerrar}
        />
        </PanelBoundary>
      ) : null}
      {infoAbierta ? (
        <PanelBoundary label="la información del chat" onClose={() => setInfoAbierta(false)}>
        <PanelDeInfo
          chat={chat}
          detalle={detalle}
          yo={yo}
          jwt={props.jwt}
          base={props.base}
          onCerrar={() => setInfoAbierta(false)}
          onAviso={onAviso}
          onCambio={() => {
            setVersionDelDetalle((anterior) => anterior + 1);
            props.onRecargarChats();
          }}
          onAccionDeChat={props.onAccionDeChat}
          onLevel={props.onLevel}
          onVerFoto={openPhoto}
          onViewPerson={showPerson}
          tarjetas={<>{chat.encrypted ? null : <ChecklistsCard chatId={chat.id} jwt={props.jwt} onOpen={(seq) => setSalto({ seq, vez: Date.now() })} />}<TarjetaDeFijados fijados={fijados} nombreDe={nombreDe} textoLocal={textoLocal} onVerTodos={() => setVerFijados(true)} />{chat.encrypted ? null : <TarjetaDeDestacados chatId={chat.id} jwt={props.jwt} yo={yo} cuantos={destacados.seqs.size} onIr={(seq) => setSalto({ seq, vez: Date.now() })} />}</>}
        />
        </PanelBoundary>
      ) : null}
      {verFijados ? (
        <ListaDeFijados fijados={fijados} nombreDe={nombreDe} textoLocal={textoLocal} puedeDesfijar={puedeFijar} onIr={(seq) => setSalto({ seq, vez: Date.now() })} onDesfijar={(seq) => void fijar.desfijar(seq)} onCerrar={() => setVerFijados(false)} />
      ) : null}
      {fijar.pidiendo !== null ? <DialogoFijar onFijar={(duracion) => void fijar.fijar(duracion)} onCerrar={fijar.cancelar} /> : null}
      {acciones.eliminando ? (
        <DialogoEliminar
          mensaje={acciones.eliminando}
          yo={yo}
          onParaTodos={() => sync.eliminarParaTodos(chat.id, acciones.eliminando!.seq)}
          onParaMi={() => sync.eliminarParaMi(chat.id, acciones.eliminando!.seq)}
          onCerrar={acciones.cerrarEliminar}
          onAviso={onAviso}
        />
      ) : null}
      {acciones.reenviando ? (
        <DialogoReenviar
          chats={props.chats}
          onAviso={onAviso}
          onCerrar={acciones.cerrarReenviar}
          onReenviar={(destinos, mensaje) => {
            const original = acciones.reenviando!;
            acciones.cerrarReenviar();
            void reenviarA({ jwt: props.jwt, destinos, original, mensaje, sync }).then((motivo) => {
              onAviso(motivo ?? (destinos.length === 1 ? 'Reenviado' : `Reenviado a ${destinos.length} chats`));
              // Un «Tú» recién creado tiene que aparecer en la lista.
              if (destinos.includes(TU_NUEVO)) props.onRecargarChats();
            });
          }}
        />
      ) : null}
      {archivos ? <EnviarArchivos archivos={archivos} onCerrar={() => setArchivos(null)} onEnviar={subir} /> : null}
      {fotoAbierta !== null ? <PhotoViewer fotos={viewerPhotos} indice={fotoAbierta} onCambiar={setFotoAbierta} onCerrar={() => setFotoAbierta(null)} onMakeSticker={chat.encrypted ? undefined : (foto) => void saveGif({ chatId: chat.id, seq: foto.seq }).then(onAviso)} /> : null}
      {personCard.element}
      {pdfAbierto?.media?.url ? <PdfViewer jwt={props.jwt} chatId={chat.id} seq={pdfAbierto.seq} fileName={pdfAbierto.media.fileName ?? 'Documento PDF'} downloadUrl={pdfAbierto.media.url} onClose={() => setPdfAbierto(null)} /> : null}
      {chat.encrypted ? null : <BirthdayCardWeb chatId={chat.id} chatName={chat.name ?? ''} isGroup={chat.kind === 'group'} me={yo} messages={mensajes ?? []} names={nombres} photos={photos} onReact={(emoji) => void sync.enviarTexto(chat.id, emoji)} onGreet={insertIntoComposer} />}
      {acciones.viendoInfo ? <DialogoInfo chatId={chat.id} mensaje={acciones.viendoInfo} jwt={props.jwt} onCerrar={acciones.cerrarInfo} /> : null}
    </ConversacionContext.Provider>
  );
}

/**
 * Los mensajes del chat con los archivos que todavía suben (auditoría 19/10):
 * lo pendiente va al final en el orden en que se mandó, y lo que ya llegó
 * confirmado (por el socket o por la respuesta) no sale dos veces.
 */
function useConArchivosPendientes(mensajes: MensajeEnPantalla[] | null, chatId: string, yo: string, jwt: string, base: BaseLocal | null): MensajeEnPantalla[] | null {
  const pendientes = usePendientesDeArchivos(colaDeArchivosWeb, chatId);
  const gifsOnTheirWay = useGifsInFlight(chatId);
  useEffect(() => {
    usarJwtParaSubir(jwt);
  }, [jwt]);
  useEffect(() => {
    colaDeArchivosWeb.configurar({ alConfirmar: (mensaje) => base && void aplicarEntrante(base, mensaje) });
  }, [base]);
  return useMemo(() => {
    if (!mensajes || (pendientes.length === 0 && gifsOnTheirWay.length === 0)) return mensajes;
    const confirmadas = new Set(mensajes.map((uno) => uno.clientKey));
    const enCola = [...pendientes.map((uno) => comoMensaje(uno, yo)), ...gifsOnTheirWay.map((one) => gifAsPendingMessage(one, yo))].filter((uno) => !confirmadas.has(uno.clientKey));
    const listos = mensajes.filter((uno) => !uno.estado);
    const enviando = [...mensajes.filter((uno) => uno.estado), ...enCola].sort((a, b) => a.at.localeCompare(b.at));
    return [...listos, ...enviando];
  }, [mensajes, pendientes, gifsOnTheirWay, yo]);
}

/** Reenvía una foto o un archivo a cada chat; devuelve el motivo del primer rechazo. */
/**
 * Reenviar a cada destino (20/10): el «Tú» que no existe se crea primero; una
 * foto o un archivo va por referencia (el server copia el archivo y su pie);
 * el texto, por la cola. Después, el mensaje que se agregó. Devuelve el motivo
 * si algo falló.
 */
async function reenviarA(params: { jwt: string; destinos: string[]; original: MensajeEnPantalla; mensaje: string; sync: AccionesDeSync }): Promise<string | null> {
  for (const destino of params.destinos) {
    let chatId = destino;
    if (destino === TU_NUEVO) {
      const creado = await api<{ chatId: string }>('/chats', { jwt: params.jwt, body: { kind: 'yo' } });
      if (!creado.ok) return creado.message;
      chatId = creado.data.chatId;
    }
    if (params.original.media) {
      const respuesta = await api(`/chats/${chatId}/reenviar`, { jwt: params.jwt, body: { desde: params.original.chatId, seq: params.original.seq, clientKey: crypto.randomUUID() } });
      if (!respuesta.ok) return respuesta.message;
    } else await params.sync.enviarTexto(chatId, params.original.body ?? '');
    if (params.mensaje) await params.sync.enviarTexto(chatId, params.mensaje);
  }
  return null;
}
