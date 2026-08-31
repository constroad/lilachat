/**
 * El aviso que asoma arriba cuando llega un mensaje.
 *
 * Decide qué se muestra y, sobre todo, **qué no**: la burbuja aparece en la
 * pantalla de bloqueo, donde la lee cualquiera que mire el teléfono.
 */
export type Aviso = { titulo: string; cuerpo: string };

/**
 * El id del canal de Android de los mensajes. Lo comparten la app (que crea el
 * canal y dispara el aviso local) y el server (que manda el push FCM a ESE
 * canal): si divergen, el push cae en un canal que no existe y Android lo
 * descarta sin decir nada.
 *
 * **Termina en `-v2` a propósito.** Un canal de Android es INMUTABLE una vez
 * creado: la `v1` nació sin sonido, y `setNotificationChannel` con sonido sobre
 * un id que ya existe NO cambia nada. La única forma de que suene en los
 * teléfonos que ya tienen la app es crear un id nuevo (con sonido) y borrar el
 * viejo. Al subir el sonido/vibración/importancia otra vez, subir también el
 * sufijo.
 */
export const CANAL_MENSAJES = 'mensajes-v2';

/** Dos líneas es lo que muestra Android antes de cortar. */
const MAX_CUERPO = 140;

const recortar = (texto: string): string =>
  texto.length <= MAX_CUERPO ? texto : `${texto.slice(0, MAX_CUERPO - 1).trimEnd()}…`;

export function armarAviso(params: {
  chatName: string;
  senderName: string | null;
  esGrupo: boolean;
  kind: 'text' | 'image' | 'video' | 'audio' | 'file';
  body: string;
  cifrado?: boolean;
}): Aviso {
  const titulo = params.chatName;

  // **Un chat secreto no muestra el texto.** Existe para que ni el server lo
  // lea; filtrarlo en la pantalla de bloqueo tiraría por la borda justo eso.
  if (params.cifrado) {
    return { titulo, cuerpo: 'Mensaje nuevo' };
  }

  const texto =
    params.kind === 'text'
      ? params.body
      : params.kind === 'image'
        ? '📷 Foto'
        : params.kind === 'video'
          ? '🎥 Video'
          : params.kind === 'audio'
            ? '🎤 Audio'
            : '📎 Archivo';

  // En un 1:1 el título YA es la persona: anteponer su nombre otra vez es ruido.
  const quien = params.esGrupo ? params.senderName?.trim() : '';

  return { titulo, cuerpo: recortar(quien ? `${quien}: ${texto}` : texto) };
}
