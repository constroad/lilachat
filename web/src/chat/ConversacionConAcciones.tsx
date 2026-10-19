import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { EnviarArchivos, medidasDeImagen } from './EnviarArchivos';
import { VisorDeFotos } from './VisorDeFotos';
import type { MensajeEnPantalla } from './types';
import { subirArchivo } from './mediaUpload';
import { Conversation } from './Conversation';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import { DialogoEliminar, DialogoInfo, DialogoReenviar } from './DialogosDelMensaje';
import { useAccionesSobreMensajes, type AccionesDeSync } from './useAccionesSobreMensajes';
import { useDetalleDelChat } from './useDetalleDelChat';
import type { ChatSummary } from './types';

type PropsDeConversacion = ComponentProps<typeof Conversation>;

/**
 * La conversación con todo lo que se hace sobre sus mensajes (W2): el menú de
 * cada burbuja, responder, editar, eliminar, reenviar e «Info», más los nombres
 * de los miembros para autores y menciones. Así `Shell` no crece.
 */
export function ConversacionConAcciones(
  props: Omit<PropsDeConversacion, 'contexto' | 'onCancelarContexto' | 'onSend' | 'mencionables' | 'jwtParaEnlaces' | 'onElegirArchivos' | 'onNotaDeVoz' | 'onEscribiendo'> & {
    jwt: string;
    sync: AccionesDeSync;
    chats: ChatSummary[];
    onAviso: (texto: string) => void;
  }
) {
  const { chat, mensajes, yo, sync, onAviso } = props;
  const detalle = useDetalleDelChat(chat.id, props.jwt);
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
  /** Uno por uno, con su forma; el server crea cada mensaje y llega por el socket. */
  const subir = async (lista: File[], pie: string) => {
    setArchivos(null);
    for (const [indice, archivo] of lista.entries()) {
      onAviso(lista.length > 1 ? `Subiendo ${indice + 1} de ${lista.length}…` : 'Subiendo…');
      const resultado = await subirArchivo({ jwt: props.jwt, chatId: chat.id, file: archivo, caption: indice === 0 ? pie : undefined, ...(await medidasDeImagen(archivo)) });
      if (!resultado.ok) return onAviso(resultado.message);
    }
    onAviso('');
  };
  const citado = useCallback((seq: number) => mensajes?.find((uno) => uno.seq === seq), [mensajes]);
  const contexto = useMemo<ContextoDeLaConversacion>(
    () => ({ yo, jwt: props.jwt, chat, detalle, nombres, citado, onAccion: acciones.onAccion, onVerFoto }),
    [yo, props.jwt, chat, detalle, nombres, citado, acciones.onAccion, onVerFoto]
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
        onNotaDeVoz={(nota) =>
          void subirArchivo({ jwt: props.jwt, chatId: chat.id, file: nota.file, durationMs: nota.ms, onda: nota.onda }).then((resultado) => {
            if (!resultado.ok) onAviso(resultado.message);
          })
        }
        onSend={(texto, menciones) => void acciones.enviar(texto, menciones)}
      />
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
            void sync.reenviar(chatIds, acciones.reenviando!.body ?? '');
            acciones.cerrarReenviar();
            onAviso(chatIds.length === 1 ? 'Reenviado' : `Reenviado a ${chatIds.length} chats`);
          }}
        />
      ) : null}
      {archivos ? <EnviarArchivos archivos={archivos} onCerrar={() => setArchivos(null)} onEnviar={(lista, pie) => void subir(lista, pie)} /> : null}
      {fotoAbierta !== null ? <VisorDeFotos fotos={fotos} indice={fotoAbierta} onCambiar={setFotoAbierta} onCerrar={() => setFotoAbierta(null)} /> : null}
      {acciones.viendoInfo ? <DialogoInfo chatId={chat.id} mensaje={acciones.viendoInfo} jwt={props.jwt} onCerrar={acciones.cerrarInfo} /> : null}
    </ConversacionContext.Provider>
  );
}
