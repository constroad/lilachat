import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '../api';
import { crearUltimaGana } from './ultimaGana';
import type { BaseLocal } from '../local/baseLocal';
import { descartarEnvio, drenarCola, encolarEnvio, reintentarEnvio } from '../local/colaDeEnvio';
import { aplicarBorrado, aplicarEdicion, aplicarEntrante, aplicarReacciones, aplicarResumenDeHilo, guardarChats, guardarPagina } from '../local/mensajesLocales';
import type { ChatMessage, ChatSummary } from '../chat/types';
import { accionPorSocket, enviarPorSocket, pedirSincronizacion, type ResultadoDeAccion } from './envioPorSocket';
import { ocultar } from '../local/ocultos';
import { aplicarAcuseALista, aplicarBorradoALista, aplicarEdicionALista, aplicarMensajeALista, aplicarReaccion, debeAvisarEscribiendo, type AcuseEnVivo, type CursoresEnVivo, type MencionEnMensaje, type Reaccion } from '@lilachat/shared';
import { cambiarFila } from '../local/listaLocal';
import { sincronizar } from './sincronizar';
import { anotarEnvio } from '../chat/reenviar/frecuenciasDeEnvio';

/** Una página del historial: lo que entra en pantalla y algo más. */
export const TAMANO_DE_PAGINA = 50;
/** Varios eventos seguidos (acuses, mensajes) piden la lista UNA vez. */
const ESPERA_PARA_RECARGAR_MS = 300;

type Params = {
  base: BaseLocal | null;
  yo: string;
  jwt: string;
  socket: MutableRefObject<Socket | null>;
  conectado: boolean;
  manejar401: () => Promise<string | null>;
  /** El chat abierto: lo que llega ahí, con la pestaña a la vista, ya se lee. */
  chatAbierto?: string | null;
};

/**
 * El puente entre la red y la base local (W1). La pantalla nunca espera a la
 * red: lee la base, y esto la mantiene al día.
 * - Al conectar: ponerse al día por cursor, mandar la cola y pedir la lista.
 * - Los eventos del socket escriben en la base.
 * - Enviar = encolar y drenar; sin red queda en la cola (IndexedDB) y sale al
 *   volver la red, el socket o la pestaña.
 */
export function useSincronizacion({ base, yo, jwt, socket, conectado, manejar401, chatAbierto = null }: Params) {
  const cargas = useMemo(crearUltimaGana, []);
  const cargarChats = useCallback(async () => {
    if (!base || !jwt) return;
    const turno = cargas.empezar();
    const respuesta = await api<{ chats: ChatSummary[] }>('/chats', { jwt });
    // Una recarga que ya no es la última trae el estado de antes: no escribe.
    if (!respuesta.ok) {
      if (respuesta.status === 401) await manejar401();
      return;
    }
    if (cargas.vigente(turno)) await guardarChats(base, respuesta.data.chats);
  }, [base, jwt, manejar401, cargas]);

  const recargarPronto = useRecargaAgrupada(cargarChats);
  const drenar = useDrenado(base, yo, socket);

  useEffect(() => {
    void cargarChats();
  }, [cargarChats]);

  useEffect(() => {
    if (!conectado || !base) return;
    void (async () => {
      await sincronizar({ base, pedir: (cursores) => pedirSincronizacion(socket.current, cursores) });
      await drenar();
      await cargarChats();
    })();
  }, [conectado, base, socket, drenar, cargarChats]);

  const abiertoRef = useRef(chatAbierto);
  abiertoRef.current = chatAbierto;
  /** Lo que cada miembro acusó en vivo, por chat (el mínimo de un grupo lo necesita). */
  const cursores = useRef<CursoresEnVivo>(new Map());
  const eventos = useMemo(() => {
    // La fila cambia acá, con las reglas de shared (auditoría 19/10: antes cada
    // evento pedía la lista entera). Un chat que no está sí la pide.
    const enLaFila = (chatId: string, cambiar: Parameters<typeof cambiarFila>[2]) =>
      base && void cambiarFila(base, chatId, cambiar).then((estaba) => !estaba && recargarPronto());
    const visibleAbierto = () => (document.visibilityState === 'visible' ? abiertoRef.current : null);
    return {
      onMessage: (mensaje: ChatMessage) => {
        if (base) void aplicarEntrante(base, mensaje);
        enLaFila(mensaje.chatId, (chats) => aplicarMensajeALista(chats, mensaje, yo, visibleAbierto()));
      },
      onReceipt: (acuse: AcuseEnVivo & { chatId: string }) => enLaFila(acuse.chatId, (chats) => aplicarAcuseALista(chats, acuse, yo, cursores.current)),
      onBorrado: (dato: { chatId: string; seq: number }) => {
        const ahora = new Date().toISOString();
        if (base) void aplicarBorrado(base, { ...dato, deletedAt: ahora });
        enLaFila(dato.chatId, (chats) => aplicarBorradoALista(chats, dato, ahora));
      },
      onEditado: (dato: { chatId: string; seq: number; body: string; editedAt: string }) => {
        if (base) void aplicarEdicion(base, dato);
        enLaFila(dato.chatId, (chats) => aplicarEdicionALista(chats, dato));
      },
      onCambioDeChat: () => recargarPronto(),
      onHilo: (dato: { chatId: string; raiz: number; hilo: NonNullable<ChatMessage['hilo']> }) => base && void aplicarResumenDeHilo(base, dato),
      onReacciones: (dato: { chatId: string; seq: number; reacciones: Reaccion[] }) => base && void aplicarReacciones(base, dato),
    };
  }, [base, yo, recargarPronto]);

  const acciones = useAccionesDelChat({ base, jwt, yo, socket, drenar, cargarChats });
  const avisarEscribiendo = useAvisoDeEscribiendo(socket);
  return { eventos, cargarChats, invalidarCargas: cargas.invalidar, avisarEscribiendo, ...acciones };
}

/** Abrir, paginar, enviar, reintentar y descartar. */
function useAccionesDelChat(params: {
  base: BaseLocal | null;
  jwt: string;
  yo: string;
  socket: MutableRefObject<Socket | null>;
  drenar: () => Promise<void>;
  cargarChats: () => Promise<void>;
}) {
  const { base, jwt, yo, socket, drenar, cargarChats } = params;

  /** Una página del server, conciliada con la base. Devuelve si quedan más atrás. */
  const traerPagina = useCallback(
    async (chatId: string, antesDe?: number): Promise<{ hayMas: boolean; ultimo?: ChatMessage } | null> => {
      // Sin JWT (abrió sin red) no se pregunta: la pantalla sale de la base.
      if (!base || !jwt) return null;
      const query = `limit=${TAMANO_DE_PAGINA}${antesDe ? `&beforeSeq=${antesDe}` : ''}`;
      const respuesta = await api<{ messages: ChatMessage[]; lastSeq: number }>(`/chats/${chatId}/messages?${query}`, { jwt });
      if (!respuesta.ok) return null;
      await guardarPagina(base, chatId, respuesta.data.messages, antesDe ? undefined : respuesta.data.lastSeq);
      return { hayMas: respuesta.data.messages.length >= TAMANO_DE_PAGINA, ultimo: respuesta.data.messages.at(-1) };
    },
    [base, jwt]
  );

  /** Al abrir: la última página y el acuse de leído (por socket, el check azul sale al instante). */
  const abrirChat = useCallback(
    async (chatId: string) => {
      const pagina = await traerPagina(chatId);
      if (pagina?.ultimo) marcarLeido(socket.current, chatId, pagina.ultimo.seq);
      void cargarChats();
      return pagina;
    },
    [traerPagina, socket, cargarChats]
  );

  /** Enviar texto (con respuesta y menciones si las hay): a la cola, y que salga. */
  const enviarTexto = useCallback(
    async (chatId: string, body: string, extra: { replyToSeq?: number; menciones?: MencionEnMensaje[]; hiloDe?: number; enElChat?: boolean } = {}) => {
      if (!base) return;
      await encolarEnvio(base, { clientKey: crypto.randomUUID(), chatId, kind: 'text', body, ...extra, queuedAt: new Date().toISOString(), attempts: 0 });
      // Los «Chats frecuentes» al reenviar salen de acá (20/10).
      anotarEnvio(chatId);
      void drenar();
    },
    [base, drenar]
  );

  /** Reenviar un texto a varios chats: uno por chat, cada uno con su clave. */
  const reenviar = useCallback(
    async (chatIds: string[], body: string) => {
      if (!base) return;
      for (const chatId of chatIds) {
        await encolarEnvio(base, { clientKey: crypto.randomUUID(), chatId, kind: 'text', body, queuedAt: new Date().toISOString(), attempts: 0 });
      }
      void drenar();
    },
    [base, drenar]
  );

  /** Editar lo propio (15 min, lo decide el server): se ve al instante si acepta. */
  const editar = useCallback(
    async (chatId: string, seq: number, body: string): Promise<ResultadoDeAccion> => {
      const resultado = await accionPorSocket(socket.current, 'msg.edit', { chatId, seq, body });
      if (resultado.ok && base) await aplicarEdicion(base, { chatId, seq, body, editedAt: resultado.editedAt ?? new Date().toISOString() });
      return resultado;
    },
    [base, socket]
  );

  /** Reaccionar (20/10): se pinta al tocar y vuelve atrás si el server dice que no. */
  const reaccionar = useCallback(
    async (chatId: string, seq: number, emoji: string | null): Promise<ResultadoDeAccion> => {
      const antes = base ? (await base.mensajes.get([chatId, seq]))?.reacciones : undefined;
      if (base) await aplicarReacciones(base, { chatId, seq, reacciones: aplicarReaccion(antes, yo, emoji, new Date().toISOString()) });
      const resultado = await accionPorSocket(socket.current, 'msg.react', { chatId, seq, emoji });
      if (!resultado.ok && base) await aplicarReacciones(base, { chatId, seq, reacciones: antes ?? [] });
      return resultado;
    },
    [base, socket, yo]
  );

  const eliminarParaTodos = useCallback(
    async (chatId: string, seq: number): Promise<ResultadoDeAccion> => {
      const resultado = await accionPorSocket(socket.current, 'msg.delete', { chatId, seq });
      if (resultado.ok && base) await aplicarBorrado(base, { chatId, seq, deletedAt: new Date().toISOString() });
      return resultado;
    },
    [base, socket]
  );

  const eliminarParaMi = useCallback(async (chatId: string, seq: number) => {
    if (base) await ocultar(base, chatId, seq);
  }, [base]);

  const reintentar = useCallback(
    async (clientKey: string) => {
      if (!base) return;
      await reintentarEnvio(base, clientKey);
      void drenar();
    },
    [base, drenar]
  );

  const descartar = useCallback(async (clientKey: string) => {
    if (base) await descartarEnvio(base, clientKey);
  }, [base]);

  return {
    abrirChat,
    traerPagina,
    enviarTexto,
    reenviar,
    editar,
    reaccionar,
    eliminarParaTodos,
    eliminarParaMi,
    reintentar,
    descartar,
    marcarLeido: (chatId: string, seq: number) => marcarLeido(socket.current, chatId, seq),
  };
}

function marcarLeido(socket: Socket | null, chatId: string, seq: number): void {
  socket?.emit('read.set', { chatId, seq });
}

/** Sin teclas por esto, «escribiendo» se apaga solo (como la app). */
const APAGAR_ESCRIBIENDO_MS = 3000;

/**
 * Avisar que estoy escribiendo (W2), con la regla de la app: `on: true` una
 * sola vez y `on: false` 3 s después de la ÚLTIMA tecla. Sin eso, o no se
 * apaga nunca, o sale un evento por letra.
 */
function useAvisoDeEscribiendo(socket: MutableRefObject<Socket | null>): (chatId: string) => void {
  const encendidoEn = useRef<string | null>(null);
  /** Cuándo se mandó el último `on:true`: se renueva (`debeAvisarEscribiendo`, auditoría 19/10). */
  const ultimoAviso = useRef<number | null>(null);
  const apagar = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (apagar.current) clearTimeout(apagar.current);
  }, []);
  return useCallback(
    (chatId: string) => {
      if (encendidoEn.current !== chatId) {
        if (encendidoEn.current) socket.current?.emit('typing', { chatId: encendidoEn.current, on: false });
        encendidoEn.current = chatId;
        ultimoAviso.current = null;
      }
      const ahora = Date.now();
      if (debeAvisarEscribiendo({ ultimoAviso: ultimoAviso.current, ahora })) {
        ultimoAviso.current = ahora;
        socket.current?.emit('typing', { chatId, on: true });
      }
      if (apagar.current) clearTimeout(apagar.current);
      apagar.current = setTimeout(() => {
        encendidoEn.current = null;
        ultimoAviso.current = null;
        socket.current?.emit('typing', { chatId, on: false });
      }, APAGAR_ESCRIBIENDO_MS);
    },
    [socket]
  );
}

/** Una sola recarga por ráfaga de eventos. */
function useRecargaAgrupada(recargar: () => Promise<void>): () => void {
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);
  return useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => void recargar(), ESPERA_PARA_RECARGAR_MS);
  }, [recargar]);
}

/**
 * Drenar la cola, y volver a intentar solo: al volver la red o la pestaña, y
 * con el tiempo que diga el motor si quedó algo — nunca con la pestaña oculta.
 */
function useDrenado(base: BaseLocal | null, yo: string, socket: MutableRefObject<Socket | null>): () => Promise<void> {
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drenar = useCallback(async () => {
    if (!base || !yo) return;
    if (reintento.current) clearTimeout(reintento.current);
    const { reintentarEn } = await drenarCola({ base, yo, enviar: (item) => enviarPorSocket(socket.current, item) });
    if (reintentarEn && document.visibilityState === 'visible') {
      reintento.current = setTimeout(() => void drenar(), reintentarEn);
    }
  }, [base, yo, socket]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void drenar();
    };
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
      if (reintento.current) clearTimeout(reintento.current);
    };
  }, [drenar]);

  return drenar;
}
