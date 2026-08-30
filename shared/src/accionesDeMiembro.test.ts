import { describe, expect, it } from 'vitest';
import { accionesDeMiembro } from './accionesDeMiembro.js';
import type { MiembroDeChat } from './miembrosDeGrupo.js';

const m = (userId: string, role: 'admin' | 'member' = 'member'): MiembroDeChat => ({
  userId,
  role,
});

const de = (quien: string, aQuien: string, miembros: MiembroDeChat[]) =>
  accionesDeMiembro({ quien, aQuien, miembros, esGrupo: true });

describe('accionesDeMiembro', () => {
  const grupo = [m('yo', 'admin'), m('comun'), m('otroAdmin', 'admin')];

  it('sobre un miembro común, siendo admin: nombrarlo o sacarlo', () => {
    expect(de('yo', 'comun', grupo)).toEqual(['hacer-admin', 'sacar']);
  });

  /**
   * **La fila de otro admin no ofrece NADA.** Ni sacarlo ni bajarlo: las dos
   * cosas se las tiene que hacer él. Un menú con opciones que siempre fallan
   * enseña que los botones de esta app no responden.
   */
  it('sobre otro admin no hay nada que ofrecer', () => {
    expect(de('yo', 'otroAdmin', grupo)).toEqual([]);
  });

  it('en mi propia fila, solo dejar de ser admin', () => {
    expect(de('yo', 'yo', grupo)).toEqual(['dejar-admin']);
  });

  /** Siendo el único admin no se puede renunciar: primero hay que nombrar a otro. */
  it('el único admin no tiene ninguna acción sobre sí mismo', () => {
    expect(de('yo', 'yo', [m('yo', 'admin'), m('comun')])).toEqual([]);
  });

  /**
   * Un miembro común no reparte roles ni echa gente, así que su menú está
   * vacío en TODAS las filas — incluida la propia.
   */
  it('un miembro común no tiene acciones sobre nadie', () => {
    expect(de('comun', 'yo', grupo)).toEqual([]);
    expect(de('comun', 'otroAdmin', grupo)).toEqual([]);
    expect(de('comun', 'comun', grupo)).toEqual([]);
  });

  it('en un 1:1 no hay acciones de miembro', () => {
    expect(
      accionesDeMiembro({
        quien: 'yo',
        aQuien: 'comun',
        miembros: [m('yo', 'admin'), m('comun')],
        esGrupo: false,
      })
    ).toEqual([]);
  });
});
