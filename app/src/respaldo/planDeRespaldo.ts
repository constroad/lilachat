import {
  bytesLegibles,
  ESPERA_MAXIMA_HORAS,
  haceCuanto,
  type ElementoDelRollo,
  type MotivoDeDetencion,
} from '@lilachat/shared';
import type { EstadoDeRespaldo } from './estadoDeRespaldo';

/**
 * Lo PURO del respaldo del teléfono (F12.1). Sin SQLite, sin FileSystem, sin
 * red: cada decisión se prueba en milisegundos. Lo que toca el teléfono vive en
 * `puertoDeRespaldo.ts` y `correrRespaldo.ts`.
 */

const PREFIJO = 'respaldo-';
const EXTENSION = '.lcb';
/** `respaldo-2026-09-15T22-03-09Z.lcb` — sin dos puntos: el server solo acepta letras, números, guiones y puntos. */
const FECHA_EN_NOMBRE = /^respaldo-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.lcb$/;

export function nombreDeRespaldo(fecha: Date): string {
  const iso = fecha.toISOString().slice(0, 19).replace(/:/g, '-');
  return `${PREFIJO}${iso}Z${EXTENSION}`;
}

/** Epoch ms de la fecha que lleva el nombre, o `null` si no es un nombre de respaldo. */
export function fechaDeNombre(nombre: string): number | null {
  const partes = FECHA_EN_NOMBRE.exec(nombre);
  if (!partes) return null;
  const [anio, mes, dia, hora, minuto, segundo] = partes.slice(1).map(Number);
  return Date.UTC(anio!, mes! - 1, dia!, hora!, minuto!, segundo!);
}

export type ResumenDeChat = { chatId: string; ultimoSeq: number; cantidad: number };

/**
 * La huella del almacén: cambia si llegó un mensaje O si el hidratador rellenó
 * un hueco (el último seq no se mueve, la cantidad sí). Es lo que decide si
 * vale la pena armar un respaldo nuevo — sin esto se cifraría y subiría el
 * mismo historial cada hora.
 */
export function huellaDelAlmacen(chats: readonly ResumenDeChat[]): string {
  const ordenados = [...chats].sort((a, b) => a.chatId.localeCompare(b.chatId));
  return ordenados.map((chat) => `${chat.chatId}:${chat.ultimoSeq}:${chat.cantidad}`).join('|');
}

/** Un archivo de respaldo en el teléfono, en la forma que entiende el corredor (`shared/subida`). */
export function elementoDeArchivo(archivo: { nombre: string; bytes: number; modificadoEn: number }): ElementoDelRollo {
  return {
    id: archivo.nombre,
    nombre: archivo.nombre,
    bytes: archivo.bytes,
    capturadoEn: fechaDeNombre(archivo.nombre) ?? archivo.modificadoEn,
    modificadoEn: archivo.modificadoEn,
  };
}

export type DecisionDeCorrida = 'sin_passphrase' | 'armar' | 'solo_subir' | 'al_dia';

/**
 * Qué hace una corrida. Con cambios se arma uno nuevo aunque quede uno viejo
 * sin subir: subir un historial viejo cuando ya hay uno más completo sería
 * gastar la corrida en algo que va a quedar obsoleto al instante.
 */
export function decidirCorrida(entrada: {
  hayPassphrase: boolean;
  hayCambios: boolean;
  archivosSinSubir: number;
}): DecisionDeCorrida {
  if (!entrada.hayPassphrase) return 'sin_passphrase';
  if (entrada.hayCambios) return 'armar';
  if (entrada.archivosSinSubir > 0) return 'solo_subir';
  return 'al_dia';
}

const HORA_MS = 3_600_000;

const FRASE_DE_DETENCION: Record<MotivoDeDetencion, string> = {
  sin_wifi: 'Esperando wifi',
  wifi_medido: 'El wifi tiene datos medidos',
  sin_carga: 'Esperando que el teléfono cargue',
  bateria_baja: 'Batería baja',
  sin_respuesta: 'La mini no contestó; se reintenta sola',
  disco_ausente: 'El disco de la mini no está',
  sin_sesion: 'Tu sesión venció. Vuelve a entrar.',
  presupuesto: 'Se quedó sin tiempo; sigue en la próxima',
  pausado: 'Pausado',
};

export type FraseDeEstado = { titulo: string; detalle: string; alerta: boolean };

/**
 * Lo que la pantalla muestra siempre: si hay respaldo, de cuándo, y por qué
 * espera si espera. La alerta es lo que distingue un respaldo que anda de uno
 * que dejó de andar en silencio: más de 48 h con algo pendiente, un fallo, o
 * ninguna passphrase.
 */
export function fraseDeEstado(estado: EstadoDeRespaldo, ahora: number): FraseDeEstado {
  if (estado.decision === 'sin_passphrase') {
    return { titulo: 'Sin respaldo', detalle: 'Creá una passphrase para respaldar tus chats.', alerta: true };
  }
  const titulo = estado.ultimoRespaldoEn === null ? 'Todavía sin respaldo' : `Respaldado ${haceCuanto(estado.ultimoRespaldoEn, ahora)}`;
  if (estado.fallo) return { titulo, detalle: estado.fallo, alerta: true };

  const pendiente = estado.decision === 'armar' || estado.decision === 'solo_subir';
  const demasiado = estado.ultimoRespaldoEn === null || ahora - estado.ultimoRespaldoEn > ESPERA_MAXIMA_HORAS * HORA_MS;
  if (pendiente && estado.detenidoPor) {
    return { titulo, detalle: FRASE_DE_DETENCION[estado.detenidoPor], alerta: demasiado };
  }
  const detalle = estado.bytesDelUltimo === null ? 'Se respalda solo, con wifi y cargando.' : `${bytesLegibles(estado.bytesDelUltimo)} en la mini`;
  return { titulo, detalle, alerta: pendiente && demasiado };
}
