import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { huellaDeBytes } from '@lilachat/shared';
import { DemasiadoGrande, Disco, rutaEnPapelera, rutaFueraDePapelera } from './disco.js';

/**
 * El módulo de disco, contra un disco temporal REAL (como los 44 tests del
 * server de Lilafotos). Lo que fija: la marca decide si hay disco, la
 * recepción hashea mientras escribe y el `rename` es atómico, ninguna ruta
 * sale de la raíz, y `estado()` solo dice «montado» si el disco ESCRIBE.
 *
 * La marca es un PARÁMETRO: Lilafotos usa `.lilafotos`, Lilachat `.lilachat`.
 * Dos apps en el mismo disco, cada una con su raíz y su marca.
 */
const MARCA = '.pruebas';

let raiz: string;
let disco: Disco;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'respaldo-disco-'));
  disco = new Disco(raiz, { marca: MARCA });
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const bytesDe = (texto: string) => new TextEncoder().encode(texto);

describe('la marca', () => {
  it('sin marca el disco está AUSENTE: no se escribe en el disco de arranque por error', async () => {
    await expect(disco.estado()).resolves.toBe('ausente');
  });

  it('con la marca —y escribiendo de verdad— está MONTADO', async () => {
    await writeFile(path.join(raiz, MARCA), '');

    await expect(disco.estado()).resolves.toBe('montado');
  });

  it('la marca es la que se pidió, no la de otra app', async () => {
    await writeFile(path.join(raiz, '.lilafotos'), '');

    await expect(disco.estado()).resolves.toBe('ausente');
  });
});

describe('recibir', () => {
  it('escribe en un temporal del MISMO volumen y devuelve la huella de lo que llegó', async () => {
    const contenido = bytesDe('hola familia');

    const recibido = await disco.recibir(Readable.from([contenido]));

    expect(recibido.bytes).toBe(contenido.length);
    expect(recibido.huella).toBe(huellaDeBytes(contenido));
    expect(recibido.temporal.startsWith(path.join(raiz, '.tmp'))).toBe(true);
    await expect(readFile(recibido.temporal, 'utf8')).resolves.toBe('hola familia');
  });

  it('con tope: pasarse corta la subida, borra el temporal y lanza DemasiadoGrande', async () => {
    const enorme = Readable.from([bytesDe('12345'), bytesDe('67890')]);

    await expect(disco.recibir(enorme, { maxBytes: 8 })).rejects.toBeInstanceOf(DemasiadoGrande);

    await expect(readdir(path.join(raiz, '.tmp'))).resolves.toEqual([]);
  });

  it('con tope: justo en el límite se recibe entero', async () => {
    const recibido = await disco.recibir(Readable.from([bytesDe('12345678')]), { maxBytes: 8 });

    expect(recibido.bytes).toBe(8);
  });

  it('la huella de los trozos es la del entero', async () => {
    const entero = bytesDe('abcdef');

    const recibido = await disco.recibir(Readable.from([bytesDe('abc'), bytesDe('def')]));

    expect(recibido.huella).toBe(huellaDeBytes(entero));
  });

  it('si la subida muere a mitad, el temporal se borra: nunca queda un archivo a medias', async () => {
    const roto = new Readable({
      read() {
        this.push(bytesDe('parte'));
        this.destroy(new Error('se cortó la red'));
      },
    });

    await expect(disco.recibir(roto)).rejects.toThrow('se cortó la red');
    await expect(disco.nombresEn('.tmp')).resolves.toEqual([]);
  });

  it('mover lleva el temporal a su carpeta navegable, creando la ruta', async () => {
    const recibido = await disco.recibir(Readable.from([bytesDe('x')]));

    await disco.mover(recibido.temporal, '51902049935/respaldos/2026-09-15.lcb');

    const final = path.join(raiz, '51902049935/respaldos/2026-09-15.lcb');
    await expect(readFile(final, 'utf8')).resolves.toBe('x');
    await expect(stat(recibido.temporal)).rejects.toThrow();
  });

  it('barrerTemporales limpia lo que quedó de subidas muertas', async () => {
    await disco.recibir(Readable.from([bytesDe('a')]));
    await disco.recibir(Readable.from([bytesDe('b')]));

    await expect(disco.barrerTemporales()).resolves.toBe(2);
    await expect(disco.nombresEn('.tmp')).resolves.toEqual([]);
  });
});

describe('absoluta', () => {
  it('una ruta relativa queda dentro de la raíz', () => {
    expect(disco.absoluta('usuario/2026/09/x.jpg')).toBe(path.join(raiz, 'usuario/2026/09/x.jpg'));
  });

  /** La defensa que no depende de que nadie más haya saneado la ruta. */
  it('una ruta que intenta salir de la raíz se rechaza', () => {
    expect(() => disco.absoluta('../otra-app/secreto')).toThrow('ruta fuera del disco');
    expect(() => disco.absoluta('usuario/../../etc/passwd')).toThrow('ruta fuera del disco');
  });
});

describe('papelera', () => {
  it('a la papelera y de vuelta, con rename', async () => {
    const recibido = await disco.recibir(Readable.from([bytesDe('foto')]));
    await disco.mover(recibido.temporal, 'ana/2026/09/IMG_1.jpg');

    const enPapelera = await disco.aPapelera('ana/2026/09/IMG_1.jpg');
    expect(enPapelera).toBe('ana/.papelera/2026/09/IMG_1.jpg');
    await expect(readFile(path.join(raiz, enPapelera), 'utf8')).resolves.toBe('foto');

    const restaurada = await disco.restaurar(enPapelera);
    expect(restaurada).toBe('ana/2026/09/IMG_1.jpg');
    await expect(readFile(path.join(raiz, restaurada), 'utf8')).resolves.toBe('foto');
  });

  it('las rutas de papelera son puras y simétricas', () => {
    expect(rutaEnPapelera('ana/2026/09/x.jpg')).toBe('ana/.papelera/2026/09/x.jpg');
    expect(rutaFueraDePapelera('ana/.papelera/2026/09/x.jpg')).toBe('ana/2026/09/x.jpg');
    expect(() => rutaFueraDePapelera('ana/2026/09/x.jpg')).toThrow('no está en la papelera');
  });
});

describe('estado con el disco colgado', () => {
  /**
   * La lección del 15/09: la marca contesta desde la caché y escribir se
   * cuelga. «Montado» tiene que salir de una ESCRITURA real, y una sonda que
   * no vuelve dentro del plazo se dice, no se espera para siempre.
   */
  it('si la escritura no vuelve en el plazo, el disco está COLGADO', async () => {
    await writeFile(path.join(raiz, MARCA), '');
    const colgado = new Disco(raiz, { marca: MARCA });
    colgado.probarEscritura = () => new Promise<void>(() => undefined);

    await expect(colgado.estado(30)).resolves.toBe('colgado');
  });
});
