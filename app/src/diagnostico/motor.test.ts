import { describe, expect, it } from 'vitest';
import { agregar, entradaDeError, esEntrada, MAX_ENTRADAS, tocaEnviar, type EntradaDiagnostico } from './motor';

const perf = (op: string, cuando = 1): EntradaDiagnostico => ({ tipo: 'perf', cuando, op, ms: 10 });

/**
 * El diagnóstico a LilaStore (rn-app-loop §10, patrón de Lilafotos): un buffer
 * rotativo de errores y tiempos que se sube solo. El motor es puro; el resto
 * (AsyncStorage, red, AppState) vive en `diagnostico.ts`.
 */
describe('agregar (buffer rotativo)', () => {
  it('agrega al final', () => {
    const resultado = agregar([perf('a')], perf('b'));
    expect(resultado.map((e) => (e.tipo === 'perf' ? e.op : ''))).toEqual(['a', 'b']);
  });

  it('recorta a las últimas `max`, tirando lo más viejo', () => {
    const base = Array.from({ length: 5 }, (_, i) => perf(`op${i}`, i));

    const resultado = agregar(base, perf('nuevo', 99), 3);

    expect(resultado.map((e) => (e.tipo === 'perf' ? e.op : ''))).toEqual(['op3', 'op4', 'nuevo']);
  });

  it('no muta el buffer original', () => {
    const base = [perf('a')];
    agregar(base, perf('b'));
    expect(base).toHaveLength(1);
  });

  it('el tope por defecto es MAX_ENTRADAS', () => {
    const base = Array.from({ length: MAX_ENTRADAS }, (_, i) => perf(`op${i}`, i));

    const resultado = agregar(base, perf('ultimo', 999));

    expect(resultado).toHaveLength(MAX_ENTRADAS);
    expect(resultado[0]).toMatchObject({ op: 'op1' });
  });
});

describe('entradaDeError', () => {
  it('toma message y stack de un Error', () => {
    const entrada = entradaDeError(new Error('se rompió'), 'chat', 123);
    expect(entrada).toMatchObject({ tipo: 'error', cuando: 123, mensaje: 'se rompió', origen: 'chat' });
    expect(typeof entrada.stack).toBe('string');
  });

  it('un valor que no es Error se vuelve texto', () => {
    expect(entradaDeError('cualquier cosa')).toMatchObject({ mensaje: 'cualquier cosa' });
    expect(entradaDeError(null).tipo).toBe('error');
  });

  it('acota el mensaje largo: no se guardan novelas', () => {
    expect(entradaDeError(new Error('x'.repeat(2000))).mensaje.length).toBeLessThanOrEqual(500);
  });

  /** Un mensaje de error puede traer un JWT o un teléfono pegado: se tachan. */
  it('tacha tokens y teléfonos del mensaje', () => {
    const entrada = entradaDeError(
      new Error('401 con eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123 para 902049935')
    );
    expect(entrada.mensaje).not.toContain('eyJhbGci');
    expect(entrada.mensaje).not.toContain('902049935');
  });

  it('sin origen no mete la clave', () => {
    expect('origen' in entradaDeError(new Error('x'))).toBe(false);
  });
});

describe('esEntrada', () => {
  it('acepta errores y tiempos, rechaza basura de un log corrupto', () => {
    expect(esEntrada(perf('a'))).toBe(true);
    expect(esEntrada({ tipo: 'error', cuando: 1, mensaje: 'x' })).toBe(true);
    expect(esEntrada({ tipo: 'otro' })).toBe(false);
    expect(esEntrada(null)).toBe(false);
  });
});

describe('tocaEnviar', () => {
  it('con algo acumulado y pasado el mínimo: sí', () => {
    expect(tocaEnviar({ ahora: 120_000, ultimoEnvio: 0, cantidad: 3 })).toBe(true);
  });

  it('sin nada acumulado: no (un POST vacío es gasto puro)', () => {
    expect(tocaEnviar({ ahora: 120_000, ultimoEnvio: 0, cantidad: 0 })).toBe(false);
  });

  it('antes del minuto desde el último: no (alternar de app no spamea)', () => {
    expect(tocaEnviar({ ahora: 30_000, ultimoEnvio: 0, cantidad: 3 })).toBe(false);
  });
});
