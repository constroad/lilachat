import { isIP } from 'node:net';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';

/** Lo que entra en la tarjeta: el chat corta a dos líneas igual. */
const MAX_TITULO = 160;
const MAX_DESCRIPCION = 300;
/** Solo los puertos de la web: un puerto raro es la forma de tantear servicios internos. */
const PUERTOS_PERMITIDOS = new Set(['', '80', '443']);
const NOMBRES_INTERNOS = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$)/i;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, codigo: string) => {
    const numero = codigo.startsWith('#x') ? parseInt(codigo.slice(2), 16) : codigo.startsWith('#') ? parseInt(codigo.slice(1), 10) : NaN;
    if (!Number.isNaN(numero)) return numero > 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : entera;
    return ENTIDADES[codigo.toLowerCase()] ?? entera;
  });
}

const limpiar = (texto: string | undefined, maximo: number): string | undefined => {
  const limpio = decodificar(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpio ? limpio.slice(0, maximo) : undefined;
};

/** Las `<meta>` de la página por `property` o `name`, en minúsculas; gana la primera. */
function etiquetasMeta(html: string): Map<string, string> {
  const etiquetas = new Map<string, string>();
  for (const [meta] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const atributos = new Map<string, string>();
    for (const atributo of meta.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      atributos.set(atributo[1]!.toLowerCase(), atributo[2] ?? atributo[3] ?? '');
    }
    const clave = (atributos.get('property') ?? atributos.get('name'))?.toLowerCase();
    const contenido = atributos.get('content');
    if (clave && contenido !== undefined && !etiquetas.has(clave)) etiquetas.set(clave, contenido);
  }
  return etiquetas;
}

function imagenAbsoluta(cruda: string | undefined, base: string): string | undefined {
  if (!cruda?.trim()) return undefined;
  try {
    const imagen = new URL(decodificar(cruda.trim()), base);
    return imagen.protocol === 'https:' || imagen.protocol === 'http:' ? imagen.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * La tarjeta de una página, de sus etiquetas `og:` (con `twitter:`, `<title>` y
 * `description` de respaldo). Sin título no hay tarjeta. Puro: el HTML ya llegó.
 */
export function leerMetadatos(html: string, base: string): VistaPreviaDeEnlace | null {
  const meta = etiquetasMeta(html);
  const tituloDeLaPagina = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const titulo = limpiar(meta.get('og:title') ?? meta.get('twitter:title') ?? tituloDeLaPagina, MAX_TITULO);
  if (!titulo) return null;
  const descripcion = limpiar(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'), MAX_DESCRIPCION);
  const imagen = imagenAbsoluta(meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image'), base);
  const sitio = limpiar(meta.get('og:site_name'), MAX_TITULO) ?? new URL(base).hostname.replace(/^www\./, '');
  // Un reel, un TikTok o un video: la tarjeta lleva el botón de play (20/10).
  const video = (meta.get('og:type') ?? '').startsWith('video') || meta.has('og:video') || meta.has('og:video:url');
  return { url: base, titulo, ...(descripcion ? { descripcion } : {}), ...(imagen ? { imagen } : {}), sitio, ...(video ? { video: true } : {}) };
}

function esIpv4Privada(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/**
 * ¿Es una dirección de la red interna, de la máquina o reservada? El server
 * vive en la mini junto a la bóveda y Torre: pedir una vista previa no puede
 * ser la forma de llegar a ellos (SSRF).
 */
export function esDireccionPrivada(ip: string): boolean {
  const limpia = ip.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(limpia) === 4) return esIpv4Privada(limpia);
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(limpia);
  if (mapeada) return esIpv4Privada(mapeada[1]!);
  if (limpia.startsWith('::')) return true;
  const primero = parseInt(limpia.split(':')[0] ?? '', 16);
  if (Number.isNaN(primero)) return true;
  return (primero & 0xfe00) === 0xfc00 || (primero & 0xffc0) === 0xfe80 || (primero & 0xff00) === 0xff00;
}

/** El enlace, si se puede ir a buscarlo: http(s), puerto web, sin credenciales ni destino interno. */
export function urlPublica(cruda: string): URL | null {
  let url: URL;
  try {
    url = new URL(cruda.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || !PUERTOS_PERMITIDOS.has(url.port)) return null;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (NOMBRES_INTERNOS.test(host)) return null;
  if (isIP(host) && esDireccionPrivada(host)) return null;
  return url;
}
