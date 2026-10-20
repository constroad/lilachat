import { useCallback, useEffect, useMemo, useState } from 'react';
import { fijadosVigentes, textoDelFijado, type DuracionDeFijado } from '@lilachat/shared';
import { desfijarMensajeEnChat, fijarMensajeEnChat, listChats, type FijadoEnLista } from '../api/client';
import { chatsEnMemoria } from './chatsGuardados';

import { FranjaDeFijados } from './FranjaDeFijados';
import { HojaDeFijarMensaje } from './HojaDeFijarMensaje';
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
  puedeFijar: boolean;
  /** El texto descifrado de un mensaje propio del teléfono (chats secretos). */
  textoLocal: (seq: number) => string | undefined;
  onIr: (seq: number) => void;
  onError: (texto: string) => void;
}) {
  const { chatId, jwt, onError } = params;
  const [fijados, setFijados] = useState<FijadoEnLista[]>(() => fijadosDe(chatsEnMemoria(), chatId));
  const [pidiendo, setPidiendo] = useState<number | null>(null);

  const recargar = useCallback(async () => {
    const respuesta = await listChats(jwt);
    if (respuesta.ok) setFijados(fijadosDe(respuesta.data.chats, chatId));
  }, [jwt, chatId]);

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
  const franja = (
    <FranjaDeFijados
      fijados={fijados}
      textoDe={(fijado) => textoDelFijado(fijado.vista, params.textoLocal(fijado.seq))}
      puedeDesfijar={params.puedeFijar}
      onIr={params.onIr}
      onDesfijar={(seq) => void desfijar(seq)}
    />
  );
  const hoja = (
    <HojaDeFijarMensaje visible={pidiendo !== null} onCerrar={() => setPidiendo(null)} onFijar={(duracion) => pidiendo !== null && void fijar(pidiendo, duracion)} />
  );
  return { seqsFijados, pedirFijar: setPidiendo, desfijar, franja, hoja };
}
