import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * El socket vive FUERA del componente.
 *
 * React monta, desmonta y vuelve a montar durante el arranque; si cada montaje
 * abriera y cerrara su propio socket, cada carga dejaría un handshake a medio
 * hacer —y el «closed before the connection is established» en la consola—.
 * Acá se reutiliza mientras sea la misma sesión.
 */
let socketVivo: Socket | null = null;
let duenos = 0;

type OpcionesDeSocket = Parameters<typeof io>[1];

function obtenerSocket(opciones: OpcionesDeSocket): Socket {
  duenos += 1;
  if (!socketVivo) socketVivo = io(opciones);
  return socketVivo;
}

/**
 * Se suelta, no se cierra: solo cuando NADIE lo usa se apaga de verdad. Y se
 * hace en el siguiente tick, porque un remonte inmediato de React volvería a
 * pedirlo — cerrarlo en el medio es justo el problema que esto resuelve.
 */
function soltarSocket(): void {
  duenos -= 1;
  setTimeout(() => {
    if (duenos <= 0 && socketVivo) {
      socketVivo.close();
      socketVivo = null;
      duenos = 0;
    }
  }, 0);
}
import type { ChatMessage } from './chat/types';

/**
 * El socket de la web, con el MISMO contrato que la app (F2/F4): JWT en el
 * handshake, sala por usuario, `msg.new`, `presence.*` y `receipt`.
 *
 * Un solo socket para toda la sesión, en una ref: si viviera en el estado, cada
 * render abriría uno nuevo y el server vería una avalancha de conexiones del
 * mismo usuario — que además rompe el conteo de presencia.
 */
export type SocketState = {
  connected: boolean;
  online: Set<string>;
  typingByChat: Map<string, string>;
};

export function useSocket(params: {
  jwt: string | null;
  /** Quién soy. El socket se abre por SESIÓN, no por token. */
  userId: string | null;
  onMessage: (message: ChatMessage) => void;
  onReceipt: (data: { chatId: string; userId: string; readSeq: number }) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const handlers = useRef(params);
  handlers.current = params;

  /**
   * El token, en una ref.
   *
   * El socket se abre UNA vez por sesión y lee el token al conectar. Antes el
   * efecto dependía del `jwt`, y como al arrancar se renueva la sesión, cada
   * carga abría un socket, lo tiraba y abría otro — dos handshakes por visita y
   * un «WebSocket connection failed» en la consola cada vez.
   *
   * Cambiar el token NO obliga a reconectar: la conexión ya autenticada sigue
   * siéndolo. El token nuevo se usará en el próximo handshake, si lo hay.
   */
  const jwtRef = useRef(params.jwt);
  jwtRef.current = params.jwt;

  const hayToken = Boolean(params.jwt);

  const [state, setState] = useState<SocketState>({
    connected: false,
    online: new Set(),
    typingByChat: new Map(),
  });

  useEffect(() => {
    if (!jwtRef.current) return;

    const socket = obtenerSocket({
      // Función y no valor: socket.io la vuelve a llamar en cada reintento, así
      // que un token renovado entra solo en la reconexión.
      auth: (cb: (datos: Record<string, unknown>) => void) => cb({ token: jwtRef.current }),
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setState((prev) => ({ ...prev, connected: true })));
    socket.on('disconnect', () => setState((prev) => ({ ...prev, connected: false })));

    socket.on('msg.new', (message: ChatMessage) => handlers.current.onMessage(message));
    socket.on('receipt', (data: { chatId: string; userId: string; readSeq: number }) =>
      handlers.current.onReceipt(data)
    );

    // El snapshot llega al conectar y trae a TODOS los que ya están en línea.
    // Sin él, los puntos verdes solo aparecerían para quien se conecte después
    // que yo (la lección de F4).
    //
    // Viene como `{online: [...]}` y NO como un array pelado. Escribir el
    // contrato de memoria costó una pantalla en blanco: `new Set(objeto)` tira
    // «object is not iterable» y se lleva puesta toda la app.
    socket.on('presence.snapshot', (data: { online?: string[] }) =>
      setState((prev) => ({ ...prev, online: new Set(data?.online ?? []) }))
    );

    // UN solo evento con un booleano, no dos eventos distintos.
    socket.on('presence', (data: { userId: string; online: boolean }) =>
      setState((prev) => {
        const online = new Set(prev.online);
        if (data.online) online.add(data.userId);
        else online.delete(data.userId);
        return { ...prev, online };
      })
    );

    socket.on('typing', (data: { chatId: string; userId: string; on: boolean }) => {
      setState((prev) => {
        const typingByChat = new Map(prev.typingByChat);
        if (data.on) typingByChat.set(data.chatId, data.userId);
        else typingByChat.delete(data.chatId);
        return { ...prev, typingByChat };
      });
      if (!data.on) return;
      // «Escribiendo» se APAGA solo. El evento de fin puede perderse —una
      // pestaña que se cierra no avisa— y el cartel quedaría encendido para
      // siempre, que se lee como la app colgada.
      setTimeout(() => {
        setState((prev) => {
          const typingByChat = new Map(prev.typingByChat);
          typingByChat.delete(data.chatId);
          return { ...prev, typingByChat };
        });
      }, 4000);
    });

    return () => {
      // **No se cierra acá.** Cerrar un socket que todavía está conectando hace
      // que Chrome registre «WebSocket is closed before the connection is
      // established», y con React montando y desmontando en el arranque eso
      // pasaba en cada carga. El socket vive fuera del efecto: se reutiliza si
      // el mismo usuario vuelve a montar, y solo se cierra al cambiar de sesión.
      soltarSocket();
      socketRef.current = null;
    };
    // Depende de QUIÉN, no del token: renovar la sesión no puede tirar el
    // socket. `hayToken` cubre el paso de deslogueado a logueado.
  }, [params.userId, hayToken]);

  return { ...state, socket: socketRef };
}
