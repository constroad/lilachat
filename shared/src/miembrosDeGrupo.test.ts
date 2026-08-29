import { describe, expect, it } from 'vitest';
import {
  decidirSalida,
  puedeAgregar,
  puedeSacar,
  type MiembroDeChat,
} from './miembrosDeGrupo.js';

const m = (userId: string, role: 'admin' | 'member' = 'member'): MiembroDeChat => ({
  userId,
  role,
});

describe('puedeAgregar', () => {
  const grupo = [m('yo', 'admin'), m('otro')];

  /**
   * **Cualquier miembro puede sumar, no solo el admin.** En un grupo de trabajo
   * chico, pedir permiso para sumar a un compañero convierte al admin en un
   * cuello de botella que nadie pidió.
   */
  it('un miembro común puede agregar', () => {
    expect(puedeAgregar({ quien: 'otro', miembros: grupo, aQuien: 'nuevo', esGrupo: true })).toEqual(
      { ok: true }
    );
  });

  it('quien no está en el grupo no agrega', () => {
    const r = puedeAgregar({ quien: 'ajeno', miembros: grupo, aQuien: 'nuevo', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/no estás/i);
  });

  it('no se agrega a alguien que ya está', () => {
    const r = puedeAgregar({ quien: 'yo', miembros: grupo, aQuien: 'otro', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/ya está/i);
  });

  /**
   * Sumar a un tercero a un 1:1 lo convertiría en grupo sin que los dos
   * originales lo decidan.
   */
  it('a un 1:1 no se suma gente', () => {
    const r = puedeAgregar({ quien: 'yo', miembros: grupo, aQuien: 'nuevo', esGrupo: false });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/de a dos/i);
  });
});

describe('puedeSacar', () => {
  const grupo = [m('admin1', 'admin'), m('comun'), m('admin2', 'admin')];

  it('un admin saca a un miembro común', () => {
    expect(
      puedeSacar({ quien: 'admin1', miembros: grupo, aQuien: 'comun', esGrupo: true })
    ).toEqual({ ok: true });
  });

  /**
   * **Sacar NO es simétrico con sumar.** Sumar lo puede hacer cualquiera; sacar,
   * solo un admin. Si un miembro común pudiera echar gente, cualquiera podría
   * vaciar el grupo —o echar al admin— y no habría a quién reclamarle.
   */
  it('un miembro común no saca a nadie', () => {
    const r = puedeSacar({ quien: 'comun', miembros: grupo, aQuien: 'admin1', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/admin/i);
  });

  /**
   * Entre admins no se echan. Si no, el grupo se decide por quién toca primero:
   * dos admins enojados terminan sacándose mutuamente en una carrera.
   */
  it('un admin no saca a otro admin', () => {
    const r = puedeSacar({ quien: 'admin1', miembros: grupo, aQuien: 'admin2', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/admin/i);
  });

  /** Sacarse a sí mismo es SALIR, y tiene su propia acción con sus reglas. */
  it('a uno mismo no se saca: se sale', () => {
    const r = puedeSacar({ quien: 'admin1', miembros: grupo, aQuien: 'admin1', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/salir/i);
  });

  it('no se saca a quien ya no está', () => {
    const r = puedeSacar({ quien: 'admin1', miembros: grupo, aQuien: 'ajeno', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/ya no está/i);
  });

  it('quien no está en el grupo no saca a nadie', () => {
    const r = puedeSacar({ quien: 'ajeno', miembros: grupo, aQuien: 'comun', esGrupo: true });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/no estás/i);
  });

  it('de un 1:1 no se saca a nadie', () => {
    const r = puedeSacar({
      quien: 'admin1',
      miembros: [m('admin1', 'admin'), m('comun')],
      aQuien: 'comun',
      esGrupo: false,
    });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/de a dos/i);
  });
});

describe('decidirSalida', () => {
  it('un miembro común se va y no cambia nada más', () => {
    expect(
      decidirSalida({ quien: 'otro', miembros: [m('yo', 'admin'), m('otro')], esGrupo: true })
    ).toEqual({ accion: 'salir', nuevoAdmin: null });
  });

  /**
   * **El caso que hay que resolver bien.** Si el último admin se va y no queda
   * ninguno, el grupo sigue existiendo pero nadie puede administrarlo nunca más:
   * un grupo huérfano que solo se arregla desde la base.
   *
   * Y NO se le impide salir: retener a alguien porque es el único admin es el
   * tipo de puerta cerrada que hace desinstalar una app.
   */
  it('si se va el último admin, promueve al miembro más antiguo', () => {
    expect(
      decidirSalida({
        quien: 'yo',
        miembros: [m('yo', 'admin'), m('vieja'), m('nueva')],
        esGrupo: true,
      })
    ).toEqual({ accion: 'salir', nuevoAdmin: 'vieja' });
  });

  /** Promover de más le daría permisos a alguien porque otro se fue. */
  it('si queda otro admin, no promueve a nadie', () => {
    expect(
      decidirSalida({
        quien: 'yo',
        miembros: [m('yo', 'admin'), m('otra', 'admin'), m('tercera')],
        esGrupo: true,
      })
    ).toEqual({ accion: 'salir', nuevoAdmin: null });
  });

  it('el último de todos deja el grupo vacío', () => {
    expect(decidirSalida({ quien: 'yo', miembros: [m('yo', 'admin')], esGrupo: true })).toEqual({
      accion: 'salir-y-vaciar',
    });
  });

  it('de un 1:1 no se sale', () => {
    const r = decidirSalida({ quien: 'yo', miembros: [m('yo'), m('otro')], esGrupo: false });

    expect(r.accion).toBe('imposible');
  });

  it('quien no está en el grupo no puede salir de él', () => {
    const r = decidirSalida({ quien: 'ajeno', miembros: [m('yo')], esGrupo: true });

    expect(r.accion).toBe('imposible');
  });
});
