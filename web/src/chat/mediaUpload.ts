import { validateMedia } from '@lilachat/shared';

/**
 * Subir una foto o un archivo desde la web.
 *
 * **La MISMA validación que corre el server** (`validateMedia`, compartida): si
 * el navegador aceptara algo que el server rechaza, la persona espera a que
 * suban 20 MB para que muera al llegar. Se corta antes de tocar la red.
 *
 * A diferencia de la app, acá `FormData` es el del navegador y `fetch` alcanza
 * — el rodeo con `XMLHttpRequest` de la app existe por el `fetch` de Expo, que
 * no acepta archivos.
 */
export type ResultadoSubida =
  | { ok: true }
  | { ok: false; message: string; reintentable: boolean };

export async function subirArchivo(params: {
  jwt: string;
  chatId: string;
  file: File;
  caption?: string;
}): Promise<ResultadoSubida> {
  const veredicto = validateMedia({ mimeType: params.file.type, sizeBytes: params.file.size });
  if (!veredicto.ok) return { ok: false, message: veredicto.reason, reintentable: false };

  const cuerpo = new FormData();
  cuerpo.append('chatId', params.chatId);
  // `clientKey` del cliente: si la respuesta se pierde y se reintenta, el server
  // reconoce el duplicado en vez de mandar la foto dos veces.
  cuerpo.append('clientKey', crypto.randomUUID());
  if (params.caption) cuerpo.append('caption', params.caption);
  cuerpo.append('file', params.file, params.file.name);

  try {
    const respuesta = await fetch('/api/media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.jwt}` },
      body: cuerpo,
    });

    if (respuesta.ok) return { ok: true };

    const datos = (await respuesta.json().catch(() => ({}))) as { message?: string };
    return {
      ok: false,
      message: datos.message ?? 'No se pudo subir el archivo.',
      // El 503 es «no pude preguntar» y el 502 «me dijeron que no»: solo el
      // primero vale la pena reintentar.
      reintentable: respuesta.status === 503,
    };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.', reintentable: true };
  }
}
