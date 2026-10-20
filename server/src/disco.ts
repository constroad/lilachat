import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, readFile, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { Huella } from '@lilachat/shared';
import { conPlazo, PLAZO_DEL_DISCO_MS, unaALaVez } from './plazo.js';

/**
 * Todo lo que toca el disco externo (Lilafotos spec §3), y nada más. No decide
 * nada: las rutas vienen ya armadas por los motores de cada app.
 *
 * **El disco puede no estar** — es un USB que se desmonta y falla. Cada
 * operación pasa por `estaMontado()`, que mira una MARCA que solo crea el
 * `disco:init` de cada app a mano: si el disco no está montado, en `/Volumes/…`
 * no hay marca y no se escribe en el disco de arranque por error.
 *
 * **La marca es un parámetro** (copiado a Lilachat el 15/09/2026):
 * Lilafotos usa `.lilafotos` y Lilachat `.lilachat`. Dos apps en el mismo
 * disco, cada una con su raíz y su marca, y ninguna confunde la del otro.
 */
const CARPETA_TEMPORAL = '.tmp';
const CARPETA_PAPELERA = '.papelera';

/**
 * Una subida que pasa el tope. Se corta al pasarlo, no al terminar: esperar el
 * final dejaría que un cuerpo sin fin llene el disco que comparten Lilafotos,
 * las copias de lila y los respaldos.
 */
export class DemasiadoGrande extends Error {
  constructor(readonly maxBytes: number) {
    super(`la subida pasa el tope de ${maxBytes} bytes`);
    this.name = 'DemasiadoGrande';
  }
}

export type OpcionesDelDisco = {
  /** El archivo que dice «este es mi disco»: `.lilafotos`, `.lilachat`. */
  marca: string;
};

export type Espacio = { libres: number; total: number };

/**
 * `montado` se dice solo si el disco ESCRIBE. En la mini (15/09/2026) la
 * marca y el statfs contestaban desde la caché del kernel mientras leer o
 * escribir cualquier cosa se colgaba para siempre: «montado» era mentira.
 */
export type EstadoDelDisco = 'montado' | 'ausente' | 'colgado';

export class Disco {
  readonly marca: string;

  constructor(readonly raiz: string, opciones: OpcionesDelDisco) {
    this.marca = opciones.marca;
  }

  /**
   * Las dos sondas de solo lectura van UNA A LA VEZ (`plazo.ts`): si el USB
   * se cuelga, cada sonda ocupa un hilo del pool de Node hasta que el kernel
   * la suelte; lanzar una por pedido colgaría el server entero.
   */
  readonly estaMontado: () => Promise<boolean> = unaALaVez(() => this.comprobarMarca());
  readonly espacio: () => Promise<Espacio | null> = unaALaVez(() => this.medirEspacio());
  readonly listarRaiz: () => Promise<string[]> = unaALaVez(() => this.nombresEn('.'));
  readonly escribe: () => Promise<boolean> = unaALaVez(() => this.probarEscritura().then(() => true, () => false));

  /** Lo que el health, `/estado` y la subida preguntan: ¿hay disco, y anda? */
  async estado(plazoMs = PLAZO_DEL_DISCO_MS): Promise<EstadoDelDisco> {
    const marca = await conPlazo(this.estaMontado(), plazoMs, null);
    if (marca === null) return 'colgado';
    if (!marca) return 'ausente';
    const escribio = await conPlazo(this.escribe(), plazoMs, false);
    return escribio ? 'montado' : 'colgado';
  }

  protected async comprobarMarca(): Promise<boolean> {
    try {
      await access(path.join(this.raiz, this.marca));
      return true;
    } catch {
      return false;
    }
  }

  protected async medirEspacio(): Promise<Espacio | null> {
    try {
      const stats = await statfs(this.raiz);
      return { libres: stats.bavail * stats.bsize, total: stats.blocks * stats.bsize };
    } catch {
      return null;
    }
  }

  /**
   * La única puerta de una ruta relativa al disco. Se comprueba que quede
   * ADENTRO de la raíz aunque los motores ya la sanearon: es la defensa que
   * no depende de que nadie más haya hecho bien su trabajo.
   */
  absoluta(relativa: string): string {
    const destino = path.resolve(this.raiz, relativa);
    if (destino !== this.raiz && !destino.startsWith(this.raiz + path.sep)) {
      throw new Error(`ruta fuera del disco: ${relativa}`);
    }
    return destino;
  }

  /** Nombres que ya existen en una carpeta del disco (aunque no estén en la base). */
  async nombresEn(carpetaRelativa: string): Promise<string[]> {
    try {
      return await readdir(this.absoluta(carpetaRelativa));
    } catch {
      return [];
    }
  }

  /**
   * Recibe bytes en un temporal EN EL MISMO VOLUMEN, hasheando mientras
   * escribe: así el `rename` final es atómico y un archivo a medio subir
   * nunca aparece en una carpeta navegable.
   */
  async recibir(
    origen: Readable,
    opciones: { maxBytes?: number } = {}
  ): Promise<{ temporal: string; bytes: number; huella: Huella }> {
    const maxBytes = opciones.maxBytes ?? Number.POSITIVE_INFINITY;
    const carpeta = this.absoluta(CARPETA_TEMPORAL);
    await mkdir(carpeta, { recursive: true });
    const temporal = path.join(carpeta, randomUUID());
    const salida = createWriteStream(temporal, { flags: 'wx' });
    const acumulador = sha256.create();
    let bytes = 0;
    try {
      for await (const trozo of origen) {
        const buffer = trozo as Buffer;
        acumulador.update(buffer);
        bytes += buffer.length;
        if (bytes > maxBytes) throw new DemasiadoGrande(maxBytes);
        if (!salida.write(buffer)) await new Promise<void>((resolver) => salida.once('drain', resolver));
      }
      await new Promise<void>((resolver, rechazar) => {
        salida.end((error?: Error | null) => (error ? rechazar(error) : resolver()));
      });
    } catch (error) {
      salida.destroy();
      // Wait for the stream to close: if it was still opening, `rm` ran first and the
      // file appeared afterwards, an orphan temp (flaky gate under load, 20/10).
      if (!salida.closed) await new Promise<void>((resolve) => salida.once('close', () => resolve()));
      await rm(temporal, { force: true });
      throw error;
    }
    return { temporal, bytes, huella: bytesToHex(acumulador.digest()) };
  }

  /**
   * Una escritura de verdad: un temporal que se escribe, se relee y se borra.
   * Es la sonda que distingue «el disco contesta metadatos desde la caché»
   * de «el disco escribe»; lanza si algo falla, para que el que mide lo vea.
   * Se llama por `escribe()` (una a la vez) salvo en los tests.
   */
  async probarEscritura(): Promise<void> {
    const carpeta = this.absoluta(CARPETA_TEMPORAL);
    await mkdir(carpeta, { recursive: true });
    const temporal = path.join(carpeta, `sonda-${randomUUID()}`);
    try {
      await writeFile(temporal, 'sonda\n', { flag: 'wx' });
      await readFile(temporal);
    } finally {
      await rm(temporal, { force: true });
    }
  }

  /** Lo que quedó en `.tmp` es siempre basura de una subida que murió a medias. Se corre al arrancar. */
  async barrerTemporales(): Promise<number> {
    const carpeta = this.absoluta(CARPETA_TEMPORAL);
    let barridos = 0;
    for (const nombre of await this.nombresEn(CARPETA_TEMPORAL)) {
      await rm(path.join(carpeta, nombre), { force: true });
      barridos += 1;
    }
    return barridos;
  }

  async mover(temporal: string, destinoRelativo: string): Promise<void> {
    const destino = this.absoluta(destinoRelativo);
    await mkdir(path.dirname(destino), { recursive: true });
    await rename(temporal, destino);
  }

  async descartar(temporal: string): Promise<void> {
    await rm(temporal, { force: true });
  }

  /** `<usuario>/<año>/<mes>/<n>` → `<usuario>/.papelera/<año>/<mes>/<n>`. Navegable, y volver es un `rename`. */
  async aPapelera(relativa: string): Promise<string> {
    const destino = rutaEnPapelera(relativa);
    await this.mover(this.absoluta(relativa), destino);
    return destino;
  }

  async restaurar(relativaEnPapelera: string): Promise<string> {
    const destino = rutaFueraDePapelera(relativaEnPapelera);
    await this.mover(this.absoluta(relativaEnPapelera), destino);
    return destino;
  }

  async eliminar(relativa: string): Promise<void> {
    await rm(this.absoluta(relativa), { force: true });
  }
}

export function rutaEnPapelera(relativa: string): string {
  const [usuario, ...resto] = relativa.split('/');
  return [usuario, CARPETA_PAPELERA, ...resto].join('/');
}

export function rutaFueraDePapelera(relativa: string): string {
  const partes = relativa.split('/');
  if (partes[1] !== CARPETA_PAPELERA) throw new Error(`no está en la papelera: ${relativa}`);
  return [partes[0], ...partes.slice(2)].join('/');
}
