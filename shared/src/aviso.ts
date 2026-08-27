/**
 * El aviso que asoma arriba cuando llega un mensaje.
 *
 * Decide qué se muestra y, sobre todo, **qué no**: la burbuja aparece en la
 * pantalla de bloqueo, donde la lee cualquiera que mire el teléfono.
 */
export type Aviso = { titulo: string; cuerpo: string };

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
