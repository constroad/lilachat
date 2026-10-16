import { describe, expect, it } from 'vitest';
import { conciliarPagina } from './conciliarMensajes.js';
import {
  cubreHueco,
  huecosDelHistorial,
  seqsQueSobran,
  siguienteHueco,
  tramoContiguoAntesDe,
} from './almacenDeMensajes.js';

/**
 * El almacén durable del teléfono (F12.0): los mensajes dejan de ser una caché
 * recortada y pasan a ser la copia completa, fila por fila.
 *
 * José, 15/09/2026: «que se guarden en los teléfonos como WhatsApp». Con el
 * cifrado por defecto (F12.3) el server deja de poder leer los chats, así que la
 * copia entera tiene que vivir en el teléfono — y de ahí sale el respaldo.
 *
 * La regla que fija este test: **lo que `conciliarPagina` saca de la pantalla
 * se saca también del disco.** Sin eso, las líneas que José pidió limpiar
 * volverían a aparecer en cada apertura, ahora desde SQLite.
 */
const mensaje = (seq: number) => ({ seq, body: `m${seq}` });

describe('seqsQueSobran', () => {
  it('si el server confirmó todo, no sobra nada', () => {
    const guardados = [mensaje(1), mensaje(2), mensaje(3)];
    const conciliados = conciliarPagina(guardados, [mensaje(2), mensaje(3)], 3);

    expect(seqsQueSobran(guardados, conciliados)).toEqual([]);
  });

  it('un mensaje que el server ya no tiene DENTRO del rango de la página se va', () => {
    // El 2 estaba en el teléfono; la página 1–3 del server viene sin él.
    const guardados = [mensaje(1), mensaje(2), mensaje(3)];
    const conciliados = conciliarPagina(guardados, [mensaje(1), mensaje(3)], 3);

    expect(seqsQueSobran(guardados, conciliados)).toEqual([2]);
  });

  it('lo guardado por ENCIMA del tope del server se va: no puede existir', () => {
    // El chat se vació y volvió a empezar: en el server el último es el 2.
    const guardados = [mensaje(1), mensaje(2), mensaje(5), mensaje(7)];
    const conciliados = conciliarPagina(guardados, [mensaje(1), mensaje(2)], 2);

    expect(seqsQueSobran(guardados, conciliados)).toEqual([5, 7]);
  });

  it('lo de FUERA del rango de la página no se toca: el server no habló de eso', () => {
    const guardados = [mensaje(1), mensaje(2), mensaje(10), mensaje(11)];
    const conciliados = conciliarPagina(guardados, [mensaje(10), mensaje(11)], 11);

    expect(seqsQueSobran(guardados, conciliados)).toEqual([]);
  });

  it('sin nada guardado, nada sobra', () => {
    expect(seqsQueSobran([], [mensaje(1)])).toEqual([]);
  });
});

/**
 * El scroll hacia arriba lee PRIMERO del teléfono. Pero el almacén puede tener
 * huecos —un teléfono que volvió tras días recibe 200 del delta y queda un
 * agujero en el medio—, y servir «lo que hay antes» saltando el agujero haría
 * desaparecer conversación entera sin que nadie lo note.
 *
 * La regla: solo sirve lo local si el tramo es CONTIGUO hasta `beforeSeq` y
 * está entero. Si no, se pide al server, que sí sabe qué hay.
 */
describe('tramoContiguoAntesDe', () => {
  const locales = (...seqs: number[]) => seqs.map(mensaje);

  it('sirve la página local cuando está entera y pegada a beforeSeq', () => {
    const tramo = tramoContiguoAntesDe({ locales: locales(7, 8, 9, 10), beforeSeq: 11, limit: 4 });

    expect(tramo).toEqual(locales(7, 8, 9, 10));
  });

  it('NO sirve si hay un hueco entre lo local y beforeSeq', () => {
    // Falta el 10: lo local termina en 9 y la pantalla empieza en 11.
    expect(tramoContiguoAntesDe({ locales: locales(7, 8, 9), beforeSeq: 11, limit: 3 })).toBeNull();
  });

  it('NO sirve si hay un hueco DENTRO del tramo', () => {
    expect(tramoContiguoAntesDe({ locales: locales(7, 9, 10), beforeSeq: 11, limit: 3 })).toBeNull();
  });

  /** Menos filas que el límite y pegadas al principio del chat (seq 1): es todo lo que hay, y se sirve. */
  it('sirve un tramo corto si llega al principio del chat', () => {
    expect(tramoContiguoAntesDe({ locales: locales(1, 2), beforeSeq: 3, limit: 50 })).toEqual(locales(1, 2));
  });

  /** Menos filas que el límite SIN llegar al principio: puede faltar lo de más atrás, va al server. */
  it('NO sirve un tramo corto que no llega al principio', () => {
    expect(tramoContiguoAntesDe({ locales: locales(5, 6), beforeSeq: 7, limit: 50 })).toBeNull();
  });

  it('sin filas locales, al server', () => {
    expect(tramoContiguoAntesDe({ locales: [], beforeSeq: 7, limit: 50 })).toBeNull();
  });
});

/**
 * El hidratador (F12.0b) completa el historial en el teléfono: para que el
 * respaldo sea entero, cada chat tiene que estar de `1` a `lastSeq` sin huecos.
 * No se confía en una bandera «completo»: se miran los números, porque un
 * hueco puede formarse DESPUÉS de haber estado completo.
 */
describe('huecosDelHistorial', () => {
  it('sin huecos, nada que pedir', () => {
    expect(huecosDelHistorial([1, 2, 3], 3)).toEqual([]);
  });

  it('un chat vacío en el teléfono es un solo hueco de 1 al último', () => {
    expect(huecosDelHistorial([], 40)).toEqual([{ desde: 1, hasta: 40 }]);
  });

  it('encuentra el hueco al principio, en el medio y al final', () => {
    // Tengo 3-4 y 8; el server va hasta el 10.
    expect(huecosDelHistorial([3, 4, 8], 10)).toEqual([
      { desde: 1, hasta: 2 },
      { desde: 5, hasta: 7 },
      { desde: 9, hasta: 10 },
    ]);
  });

  /** Lo que hay por encima del último del server no es un hueco: es basura que concilia otro. */
  it('ignora seqs locales por encima del último del server', () => {
    expect(huecosDelHistorial([1, 2, 9], 2)).toEqual([]);
  });

  it('con lastSeq 0 (chat sin mensajes) no hay nada que pedir', () => {
    expect(huecosDelHistorial([], 0)).toEqual([]);
  });
});

/**
 * El server también puede tener huecos: las líneas de prueba que José pidió
 * limpiar se borraron de la BASE, así que sus `seq` no existen en ningún lado.
 * Si el hidratador pidiera ese hueco una y otra vez, no terminaría nunca. La
 * regla: una página que no trae NADA del hueco pedido cierra ese hueco.
 */
describe('cubreHueco', () => {
  const hueco = { desde: 3, hasta: 7 };

  it('una página con al menos un seq dentro del hueco lo cubre (en parte o entero)', () => {
    expect(cubreHueco([mensaje(6), mensaje(7)], hueco)).toBe(true);
  });

  it('una página que solo trae seqs de fuera del hueco NO lo cubre: el server tampoco los tiene', () => {
    expect(cubreHueco([mensaje(1), mensaje(2)], hueco)).toBe(false);
  });

  it('una página vacía no cubre nada', () => {
    expect(cubreHueco([], hueco)).toBe(false);
  });
});

/**
 * Qué hueco pide el hidratador. Antes era siempre el MÁS NUEVO: si el server
 * tampoco lo tenía (líneas borradas de la base), el chat se daba por completo
 * y los huecos más viejos —el resto del historial— no se pedían nunca.
 */
describe('siguienteHueco', () => {
  it('sin huecos: nada que pedir', () => {
    expect(siguienteHueco([], new Set())).toBeNull();
  });

  it('elige el más nuevo', () => {
    const huecos = [
      { desde: 1, hasta: 389 },
      { desde: 450, hasta: 460 },
    ];
    expect(siguienteHueco(huecos, new Set())).toEqual({ desde: 450, hasta: 460 });
  });

  it('saltea el que el server no pudo llenar y sigue con el anterior', () => {
    const huecos = [
      { desde: 1, hasta: 389 },
      { desde: 450, hasta: 460 },
    ];
    expect(siguienteHueco(huecos, new Set([460]))).toEqual({ desde: 1, hasta: 389 });
  });

  it('todos sin remedio: nada que pedir', () => {
    expect(siguienteHueco([{ desde: 450, hasta: 460 }], new Set([460]))).toBeNull();
  });
});
