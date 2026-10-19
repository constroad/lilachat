import { lookup as resolverDns, type LookupAddress } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { esDireccionPrivada, leerMetadatos, urlPublica } from './vistaPrevia.js';

/** Lo que se espera a una página antes de rendirse. */
const PLAZO_MS = 5_000;
/**
 * Las etiquetas viven en el `<head>`: se lee hasta `</head>` o hasta este tope.
 * YouTube pone `og:title` pasados los 750 KB para un robot desconocido.
 */
const MAX_BYTES = 1536 * 1024;
const FIN_DEL_HEAD = Buffer.from('</head>');
const MAX_REDIRECCIONES = 3;
const AGENTE = 'Mozilla/5.0 (compatible; LilachatBot/1.0; +https://lilachat.constroad.com)';

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

type Respuesta = { estado: number; destino?: string; html?: string };

/** Un GET, sin seguir redirecciones; trae a lo sumo `MAX_BYTES` de HTML. */
function pedir(url: URL): Promise<Respuesta> {
  return new Promise((resolver, rechazar) => {
    const cliente = url.protocol === 'https:' ? https : http;
    const pedido = cliente.get(
      url,
      { lookup: dnsSoloPublico as never, timeout: PLAZO_MS, headers: { 'User-Agent': AGENTE, Accept: 'text/html', 'Accept-Language': 'es' } },
      (respuesta: IncomingMessage) => {
        const estado = respuesta.statusCode ?? 0;
        if (estado >= 300 && estado < 400) {
          respuesta.resume();
          return resolver({ estado, destino: respuesta.headers.location });
        }
        if (estado !== 200 || !String(respuesta.headers['content-type'] ?? '').includes('text/html')) {
          respuesta.resume();
          return resolver({ estado });
        }
        const trozos: Buffer[] = [];
        let leidos = 0;
        respuesta.on('data', (trozo: Buffer) => {
          trozos.push(trozo);
          leidos += trozo.length;
          if (leidos >= MAX_BYTES || trozo.includes(FIN_DEL_HEAD)) respuesta.destroy();
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
  let url = urlPublica(cruda);
  for (let salto = 0; url && salto <= MAX_REDIRECCIONES; salto += 1) {
    const respuesta = await pedir(url);
    if (respuesta.html !== undefined) {
      const vista = leerMetadatos(respuesta.html, url.toString());
      return vista ? { ...vista, url: cruda } : null;
    }
    if (!respuesta.destino) return null;
    url = urlPublica(new URL(respuesta.destino, url).toString());
  }
  return null;
}
