import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL } from './estadoDeRespaldo';
import {
  decidirCorrida,
  elementoDeArchivo,
  fraseDeEstado,
  huellaDelAlmacen,
  nombreDeRespaldo,
  fechaDeNombre,
} from './planDeRespaldo';

/**
 * Lo PURO del respaldo del teléfono (F12.1): cómo se llama el archivo, cuándo
 * hay algo nuevo que respaldar, y qué hace una corrida. Sin SQLite, sin
 * FileSystem, sin red: se prueba en milisegundos.
 */
describe('nombreDeRespaldo / fechaDeNombre', () => {
  it('el nombre lleva la fecha UTC sin dos puntos: el server solo acepta letras, números, guiones y puntos', () => {
    expect(nombreDeRespaldo(new Date('2026-09-15T22:03:09.123Z'))).toBe('respaldo-2026-09-15T22-03-09Z.lcb');
  });

  it('del nombre se recupera la fecha, para ordenar los archivos sin leerlos', () => {
    expect(fechaDeNombre('respaldo-2026-09-15T22-03-09Z.lcb')).toBe(Date.UTC(2026, 8, 15, 22, 3, 9));
  });

  it('un nombre que no es de respaldo no tiene fecha', () => {
    expect(fechaDeNombre('otra-cosa.txt')).toBeNull();
    expect(fechaDeNombre('respaldo-no-es-fecha.lcb')).toBeNull();
  });
});

describe('huellaDelAlmacen', () => {
  const chats = [
    { chatId: 'b', ultimoSeq: 40, cantidad: 40 },
    { chatId: 'a', ultimoSeq: 7, cantidad: 7 },
  ];

  it('es la misma sin importar el orden de los chats', () => {
    expect(huellaDelAlmacen(chats)).toBe(huellaDelAlmacen([...chats].reverse()));
  });

  it('cambia cuando llega un mensaje', () => {
    const conUnoMas = [chats[0]!, { chatId: 'a', ultimoSeq: 8, cantidad: 8 }];

    expect(huellaDelAlmacen(conUnoMas)).not.toBe(huellaDelAlmacen(chats));
  });

  /** El hidratador rellena huecos SIN mover el último seq: la cantidad tiene que contar. */
  it('cambia cuando el hidratador rellena un hueco aunque el último seq sea el mismo', () => {
    const conHuecoLleno = [chats[0]!, { chatId: 'a', ultimoSeq: 7, cantidad: 6 }];

    expect(huellaDelAlmacen(conHuecoLleno)).not.toBe(huellaDelAlmacen(chats));
  });

  it('un almacén vacío tiene huella, y es distinta de uno con algo', () => {
    expect(huellaDelAlmacen([])).not.toBe(huellaDelAlmacen(chats));
  });
});

describe('elementoDeArchivo', () => {
  it('un archivo de respaldo es un elemento del rollo con la fecha del nombre', () => {
    const elemento = elementoDeArchivo({ nombre: 'respaldo-2026-09-15T22-03-09Z.lcb', bytes: 1234, modificadoEn: 1_700_000_000_000 });

    expect(elemento).toEqual({
      id: 'respaldo-2026-09-15T22-03-09Z.lcb',
      nombre: 'respaldo-2026-09-15T22-03-09Z.lcb',
      bytes: 1234,
      capturadoEn: Date.UTC(2026, 8, 15, 22, 3, 9),
      modificadoEn: 1_700_000_000_000,
    });
  });

  it('sin fecha en el nombre usa la modificación', () => {
    expect(elementoDeArchivo({ nombre: 'raro.lcb', bytes: 1, modificadoEn: 5 }).capturadoEn).toBe(5);
  });
});

describe('decidirCorrida', () => {
  it('sin passphrase no hay nada que hacer, y se dice', () => {
    expect(decidirCorrida({ hayPassphrase: false, hayCambios: true, archivosSinSubir: 0 })).toBe('sin_passphrase');
  });

  it('con cambios se arma un respaldo nuevo (aunque quede uno viejo sin subir: lo nuevo lo reemplaza)', () => {
    expect(decidirCorrida({ hayPassphrase: true, hayCambios: true, archivosSinSubir: 1 })).toBe('armar');
  });

  it('sin cambios pero con un archivo sin subir, solo se sube', () => {
    expect(decidirCorrida({ hayPassphrase: true, hayCambios: false, archivosSinSubir: 1 })).toBe('solo_subir');
  });

  it('sin cambios y todo subido: al día', () => {
    expect(decidirCorrida({ hayPassphrase: true, hayCambios: false, archivosSinSubir: 0 })).toBe('al_dia');
  });
});

describe('fraseDeEstado', () => {
  const AHORA = Date.UTC(2026, 8, 15, 22, 0, 0);
  const HORA = 3_600_000;
  const base = { ...ESTADO_INICIAL };

  it('sin passphrase invita a crearla', () => {
    expect(fraseDeEstado({ ...base, decision: 'sin_passphrase' }, AHORA)).toEqual({
      titulo: 'Sin respaldo',
      detalle: 'Creá una passphrase para respaldar tus chats.',
      alerta: true,
    });
  });

  it('con un respaldo subido dice hace cuánto y cuánto pesa', () => {
    const estado = { ...base, ultimoRespaldoEn: AHORA - 2 * HORA, bytesDelUltimo: 1_200_000, decision: 'al_dia' as const };

    expect(fraseDeEstado(estado, AHORA)).toEqual({ titulo: 'Respaldado hace 2 h', detalle: '1,2 MB en la mini', alerta: false });
  });

  it('si se detuvo por wifi lo dice, sin alarmar', () => {
    const estado = { ...base, ultimoRespaldoEn: AHORA - HORA, bytesDelUltimo: 10, decision: 'armar' as const, detenidoPor: 'sin_wifi' as const };

    expect(fraseDeEstado(estado, AHORA)).toMatchObject({ detalle: 'Esperando wifi', alerta: false });
  });

  /** Dos días sin respaldar con cambios pendientes: el respaldo dejó de andar y hay que decirlo. */
  it('más de 48 h sin subir con algo pendiente es alerta', () => {
    const estado = { ...base, ultimoRespaldoEn: AHORA - 50 * HORA, bytesDelUltimo: 10, decision: 'armar' as const, detenidoPor: 'sin_carga' as const };

    expect(fraseDeEstado(estado, AHORA).alerta).toBe(true);
  });

  it('un fallo se muestra tal cual', () => {
    const estado = { ...base, ultimoRespaldoEn: AHORA - HORA, bytesDelUltimo: 10, fallo: 'El disco no está.' };

    expect(fraseDeEstado(estado, AHORA)).toMatchObject({ detalle: 'El disco no está.', alerta: true });
  });

  it('con passphrase pero sin haber subido nunca, lo dice', () => {
    expect(fraseDeEstado({ ...base, decision: 'armar' }, AHORA)).toMatchObject({ titulo: 'Todavía sin respaldo' });
  });
});
