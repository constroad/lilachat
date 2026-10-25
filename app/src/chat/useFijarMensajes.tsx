import { useCallback, useEffect, useMemo, useState } from 'react';
import { fijadosVigentes, textoDelFijado, type DuracionDeFijado } from '@lilachat/shared';
import { desfijarMensajeEnChat, fijarMensajeEnChat, type FijadoEnLista } from '../api/client';
import { chatsEnMemoria } from './chatsGuardados';
import { chatListFor } from './listaDelChat';

import { FranjaDeFijados } from './FranjaDeFijados';
import { HojaDeFijarMensaje } from './HojaDeFijarMensaje';
import { ListaDeFijados } from './fijados/ListaDeFijados';
import { getSocket } from './socketClient';

const fijadosDe = (chats: { id: string; fijados?: FijadoEnLista[] }[] | null, chatId: string): FijadoEnLista[] =>
  fijadosVigentes(chats?.find((chat) => chat.id === chatId)?.fijados, Date.now());

/**
 * Fijar mensajes en la conversación (19/10): los fijados vienen con la lista de
 * chats y se releen con `chat.changed` (los fijó otro, o vencieron). Devuelve la
 * franja y la hoja listas para dibujar; la pantalla del chat solo las ubica.
 */
export function useFijarMensajes(params: {
  chatId: string;
  jwt: string;
  /** A chat of a space is not in the personal list: its pinned messages come from its space's list (José, 25/10). */
  workspaceId?: string;
  puedeFijar: boolean;
  /** El texto descifrado de un mensaje propio del teléfono (chats secretos). */
  textoLocal: (seq: number) => string | undefined;
  /** Para la franja y la lista: «Ana · …», «Fijado por Tú». */
  nombreDe: (userId: string) => string;
  fotoDe: (userId: string) => string | undefined;
  onIr: (seq: number) => void;
  onError: (texto: string) => void;
}) {
  const { chatId, jwt, workspaceId, onError } = params;
  const [fijados, setFijados] = useState<FijadoEnLista[]>(() => fijadosDe(chatsEnMemoria(), chatId));
  const [pidiendo, setPidiendo] = useState<number | null>(null);
  const [verLista, setVerLista] = useState(false);

  const recargar = useCallback(async () => {
    const respuesta = await chatListFor(jwt, workspaceId);
    if (respuesta.ok) setFijados(fijadosDe(respuesta.data.chats, chatId));
  }, [jwt, chatId, workspaceId]);

  useEffect(() => {
    void recargar();
    const socket = getSocket();
    const alCambiar = (frame: { chatId?: string }) => {
      if (frame?.chatId === chatId) void recargar();
    };
    socket?.on('chat.changed', alCambiar);
    return () => {
      socket?.off('chat.changed', alCambiar);
    };
  }, [chatId, recargar]);

  const fijar = useCallback(
    async (seq: number, duracion: DuracionDeFijado) => {
      setPidiendo(null);
      const respuesta = await fijarMensajeEnChat(jwt, chatId, seq, duracion);
      if (!respuesta.ok) return onError(respuesta.message ?? 'No se pudo fijar el mensaje.');
      void recargar();
    },
    [jwt, chatId, onError, recargar]
  );

  const desfijar = useCallback(
    async (seq: number) => {
      const respuesta = await desfijarMensajeEnChat(jwt, chatId, seq);
      if (!respuesta.ok) return onError(respuesta.message ?? 'No se pudo desfijar.');
      void recargar();
    },
    [jwt, chatId, onError, recargar]
  );

  const seqsFijados = useMemo(() => new Set(fijados.map((uno) => uno.seq)), [fijados]);
  const textoDe = (fijado: FijadoEnLista) => textoDelFijado(fijado.vista, params.textoLocal(fijado.seq));
  const franja = (
    <FranjaDeFijados
      fijados={fijados}
      textoDe={textoDe}
      nombreDe={params.nombreDe}
      puedeDesfijar={params.puedeFijar}
      onIr={params.onIr}
      onDesfijar={(seq) => void desfijar(seq)}
      onVerTodos={() => setVerLista(true)}
    />
  );
  const hoja = (
    <>
      <HojaDeFijarMensaje visible={pidiendo !== null} onCerrar={() => setPidiendo(null)} onFijar={(duracion) => pidiendo !== null && void fijar(pidiendo, duracion)} />
      <ListaDeFijados
        visible={verLista}
        fijados={fijados}
        textoDe={textoDe}
        nombreDe={params.nombreDe}
        fotoDe={params.fotoDe}
        puedeDesfijar={params.puedeFijar}
        onIr={params.onIr}
        onDesfijar={(seq) => void desfijar(seq)}
        onCerrar={() => setVerLista(false)}
      />
    </>
  );
  return { fijados, textoDe, seqsFijados, pedirFijar: setPidiendo, desfijar, verTodos: () => setVerLista(true), franja, hoja };
}
