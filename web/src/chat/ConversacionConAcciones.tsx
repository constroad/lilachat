import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { PanelDeInfo } from './info/PanelDeInfo';
import type { AccionDelChat } from './menuDelChat';
import { fijadosVigentes, puedeFijarEnElChat } from '@lilachat/shared';
import { DialogoFijar } from './DialogoFijar';
import { FranjaDeFijados } from './FranjaDeFijados';
import { useFijarEnLaWeb } from './useFijarEnLaWeb';
import type { AccionSobreMensaje } from './contextoDeLaConversacion';
import { EnviarArchivos } from './EnviarArchivos';
import { VisorDeFotos } from './VisorDeFotos';
import type { MensajeEnPantalla } from './types';
import { comoMensaje, usePendientesDeArchivos } from './colaDeArchivos';
import { colaDeArchivosWeb, usarJwtParaSubir } from './colaDeArchivosWeb';
import { aplicarEntrante } from '../local/mensajesLocales';
import { api } from '../api';
import { Conversation } from './Conversation';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import { DialogoEliminar, DialogoInfo, DialogoReenviar } from './DialogosDelMensaje';
import { useAccionesSobreMensajes, type AccionesDeSync } from './useAccionesSobreMensajes';
import { useDetalleDelChat } from './useDetalleDelChat';
import type { ChatSummary } from './types';
import type { BaseLocal } from '../local/baseLocal';

type PropsDeConversacion = ComponentProps<typeof Conversation>;

/**
 * La conversación con todo lo que se hace sobre sus mensajes (W2): el menú de
 * cada burbuja, responder, editar, eliminar, reenviar e «Info», más los nombres
 * de los miembros para autores y menciones. Así `Shell` no crece.
 */
export function ConversacionConAcciones(
  props: Omit<PropsDeConversacion, 'contexto' | 'onCancelarContexto' | 'onSend' | 'mencionables' | 'jwtParaEnlaces' | 'onElegirArchivos' | 'onNotaDeVoz' | 'onEscribiendo' | 'franja' | 'salto' | 'onNoEsta'> & {
    jwt: string;
    base: BaseLocal | null;
    sync: AccionesDeSync;
    chats: ChatSummary[];
    onAviso: (texto: string) => void;
    /** Los fijados viajan con la lista: tras fijar o desfijar se relee. */
    onRecargarChats: () => void;
    /** Silenciar, salir o eliminar desde «Info.» (W3b): las mismas acciones de la lista. */
    onAccionDeChat: (chat: ChatSummary, accion: AccionDelChat) => void;
  }
) {
  const { chat, yo, sync, onAviso } = props;
  const mensajes = useConArchivosPendientes(props.mensajes, chat.id, yo, props.jwt, props.base);
  // El detalle se relee si cambian los miembros, el nombre o la foto (llega con la
  // lista), o tras editar algo desde «Info.» (W3b).
  const [versionDelDetalle, setVersionDelDetalle] = useState(0);
  const detalle = useDetalleDelChat(chat.id, props.jwt, props.base, `${versionDelDetalle}|${chat.memberIds.join(',')}|${chat.name ?? ''}|${chat.avatarUrl ?? ''}`);
  const [infoAbierta, setInfoAbierta] = useState(false);
  useEffect(() => setInfoAbierta(false), [chat.id]);
  const nombres = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const miembro of detalle?.miembros.values() ?? []) mapa.set(miembro.id, miembro.nombre);
    if (!mapa.has(yo)) mapa.set(yo, 'Tú');
    return mapa;
  }, [detalle, yo]);
  const acciones = useAccionesSobreMensajes({ chatId: chat.id, sync, nombres, onAviso });
  // Solo en grupos se menciona; a uno mismo, no.
  const mencionables = useMemo(
    () => (chat.kind === 'group' && detalle ? [...detalle.miembros.values()].filter((uno) => !uno.esYo).map(({ id, nombre, foto }) => ({ id, nombre, foto })) : undefined),
    [chat.kind, detalle]
  );
  const [archivos, setArchivos] = useState<File[] | null>(null);
  const [fotoAbierta, setFotoAbierta] = useState<number | null>(null);
  const fotos = useMemo(() => (mensajes ?? []).filter((uno) => !uno.deletedAt && uno.media?.url && (uno.media.mime?.startsWith('image/') || uno.media.thumbUrl)), [mensajes]);
  const onVerFoto = useCallback((mensaje: MensajeEnPantalla) => setFotoAbierta(Math.max(0, fotos.findIndex((uno) => uno.clientKey === mensaje.clientKey))), [fotos]);
  /** A la cola (auditoría 19/10): cada burbuja aparece ya y sube por detrás; el pie va en el primero. */
  const subir = (lista: File[], pie: string, hd: boolean) => {
    setArchivos(null);
    lista.forEach((archivo, indice) => void colaDeArchivosWeb.encolar(chat.id, archivo, { caption: indice === 0 && pie ? pie : undefined, hd }));
  };
  const citado = useCallback((seq: number) => mensajes?.find((uno) => uno.seq === seq), [mensajes]);
  // Fijar mensajes (19/10): en un grupo, solo los admins.
  const puedeFijar = puedeFijarEnElChat({ kind: chat.kind, esAdmin: detalle?.soyAdmin ?? false });
  const fijados = useMemo(() => fijadosVigentes(chat.fijados, Date.now()), [chat.fijados]);
  const seqsFijados = useMemo(() => new Set(fijados.map((uno) => uno.seq)), [fijados]);
  const fijar = useFijarEnLaWeb({ chatId: chat.id, jwt: props.jwt, onAviso, onCambio: props.onRecargarChats });
  const [salto, setSalto] = useState<{ seq: number; vez: number } | null>(null);
  const onAccion = useCallback(
    (mensaje: MensajeEnPantalla, accion: AccionSobreMensaje) => {
      if (accion === 'fijar') return fijar.pedir(mensaje.seq);
      if (accion === 'desfijar') return void fijar.desfijar(mensaje.seq);
      acciones.onAccion(mensaje, accion);
    },
    [fijar, acciones]
  );
  const contexto = useMemo<ContextoDeLaConversacion>(
    () => ({ yo, jwt: props.jwt, chat, detalle, nombres, citado, onAccion, onVerFoto, puedeFijar, fijados: seqsFijados }),
    [yo, props.jwt, chat, detalle, nombres, citado, onAccion, onVerFoto, puedeFijar, seqsFijados]
  );

  return (
    <ConversacionContext.Provider value={contexto}>
      <Conversation
        {...props}
        // En un grupo, quién escribe (el socket trae su id).
        typingName={props.typingName ? nombres.get(props.typingName) ?? 'Alguien' : null}
        onEscribiendo={() => sync.avisarEscribiendo(chat.id)}
        contexto={acciones.contexto}
        onCancelarContexto={acciones.cancelarContexto}
        mencionables={mencionables}
        jwtParaEnlaces={chat.encrypted ? undefined : props.jwt}
        onElegirArchivos={setArchivos}
        onNotaDeVoz={(nota) => void colaDeArchivosWeb.encolar(chat.id, nota.file, { durationMs: nota.ms, onda: nota.onda, hd: true })}
        mensajes={mensajes}
        onReintentar={(clave) => (colaDeArchivosWeb.tiene(clave) ? void colaDeArchivosWeb.reintentar(clave) : props.onReintentar(clave))}
        onDescartar={(clave) => (colaDeArchivosWeb.tiene(clave) ? colaDeArchivosWeb.descartar(clave) : props.onDescartar(clave))}
        onSend={(texto, menciones) => void acciones.enviar(texto, menciones)}
        franja={
          <FranjaDeFijados
            fijados={fijados}
            nombreDe={(id) => (id === yo ? 'Tú' : nombres.get(id) ?? 'Alguien')}
            textoLocal={(seq) => citado(seq)?.body}
            puedeDesfijar={puedeFijar}
            onIr={(seq) => setSalto({ seq, vez: Date.now() })}
            onDesfijar={(seq) => void fijar.desfijar(seq)}
          />
        }
        salto={salto}
        onNoEsta={() => onAviso('Ese mensaje está más arriba: sube para cargarlo.')}
        onAbrirInfo={() => setInfoAbierta(true)}
      />
      {infoAbierta ? (
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
          onVerFoto={onVerFoto}
        />
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
          mensaje={acciones.reenviando}
          chats={props.chats}
          onCerrar={acciones.cerrarReenviar}
          onReenviar={(chatIds) => {
            const original = acciones.reenviando!;
            // Una foto o un archivo, por referencia: el server copia el archivo y su pie (auditoría 19/10).
            if (original.media) void reenviarPorReferencia(props.jwt, chatIds, original).then((motivo) => motivo && onAviso(motivo));
            else void sync.reenviar(chatIds, original.body ?? '');
            acciones.cerrarReenviar();
            onAviso(chatIds.length === 1 ? 'Reenviado' : `Reenviado a ${chatIds.length} chats`);
          }}
        />
      ) : null}
      {archivos ? <EnviarArchivos archivos={archivos} onCerrar={() => setArchivos(null)} onEnviar={subir} /> : null}
      {fotoAbierta !== null ? <VisorDeFotos fotos={fotos} indice={fotoAbierta} onCambiar={setFotoAbierta} onCerrar={() => setFotoAbierta(null)} /> : null}
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
  useEffect(() => usarJwtParaSubir(jwt), [jwt]);
  useEffect(() => {
    colaDeArchivosWeb.configurar({ alConfirmar: (mensaje) => base && void aplicarEntrante(base, mensaje) });
  }, [base]);
  return useMemo(() => {
    if (!mensajes || pendientes.length === 0) return mensajes;
    const confirmadas = new Set(mensajes.map((uno) => uno.clientKey));
    const enCola = pendientes.filter((uno) => !confirmadas.has(uno.clientKey)).map((uno) => comoMensaje(uno, yo));
    const listos = mensajes.filter((uno) => !uno.estado);
    const enviando = [...mensajes.filter((uno) => uno.estado), ...enCola].sort((a, b) => a.at.localeCompare(b.at));
    return [...listos, ...enviando];
  }, [mensajes, pendientes, yo]);
}

/** Reenvía una foto o un archivo a cada chat; devuelve el motivo del primer rechazo. */
async function reenviarPorReferencia(jwt: string, chatIds: string[], original: MensajeEnPantalla): Promise<string | null> {
  for (const chatId of chatIds) {
    const respuesta = await api(`/chats/${chatId}/reenviar`, { jwt, body: { desde: original.chatId, seq: original.seq, clientKey: crypto.randomUUID() } });
    if (!respuesta.ok) return respuesta.message;
  }
  return null;
}

