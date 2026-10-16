import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Disco } from './disco.js';

/**
 * El disco donde viven los respaldos de conversaciones (F12.1): el MISMO disco
 * externo de la mini que usa Lilafotos, con raíz y marca propias.
 *
 *   /Volumes/CONSTROAD-BACKUP/lilachat-datos/<teléfono>/respaldos/<nombre>
 *
 * Se comparte el DISCO y el patrón (`disco.ts` + `plazo.ts`, copiados), no el
 * servicio: la identidad de Lilachat es el teléfono y la de fotos el correo, y
 * un deploy de fotos no puede romper el respaldo del chat ni al revés
 * (Lilafotos spec §4). La marca `.lilachat` la crea solo `disco:init` a mano:
 * con el disco desmontado no hay marca y no se escribe en el disco de arranque.
 *
 * **El disco puede no estar, y puede estar COLGADO.** Todo pasa por `Disco`,
 * que mide con plazo y una sonda a la vez — el 15/09/2026 un USB colgado
 * ocupó los 4 hilos del pool de Node y mató el health de fotos.
 */
export const MARCA_DEL_DISCO = '.lilachat';
const RAIZ_POR_DEFECTO = '/Volumes/CONSTROAD-BACKUP/lilachat-datos';
const CARPETA_DE_RESPALDOS = 'respaldos';
/** Lo escribe `copia-a-la-mini.sh` (restic) y lo lee la app: cuándo fue la última copia buena. */
const ESTADO_DE_COPIA = '.copia-a-la-mini.json';

/** Letras, números, guiones y puntos, con algo antes de la extensión. Sin barras ni espacios. */
const NOMBRE_VALIDO = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/;

export function raizDeRespaldos(): string {
  return process.env.RESPALDOS_RAIZ || RAIZ_POR_DEFECTO;
}

/**
 * Un `Disco` por raíz, no por pedido: `unaALaVez` vive en la instancia, y es lo
 * que impide que diez pedidos lancen diez sondas contra un USB colgado.
 */
const discos = new Map<string, Disco>();

export function discoDeRespaldos(): Disco {
  const raiz = raizDeRespaldos();
  let disco = discos.get(raiz);
  if (!disco) {
    disco = new Disco(raiz, { marca: MARCA_DEL_DISCO });
    discos.set(raiz, disco);
  }
  return disco;
}

export function nombreDeRespaldoValido(nombre: string): boolean {
  return NOMBRE_VALIDO.test(nombre);
}

/** La carpeta es el TELÉFONO de la sesión — nunca lo que diga el cliente. */
export function rutaDeRespaldo(telefono: string, nombre: string): string {
  return `${telefono}/${CARPETA_DE_RESPALDOS}/${nombre}`;
}

export type EstadoDeCopia = { ultimaEn?: string; verificadaEn?: string; ok?: boolean; fallo?: string };

/** `null` = nunca se registró una copia. La app lo muestra como alerta, no como detalle. */
export async function leerEstadoDeCopia(): Promise<EstadoDeCopia | null> {
  try {
    const crudo = await readFile(path.join(raizDeRespaldos(), ESTADO_DE_COPIA), 'utf8');
    const estado = JSON.parse(crudo) as EstadoDeCopia;
    return estado && typeof estado === 'object' ? estado : null;
  } catch {
    return null;
  }
}
