import { validateMedia } from '@lilachat/shared';
import type { DatosDeSubida, ResultadoDeSubida } from './colaDeArchivos';
import type { ChatMessage } from './types';

/**
 * Subir una foto o un archivo desde la web.
 *
 * **La MISMA validación que corre el server** (`validateMedia`, compartida): si
 * el navegador aceptara algo que el server rechaza, la persona espera a que
 * suban 20 MB para que muera al llegar. Se corta antes de tocar la red.
 *
 * Por `XMLHttpRequest` y no `fetch` (auditoría 19/10): es lo único del
 * navegador que avisa el progreso de una SUBIDA, y la burbuja dibuja su anillo
 * con eso. La clave viene de la cola: una por archivo, así un reintento no
 * duplica el mensaje. El server responde con el mensaje confirmado.
 */
export function subirArchivo(datos: DatosDeSubida & { jwt: string; mime: string }): Promise<ResultadoDeSubida> {
  const veredicto = validateMedia({ mimeType: datos.mime, sizeBytes: datos.archivo.size });
  if (!veredicto.ok) return Promise.resolve({ ok: false, message: veredicto.reason, reintentable: false });
  return new Promise((resolver) => {
    const pedido = new XMLHttpRequest();
    pedido.open('POST', '/api/media');
    pedido.setRequestHeader('Authorization', `Bearer ${datos.jwt}`);
    pedido.upload.onprogress = (evento) => evento.lengthComputable && datos.onProgreso(evento.loaded / evento.total);
    pedido.onload = () => resolver(leerRespuesta(pedido.status, pedido.responseText));
    // Sin red NO se dice «rechazado»: son cosas distintas.
    pedido.onerror = () => resolver({ ok: false, message: 'Sin conexión. Revisa tu internet.', reintentable: true });
    pedido.send(cuerpoDe(datos));
  });
}

function cuerpoDe(datos: DatosDeSubida & { mime: string }): FormData {
  const cuerpo = new FormData();
  cuerpo.append('chatId', datos.chatId);
  cuerpo.append('clientKey', datos.clientKey);
  if (datos.caption) cuerpo.append('caption', datos.caption);
  if (datos.width && datos.height) {
    cuerpo.append('width', String(datos.width));
    cuerpo.append('height', String(datos.height));
  }
  if (datos.durationMs) cuerpo.append('durationMs', String(datos.durationMs));
  // Separada por comas: es lo que lee el server (`ondaValida`), igual que la app.
  if (datos.onda?.length) cuerpo.append('onda', datos.onda.join(','));
  cuerpo.append('file', new File([datos.archivo], datos.nombre, { type: datos.mime }));
  return cuerpo;
}

/** El 503 es «no pude preguntar» y el 502 «me dijeron que no»: solo el primero se reintenta. */
export function leerRespuesta(status: number, texto: string): ResultadoDeSubida {
  let datos: Record<string, unknown> = {};
  try {
    datos = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    // Una respuesta sin JSON se trata por su status.
  }
  if (status >= 200 && status < 300) {
    const mensaje = datos.message as ChatMessage | undefined;
    return { ok: true, mensaje: mensaje && typeof mensaje === 'object' && typeof mensaje.seq === 'number' ? mensaje : undefined };
  }
  return { ok: false, message: typeof datos.message === 'string' ? datos.message : 'No se pudo subir el archivo.', reintentable: status === 503 || status === 0 };
}
