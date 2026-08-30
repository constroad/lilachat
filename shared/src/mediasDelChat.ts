/**
 * Agrupar lo que se compartió en un chat: Media, Docs y Links. PURO.
 *
 * José, 30/08/2026: en el detalle del chat, «los agrupa como media, docs y
 * links». Es lo que hace WhatsApp: una foto no es un PDF no es un enlace, y
 * mezclarlos en una sola tira obliga a scrollear entre cosas distintas para
 * encontrar la que se busca.
 */
export type MensajeClasificable = {
  seq: number;
  body?: string;
  media?: { mime?: string };
  deletedAt?: string | null;
};

export type ClasificacionDeMedias<T> = {
  /** Fotos y videos: se ven en el visor. */
  medias: T[];
  /** Documentos (PDF, etc.): se abren con otra app. */
  docs: T[];
  /** Enlaces encontrados en el texto. */
  links: { seq: number; url: string }[];
};

const esImagenOVideo = (mime?: string): boolean =>
  (mime ?? '').startsWith('image/') || (mime ?? '').startsWith('video/');

const esDocumento = (mime?: string): boolean => {
  const tipo = mime ?? '';
  return tipo !== '' && !tipo.startsWith('image/') && !tipo.startsWith('video/') && !tipo.startsWith('audio/');
};

/**
 * Los enlaces de un texto.
 *
 * `https://…`, `http://…` y `www.…` (a la que se le antepone `http://` para que
 * abra). **Un correo NO es un link**: `jose@x.com` no lleva a ninguna página, y
 * ofrecerlo como enlace termina en un error del navegador.
 */
export function extraerLinks(texto: string): string[] {
  const encontrados = texto.match(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi) ?? [];
  return encontrados.map((uno) => (uno.toLowerCase().startsWith('www.') ? `http://${uno}` : uno));
}

export function clasificarMedias<T extends MensajeClasificable>(mensajes: T[]): ClasificacionDeMedias<T> {
  const medias: T[] = [];
  const docs: T[] = [];
  const links: { seq: number; url: string }[] = [];

  for (const mensaje of mensajes) {
    if (mensaje.deletedAt) continue;
    if (mensaje.media && esImagenOVideo(mensaje.media.mime)) medias.push(mensaje);
    else if (mensaje.media && esDocumento(mensaje.media.mime)) docs.push(mensaje);
    if (mensaje.body) {
      for (const url of extraerLinks(mensaje.body)) links.push({ seq: mensaje.seq, url });
    }
  }

  return { medias, docs, links };
}
