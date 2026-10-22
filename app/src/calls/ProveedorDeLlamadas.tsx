import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { nombreDeContacto } from '@lilachat/shared';
import { chatsEnMemoria } from '../chat/chatsGuardados';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { CallScreen } from './CallScreen';
import { useCall, type AutorDeLlamada } from './useCall';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { BASE_URL } from '../api/client';

type Llamadas = {
  /** Llamar desde un chat: ese chat, con ese nombre, con o sin video. */
  llamar: (chatId: string, nombre: string, conVideo: boolean) => void;
};

const LlamadasContext = createContext<Llamadas>({ llamar: () => undefined });

/** Cuánto se ve «Llamada terminada» antes de cerrarse sola. */
const CIERRE_AL_TERMINAR_MS = 1_500;

export const useLlamadas = (): Llamadas => useContext(LlamadasContext);

/**
 * Las llamadas de la SESIÓN (FL8). Antes cada `ChatScreen` tenía su propia
 * llamada y solo escuchaba su chat: una llamada sonaba únicamente si el otro
 * tenía esa conversación abierta. Ahora se escucha desde que hay sesión, la
 * pantalla de llamada se muestra encima de lo que esté abierto, y el chat sale
 * de la oferta.
 */
export function ProveedorDeLlamadas({ jwt, children }: { jwt: string; children: ReactNode }) {
  // Del chat cargado; si todavía no está (se abrió desde el push, o el chat es
  // nuevo), de lo que la oferta trae de quien llama.
  const nombreDe = useCallback((chatId: string, autor?: AutorDeLlamada) => {
    const chat = chatsEnMemoria()?.find((uno) => uno.id === chatId);
    const delServidor = chat ? chat.name : autor?.nombre;
    const telefono = chat ? chat.phone : autor?.telefono;
    return nombreDeContacto({ delServidor, telefono, agenda: agendaPorTelefono() }) || 'Llamada';
  }, []);
  const llamada = useCall({ jwt, nombreDe });
  const { llamar: llamarConHook, cerrar, aplicarAviso } = llamada;

  // FL8.1: la notificación nativa de llamada. La URL del server queda guardada
  // para rechazar con la app cerrada; lo tocado antes de abrir (arranque en
  // frío) se lee una vez, y lo que se toque después llega por el evento.
  useEffect(() => {
    llamadaNativa.configurar(BASE_URL);
    const inicial = llamadaNativa.accionPendiente();
    if (inicial) aplicarAviso(inicial);
    const suscripcion = llamadaNativa.alTocar(aplicarAviso);
    return () => suscripcion.remove();
  }, [aplicarAviso]);

  // Una llamada que terminó SIN que se tocara colgar —perdida, o el otro
  // cortó— quedaba en «Llamada terminada» para siempre. Se cierra sola.
  const terminada = llamada.state?.fase === 'terminada';
  useEffect(() => {
    if (!terminada) return;
    const temporizador = setTimeout(cerrar, CIERRE_AL_TERMINAR_MS);
    return () => clearTimeout(temporizador);
  }, [terminada, cerrar]);
  const valor = useMemo<Llamadas>(
    () => ({ llamar: (chatId, nombre, conVideo) => void llamarConHook(chatId, nombre, conVideo) }),
    [llamarConHook]
  );

  return (
    <LlamadasContext.Provider value={valor}>
      {children}
      {llamada.state ? (
        <CallScreen
          visible
          state={llamada.state}
          medios={llamada.medios}
          peerName={llamada.peerName}
          peerPhoto={chatsEnMemoria()?.find((uno) => uno.id === llamada.chatId)?.avatarUrl}
          video={llamada.video}
          puedeAlternarVideo={llamada.conVideoDesdeElInicio}
          muted={llamada.muted}
          speaker={llamada.speaker}
          localStream={llamada.localStream}
          remoteStream={llamada.remoteStream}
          onToggleMute={llamada.alternarMute}
          onToggleSpeaker={llamada.alternarAltavoz}
          onToggleVideo={llamada.alternarVideo}
          onAccept={llamada.contestar}
          // Colgar pasa a «terminada» y el efecto de arriba la cierra: un
          // instante a la vista, porque desaparecer de golpe se siente como
          // que se cortó sola.
          onHangUp={llamada.colgar}
        />
      ) : null}
    </LlamadasContext.Provider>
  );
}
