import type { Credential } from '../auth/credentialStore';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';

/**
 * Crear un evento o una encuesta desde la conversación (salió de
 * `ChatScreen`): el chat YA está elegido, así que no se vuelve a preguntar
 * dónde.
 */
export function CrearDesdeElChat(props: {
  creando: 'event' | 'poll' | null;
  credential: Credential;
  chat: { id: string; name: string };
  onCerrar: () => void;
}) {
  if (props.creando === null) return null;
  const Pantalla = props.creando === 'event' ? CreateEventScreen : CreatePollScreen;
  return (
    <Pantalla visible credential={props.credential} fixedChat={props.chat} onClose={props.onCerrar} onCreated={props.onCerrar} />
  );
}
