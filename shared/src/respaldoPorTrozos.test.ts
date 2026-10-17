import { describe, expect, it } from 'vitest';
import { base64ToBytes, decryptMessage, encryptMessage } from './e2ee.js';
import { armarRespaldo, claveDeRespaldo, KDF_DE_PRUEBA, type ContenidoDeRespaldo } from './respaldoCifrado.js';
import { abrirRespaldoAsync, armarRespaldoPorTrozos, type RespaldoPorTrozos } from './respaldoPorTrozos.js';

/**
 * FL5 (spec §45): el respaldo se cifra POR TROZOS y cediendo el hilo entre uno
 * y otro. Con un solo sobre, 20 000 mensajes eran un `JSON.stringify` + AES-GCM
 * de varios MB de corrido en el hilo de JS: la pantalla congelada hasta el ANR.
 */
const PASS = 'la clave es 4821';

function conversacion(cantidad: number): unknown[] {
  return Array.from({ length: cantidad }, (_, i) => ({ seq: i + 1, body: `mensaje ${i + 1}` }));
}

const contenido: ContenidoDeRespaldo = {
  v: 1,
  creadoEn: '2026-10-17T22:00:00.000Z',
  telefono: '51902049935',
  chats: [
    { chatId: '68a1', mensajes: conversacion(7) },
    { chatId: '68b2', mensajes: [] },
    { chatId: '68c3', mensajes: conversacion(3) },
  ],
};

const opciones = { kdf: KDF_DE_PRUEBA, mensajesPorTrozo: 3, ceder: async () => undefined };

describe('armarRespaldoPorTrozos / abrirRespaldoAsync', () => {
  it('ida y vuelta: se abre igual a lo que entró, con el chat vacío incluido y en orden', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);

    expect(await abrirRespaldoAsync(PASS, respaldo, { kdfMaximo: KDF_DE_PRUEBA })).toEqual(contenido);
  });

  it('parte los mensajes en trozos del tamaño pedido (7 → 3+3+1, 3 → 3)', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);

    expect(respaldo.v).toBe(2);
    expect(respaldo.trozos).toHaveLength(4);
  });

  it('cede el hilo entre trozos: la pantalla puede dibujar mientras cifra', async () => {
    let cesiones = 0;
    await armarRespaldoPorTrozos(PASS, contenido, { ...opciones, ceder: async () => void (cesiones += 1) });

    expect(cesiones).toBeGreaterThanOrEqual(4);
  });

  it('en el archivo no queda ni el texto, ni los ids de los chats, ni el teléfono', async () => {
    const serializado = JSON.stringify(await armarRespaldoPorTrozos(PASS, contenido, opciones));

    expect(serializado).not.toContain('mensaje 1');
    expect(serializado).not.toContain('68a1');
    expect(serializado).not.toContain('51902049935');
    expect(serializado).not.toContain(PASS);
  });

  it('con otra passphrase devuelve null', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);

    expect(await abrirRespaldoAsync('la clave es 4822', respaldo, { kdfMaximo: KDF_DE_PRUEBA })).toBeNull();
  });

  /** Cada trozo autentica su contenido, pero no su LUGAR: el índice va adentro del cifrado. */
  it('trozos reordenados, quitados o duplicados devuelven null', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);
    const [a, b, c, d] = respaldo.trozos as [RespaldoPorTrozos['trozos'][number], ...RespaldoPorTrozos['trozos']];
    const abrir = (trozos: RespaldoPorTrozos['trozos']) =>
      abrirRespaldoAsync(PASS, { ...respaldo, trozos }, { kdfMaximo: KDF_DE_PRUEBA });

    expect(await abrir([b!, a, c!, d!])).toBeNull();
    expect(await abrir([a, b!, c!])).toBeNull();
    expect(await abrir([a, b!, c!, d!, d!])).toBeNull();
  });

  it('un trozo de OTRO respaldo con la misma passphrase no se acepta', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);
    const otro = await armarRespaldoPorTrozos(PASS, contenido, opciones);
    const mezclado = { ...respaldo, trozos: [otro.trozos[0]!, ...respaldo.trozos.slice(1)] };

    expect(await abrirRespaldoAsync(PASS, mezclado, { kdfMaximo: KDF_DE_PRUEBA })).toBeNull();
  });

  it('un trozo que nombra un chat que la cabecera no tiene devuelve null', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);
    const clave = claveDeRespaldo(PASS, base64ToBytes(respaldo.kdf.sal), KDF_DE_PRUEBA);
    const { id } = JSON.parse(decryptMessage(clave, respaldo.cabecera)) as { id: string };
    const intruso = encryptMessage(clave, JSON.stringify({ id, i: 3, chatId: 'ajeno', mensajes: [] }));
    const tocado = { ...respaldo, trozos: [...respaldo.trozos.slice(0, 3), intruso] };

    expect(await abrirRespaldoAsync(PASS, tocado, { kdfMaximo: KDF_DE_PRUEBA })).toBeNull();
  });

  /** Los respaldos que ya están en la mini (un solo sobre) siguen abriendo. */
  it('abre también el formato viejo v1', async () => {
    const viejo = armarRespaldo(PASS, contenido, KDF_DE_PRUEBA);

    expect(await abrirRespaldoAsync(PASS, viejo, { kdfMaximo: KDF_DE_PRUEBA })).toEqual(contenido);
  });

  it('basura, un kdf gigante o una versión desconocida devuelven null', async () => {
    const respaldo = await armarRespaldoPorTrozos(PASS, contenido, opciones);

    expect(await abrirRespaldoAsync(PASS, null)).toBeNull();
    expect(await abrirRespaldoAsync(PASS, { ...respaldo, v: 3 })).toBeNull();
    expect(await abrirRespaldoAsync(PASS, { ...respaldo, kdf: { ...respaldo.kdf, n: 2 ** 30 } })).toBeNull();
    expect(await abrirRespaldoAsync(PASS, { ...respaldo, trozos: 'no' }, { kdfMaximo: KDF_DE_PRUEBA })).toBeNull();
  });

  it('sin mensajes en ningún chat: cero trozos y se abre igual', async () => {
    const vacio: ContenidoDeRespaldo = { ...contenido, chats: [{ chatId: '68b2', mensajes: [] }] };
    const respaldo = await armarRespaldoPorTrozos(PASS, vacio, opciones);

    expect(respaldo.trozos).toHaveLength(0);
    expect(await abrirRespaldoAsync(PASS, respaldo, { kdfMaximo: KDF_DE_PRUEBA })).toEqual(vacio);
  });
});
