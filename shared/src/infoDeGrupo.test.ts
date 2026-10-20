import { describe, expect, it } from 'vitest';
import { MAX_DESCRIPCION_DE_GRUPO, normalizarDescripcion, normalizarNombreDeGrupo, puedeEditarInfo } from './infoDeGrupo.js';
import type { MiembroDeChat } from './miembrosDeGrupo.js';

const m = (userId: string, role: 'admin' | 'member' = 'member'): MiembroDeChat => ({
  userId,
  role,
});

describe('puedeEditarInfo', () => {
  const grupo = [m('admin1', 'admin'), m('comun')];

  /**
   * **Cualquier miembro edita el nombre y la foto**, igual que sumar gente y
   * que WhatsApp por defecto. Es información compartida del grupo, se ve al
   * instante y se arregla igual de rápido; pedir un admin para corregir un
   * typo lo convierte en un cuello de botella que nadie pidió.
   */
  it('un miembro común puede', () => {
    expect(puedeEditarInfo({ quien: 'comun', miembros: grupo, esGrupo: true })).toEqual({ ok: true });
  });

  it('quien no está en el grupo no', () => {
    const r = puedeEditarInfo({ quien: 'ajeno', miembros: grupo, esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/no estás/i);
  });

  /**
   * Un 1:1 no tiene nombre ni foto PROPIOS: muestra los de la otra persona.
   * Dejar editarlos sería dejarte renombrar a alguien en su propio chat.
   */
  it('un 1:1 no tiene nombre ni foto propios', () => {
    const r = puedeEditarInfo({ quien: 'comun', miembros: grupo, esGrupo: false });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/de a dos/i);
  });
});

describe('normalizarNombreDeGrupo', () => {
  it('recorta los espacios de los bordes', () => {
    expect(normalizarNombreDeGrupo('  Los originales  ')).toEqual({
      ok: true,
      nombre: 'Los originales',
    });
  });

  /**
   * **Los saltos de línea y los espacios de más se colapsan.** Un nombre con
   * un `\n` rompe la fila de la lista de chats, y «Los    originales» se ve
   * como un error de la app, no del que lo escribió.
   */
  it('colapsa saltos de línea y espacios repetidos', () => {
    expect(normalizarNombreDeGrupo('Los\n\n  originales')).toEqual({
      ok: true,
      nombre: 'Los originales',
    });
  });

  it('vacío o solo espacios no es un nombre', () => {
    for (const valor of ['', '   ', '\n', null, undefined, 42]) {
      const r = normalizarNombreDeGrupo(valor);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.motivo).toMatch(/nombre/i);
    }
  });

  /** El tope es el mismo que muestra el contador al crear el grupo. */
  it('no pasa de 25 caracteres', () => {
    const r = normalizarNombreDeGrupo('a'.repeat(26));

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/25/);
  });

  it('25 justos entran', () => {
    expect(normalizarNombreDeGrupo('a'.repeat(25))).toEqual({ ok: true, nombre: 'a'.repeat(25) });
  });

  /** Emojis y tildes cuentan como los escribió quien los puso. */
  it('acepta tildes y emojis', () => {
    expect(normalizarNombreDeGrupo('Familia Zamora 🎉')).toEqual({
      ok: true,
      nombre: 'Familia Zamora 🎉',
    });
  });
});

/** La descripción larga del grupo (José, 20/10: «como Slack, con textos grandes»). */
describe('normalizarDescripcion', () => {
  it('conserva los saltos de línea (son párrafos) y recorta los bordes', () => {
    expect(normalizarDescripcion('  Reglas:\n1) Fotos antes de las 6\n2) Pedidos con 24 h  ')).toEqual({ ok: true, descripcion: 'Reglas:\n1) Fotos antes de las 6\n2) Pedidos con 24 h' });
  });
  it('más de una línea en blanco seguida se colapsa en una', () => {
    expect(normalizarDescripcion('Uno\n\n\n\nDos')).toEqual({ ok: true, descripcion: 'Uno\n\nDos' });
  });
  it('vacía = sin descripción (borrarla)', () => {
    expect(normalizarDescripcion('   \n ')).toEqual({ ok: true, descripcion: '' });
  });
  it('hasta 2048 caracteres visibles, como WhatsApp; más, se rechaza con el tope', () => {
    expect(MAX_DESCRIPCION_DE_GRUPO).toBe(2048);
    expect(normalizarDescripcion('a'.repeat(2048)).ok).toBe(true);
    expect(normalizarDescripcion('😀'.repeat(2048)).ok).toBe(true);
    expect(normalizarDescripcion('a'.repeat(2049))).toEqual({ ok: false, motivo: 'La descripción no puede pasar de 2048 caracteres.' });
  });
  it('lo que no es texto se rechaza', () => {
    expect(normalizarDescripcion(42)).toEqual({ ok: false, motivo: 'La descripción tiene que ser un texto.' });
  });
});
