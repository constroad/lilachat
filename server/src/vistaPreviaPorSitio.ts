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
/**
 * Google Maps gives any robot the generic «Google Maps» page (Lima's map, by
 * the IP); the preview robot gets the point with its coordinates or the place
 * with its photo, like WhatsApp (pending 80).
 */
const SITIOS_DE_MAPAS = ['google.com', 'maps.app.goo.gl', 'goo.gl'];
const esDe = (host: string, dominio: string) => host === dominio || host.endsWith(`.${dominio}`);

export function agenteParaHost(host: string): string {
  return [...SITIOS_DE_META, ...SITIOS_DE_MAPAS].some((dominio) => esDe(host.toLowerCase(), dominio)) ? AGENTE_DE_FACEBOOK : AGENTE_PROPIO;
}

/** The sales line Google Maps puts on a point's page: it says nothing about the point. */
const MAPS_SALES_LINE = /^(Busca negocios locales|Find local businesses)/i;

/**
 * A Google Maps link like WhatsApp's: the point with its coordinates and map,
 * or the place with its photo; without the sales line, and the site says
 * «Google Maps» (Google repeats the title in `og:site_name`).
 */
export function vistaDeMapas(vista: VistaPreviaDeEnlace, host: string): VistaPreviaDeEnlace {
  if (!SITIOS_DE_MAPAS.some((dominio) => esDe(host.toLowerCase(), dominio))) return vista;
  const { descripcion, ...resto } = vista;
  const propia = descripcion && !MAPS_SALES_LINE.test(descripcion) ? { descripcion } : {};
  return { ...resto, ...propia, sitio: 'Google Maps' };
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
