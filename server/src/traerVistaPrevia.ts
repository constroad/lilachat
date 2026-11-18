import { lookup as resolverDns, type LookupAddress } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { esDireccionPrivada, leerMetadatos, urlPublica } from './vistaPrevia.js';
import { agenteParaHost, urlDeOembed, vistaDeMapas, vistaDeOembed } from './vistaPreviaPorSitio.js';

/** Lo que se espera a una página antes de rendirse. */
const PLAZO_MS = 5_000;
/**
 * Las etiquetas viven en el `<head>`: se lee hasta `</head>` o hasta este tope.
 * YouTube pone `og:title` pasados los 750 KB para un robot desconocido.
 */
const MAX_BYTES = 1536 * 1024;
const FIN_DEL_HEAD = Buffer.from('</head>');
const MAX_REDIRECCIONES = 3;

type Resolver = (error: NodeJS.ErrnoException | null, direccion: string | LookupAddress[], familia?: number) => void;

/**
 * El DNS que usa la conexión, con el control ADENTRO: se valida la misma IP a
 * la que se conecta. Validar antes y conectar después deja la puerta del DNS
 * que cambia en el medio (rebinding).
 */
function dnsSoloPublico(host: string, opciones: { all?: boolean; family?: number }, listo: Resolver): void {
  resolverDns(host, { all: true, family: opciones.family }, (error, direcciones) => {
    if (error) return listo(error, '');
    if (direcciones.length === 0 || direcciones.some((uno) => esDireccionPrivada(uno.address))) {
      return listo(Object.assign(new Error('destino no público'), { code: 'EPRIVADA' }), '');
    }
    if (opciones.all) return listo(null, direcciones);
    listo(null, direcciones[0]!.address, direcciones[0]!.family);
  });
}

type PageAnswer = { estado: number; destino?: string; html?: string };
/** Qué se pide: la página (HTML) o el oEmbed (JSON). El agente depende del sitio (`agenteParaHost`). */
type AcceptType = 'text/html' | 'application/json';

/** One GET without following redirects; reads at most `MAX_BYTES` of the accepted type (the whole body when asked). */
function fetchOnce(url: URL, accept: AcceptType = 'text/html', wholeBody = false): Promise<PageAnswer> {
  return new Promise((resolver, rechazar) => {
    const cliente = url.protocol === 'https:' ? https : http;
    const pedido = cliente.get(
      url,
      { lookup: dnsSoloPublico as never, timeout: PLAZO_MS, headers: { 'User-Agent': agenteParaHost(url.hostname), Accept: accept, 'Accept-Language': 'es' } },
      (respuesta: IncomingMessage) => {
        const estado = respuesta.statusCode ?? 0;
        if (estado >= 300 && estado < 400) {
          respuesta.resume();
          return resolver({ estado, destino: respuesta.headers.location });
        }
        if (estado !== 200 || !String(respuesta.headers['content-type'] ?? '').includes(accept)) {
          respuesta.resume();
          return resolver({ estado });
        }
        const trozos: Buffer[] = [];
        let leidos = 0;
        respuesta.on('data', (trozo: Buffer) => {
          trozos.push(trozo);
          leidos += trozo.length;
          if (leidos >= MAX_BYTES || (accept === 'text/html' && !wholeBody && trozo.includes(FIN_DEL_HEAD))) respuesta.destroy();
        });
        const terminar = () => resolver({ estado, html: Buffer.concat(trozos).subarray(0, MAX_BYTES).toString('utf8') });
        respuesta.on('end', terminar);
        respuesta.on('close', terminar);
        respuesta.on('error', terminar);
      }
    );
    pedido.on('timeout', () => pedido.destroy(new Error('la página no respondió a tiempo')));
    pedido.on('error', rechazar);
  });
}

/**
 * La tarjeta de un enlace, yendo a buscar la página (FL13d). Cada redirección
 * se vuelve a validar como si fuera el enlace original. Sin tarjeta —o si la
 * página no responde, no es HTML o apunta adentro— devuelve `null`.
 */
export async function traerVistaPrevia(cruda: string): Promise<VistaPreviaDeEnlace | null> {
  const desdeOembed = await traerOembed(cruda);
  if (desdeOembed) return desdeOembed;
  let url = urlPublica(cruda);
  for (let salto = 0; url && salto <= MAX_REDIRECCIONES; salto += 1) {
    const respuesta = await fetchOnce(url);
    if (respuesta.html !== undefined) {
      const vista = leerMetadatos(respuesta.html, url.toString());
      return vista ? vistaDeMapas({ ...vista, url: cruda }, url.hostname) : null;
    }
    if (!respuesta.destino) return null;
    url = urlPublica(new URL(respuesta.destino, url).toString());
  }
  return null;
}

/**
 * YouTube y TikTok por oEmbed (20/10): JSON con título, autor y miniatura,
 * aunque la página no se los dé a un robot (los Shorts). Si falla, sigue el
 * camino de las etiquetas `og:`.
 */
async function traerOembed(cruda: string): Promise<VistaPreviaDeEnlace | null> {
  const url = urlPublica(cruda);
  const endpoint = url ? urlDeOembed(url) : null;
  const destino = endpoint ? urlPublica(endpoint) : null;
  if (!destino) return null;
  try {
    const respuesta = await fetchOnce(destino, 'application/json');
    return respuesta.html ? vistaDeOembed(JSON.parse(respuesta.html), cruda) : null;
  } catch {
    return null;
  }
}

/**
 * A public page's HTML, body included (the caption of an Instagram embed lives
 * in the body), with the same SSRF guard and redirect checks. `null` when it
 * does not answer, is not HTML or points inside.
 */
export async function fetchPublicHtml(raw: string, options: { wholeBody?: boolean } = {}): Promise<string | null> {
  let url = urlPublica(raw);
  for (let hop = 0; url && hop <= MAX_REDIRECCIONES; hop += 1) {
    const answer = await fetchOnce(url, 'text/html', options.wholeBody ?? true).catch(() => null);
    if (!answer) return null;
    if (answer.html !== undefined) return answer.html;
    if (!answer.destino) return null;
    url = urlPublica(new URL(answer.destino, url).toString());
  }
  return null;
}

/** Where a short link lands (vt.tiktok.com → tiktok.com/@user/video/…), checking every hop; the same link when it does not move. */
export async function finalUrlOf(raw: string): Promise<string> {
  let url = urlPublica(raw);
  let last = raw;
  for (let hop = 0; url && hop <= MAX_REDIRECCIONES; hop += 1) {
    last = url.toString();
    const answer = await fetchOnce(url).catch(() => null);
    if (!answer?.destino) return last;
    url = urlPublica(new URL(answer.destino, url).toString());
  }
  return last;
}
