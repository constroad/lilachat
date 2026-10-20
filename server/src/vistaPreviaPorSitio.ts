import type { VistaPreviaDeEnlace } from '@lilachat/shared';

/**
 * Las tarjetas de los sitios que no se las dan a un robot cualquiera (José,
 * 20/10: «WhatsApp muestra la miniatura de Instagram y YouTube; Lilachat no»).
 * YouTube y TikTok publican oEmbed (JSON con título y miniatura, sin clave);
 * Instagram, Facebook y TikTok solo sirven sus etiquetas `og:` al robot de
 * Facebook, que es el que usa WhatsApp. PURO: el pedido lo hace `traerVistaPrevia`.
 */
export const AGENTE_PROPIO = 'Mozilla/5.0 (compatible; LilachatBot/1.0; +https://lilachat.constroad.com)';
export const AGENTE_DE_FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const SITIOS_DE_META = ['instagram.com', 'facebook.com', 'fb.watch', 'tiktok.com'];
const esDe = (host: string, dominio: string) => host === dominio || host.endsWith(`.${dominio}`);

export function agenteParaHost(host: string): string {
  return SITIOS_DE_META.some((dominio) => esDe(host.toLowerCase(), dominio)) ? AGENTE_DE_FACEBOOK : AGENTE_PROPIO;
}

const VIDEO_DE_YOUTUBE = /^\/(watch|shorts\/[\w-]+|live\/[\w-]+)/;

/** El endpoint oEmbed del enlace, si el sitio lo tiene (un video); si no, `null`. */
export function urlDeOembed(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const esVideoDeYoutube = (esDe(host, 'youtube.com') && VIDEO_DE_YOUTUBE.test(url.pathname)) || (host === 'youtu.be' && url.pathname.length > 1);
  if (esVideoDeYoutube) return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`;
  if (esDe(host, 'tiktok.com') && /\/video\/\d+/.test(url.pathname)) return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`;
  return null;
}

const texto = (valor: unknown): string | undefined => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined);

/** La tarjeta desde la respuesta oEmbed. Sin título, `null`. */
export function vistaDeOembed(json: unknown, url: string): VistaPreviaDeEnlace | null {
  if (!json || typeof json !== 'object') return null;
  const datos = json as Record<string, unknown>;
  const titulo = texto(datos.title);
  if (!titulo) return null;
  const miniatura = texto(datos.thumbnail_url);
  const imagen = miniatura && /^https?:\/\//.test(miniatura) ? miniatura : undefined;
  const descripcion = texto(datos.author_name);
  return { url, titulo, ...(descripcion ? { descripcion } : {}), ...(imagen ? { imagen } : {}), sitio: texto(datos.provider_name) ?? new URL(url).hostname.replace(/^www\./, ''), video: true };
}
