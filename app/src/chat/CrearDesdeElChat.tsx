import type { Credential } from '../auth/credentialStore';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CreateReminderScreen } from '../agenda/CreateReminderScreen';
import type { AgendaReminder } from '../agenda/agendaApi';

/** Qué se abre: crear algo, o editar un recordatorio del grupo (19/10). */
export type QueSeCrea = 'event' | 'poll' | 'reminder' | { recordatorio: AgendaReminder } | null;

/**
 * Crear un evento o una encuesta desde la conversación (salió de
 * `ChatScreen`): el chat YA está elegido, así que no se vuelve a preguntar
 * dónde.
 */
export function CrearDesdeElChat(props: {
  creando: QueSeCrea;
  credential: Credential;
  chat: { id: string; name: string; kind: 'direct' | 'group' | 'notas' };
  onCerrar: () => void;
}) {
  if (props.creando === null) return null;
  if (typeof props.creando === 'object') {
    return <CreateReminderScreen visible credential={props.credential} grupo={props.chat} editando={props.creando.recordatorio} onClose={props.onCerrar} onCreated={props.onCerrar} />;
  }
  // El recordatorio del chat vive en ESTE chat y le suena a todos sus miembros (grupo 19/10; 1:1 y borrador 20/10).
  if (props.creando === 'reminder') {
    return <CreateReminderScreen visible credential={props.credential} grupo={props.chat} onClose={props.onCerrar} onCreated={props.onCerrar} />;
  }
  const Pantalla = props.creando === 'event' ? CreateEventScreen : CreatePollScreen;
  return (
    <Pantalla visible credential={props.credential} fixedChat={props.chat} onClose={props.onCerrar} onCreated={props.onCerrar} />
  );
}
