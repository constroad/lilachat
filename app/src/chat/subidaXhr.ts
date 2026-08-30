/**
 * Subir un archivo por `XMLHttpRequest`. La plomería, sin saber qué se sube.
 *
 * **Se usa XHR y no `fetch` a propósito.** Expo SDK 57 reemplazó el `fetch`
 * global por su implementación «winter», cuyo `FormData` solo acepta strings o
 * Blobs: el `{uri, name, type}` clásico de React Native muere con «Unsupported
 * FormDataPart implementation». La alternativa —leer el archivo a un Blob—
 * cargaría el archivo entero en memoria JS, que además es lo que corrompe
 * archivos grandes en Expo. XHR sigue subiendo desde DISCO de forma nativa, y
 * de paso da progreso.
 *
 * Esto vive acá y no copiado en cada llamador porque ya pasó: la lección estaba
 * escrita en `mediaUpload.ts` desde el E2E de F3 y aun así la foto del grupo se
 * escribió con `fetch` — falló en el emulador con un «Sin conexión» que no
 * tenía nada que ver con la conexión (30/08/2026).
 */
export type RespuestaDeSubida =
  /** El server contestó, sea 2xx o no. */
  | { tipo: 'respuesta'; status: number; payload: Record<string, unknown> }
  /** Ni siquiera llegó: red, timeout o cancelada. */
  | { tipo: 'fallo'; motivo: string; reintentable: boolean };

export function subirPorXhr(params: {
  url: string;
  token: string;
  form: FormData;
  timeoutMs: number;
  /** 0→1 mientras suben los bytes. Un archivo sin progreso parece colgado. */
  onProgress?: (ratio: number) => void;
}): Promise<RespuestaDeSubida> {
  return new Promise((resolver) => {
    const pedido = new XMLHttpRequest();
    pedido.open('POST', params.url);
    pedido.timeout = params.timeoutMs;
    pedido.setRequestHeader('Authorization', `Bearer ${params.token}`);
    // El Content-Type NO se pone a mano: lleva el boundary que genera el nativo.

    pedido.upload.onprogress = (evento) => {
      if (params.onProgress && evento.total > 0) params.onProgress(evento.loaded / evento.total);
    };

    pedido.onload = () =>
      resolver({ tipo: 'respuesta', status: pedido.status, payload: leerJson(pedido.responseText) });

    const fallar = (motivo: string, reintentable: boolean) => () =>
      resolver({ tipo: 'fallo', motivo, reintentable });
    pedido.onerror = fallar('Sin conexión. Inténtalo de nuevo.', true);
    pedido.ontimeout = fallar('La subida tardó demasiado. Inténtalo de nuevo.', true);
    pedido.onabort = fallar('Subida cancelada.', false);

    pedido.send(params.form);
  });
}

function leerJson(texto: string): Record<string, unknown> {
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return {};
  }
}
