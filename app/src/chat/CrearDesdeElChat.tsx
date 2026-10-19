import type { Credential } from '../auth/credentialStore';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CreateReminderScreen } from '../agenda/CreateReminderScreen';

/**
 * Crear un evento o una encuesta desde la conversación (salió de
 * `ChatScreen`): el chat YA está elegido, así que no se vuelve a preguntar
 * dónde.
 */
export function CrearDesdeElChat(props: {
  creando: 'event' | 'poll' | 'reminder' | null;
  credential: Credential;
  chat: { id: string; name: string };
  onCerrar: () => void;
}) {
  if (props.creando === null) return null;
  // El recordatorio del grupo (19/10) vive en ESTE grupo y le suena a todos.
  if (props.creando === 'reminder') {
    return <CreateReminderScreen visible credential={props.credential} grupo={props.chat} onClose={props.onCerrar} onCreated={props.onCerrar} />;
  }
  const Pantalla = props.creando === 'event' ? CreateEventScreen : CreatePollScreen;
  return (
    <Pantalla visible credential={props.credential} fixedChat={props.chat} onClose={props.onCerrar} onCreated={props.onCerrar} />
  );
}
