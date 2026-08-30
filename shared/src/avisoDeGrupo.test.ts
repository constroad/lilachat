import { describe, expect, it } from 'vitest';
import { textoDeAviso } from './avisoDeGrupo.js';

describe('textoDeAviso', () => {
  const wilson = { quien: 'Wilson', esMio: false };

  it('cambio de nombre', () => {
    expect(textoDeAviso({ ...wilson, evento: 'nombre', valor: 'Los originales' })).toBe(
      'Wilson cambió el nombre del grupo a «Los originales»'
    );
  });

  it('cambio de foto', () => {
    expect(textoDeAviso({ ...wilson, evento: 'foto' })).toBe('Wilson cambió la foto del grupo');
  });

  it('sumó a alguien', () => {
    expect(textoDeAviso({ ...wilson, evento: 'sumo', aQuien: 'Ana' })).toBe('Wilson agregó a Ana');
  });

  it('sacó a alguien', () => {
    expect(textoDeAviso({ ...wilson, evento: 'saco', aQuien: 'Ana' })).toBe('Wilson sacó a Ana');
  });

  it('se fue', () => {
    expect(textoDeAviso({ ...wilson, evento: 'salio' })).toBe('Wilson salió del grupo');
  });

  it('nombró admin', () => {
    expect(textoDeAviso({ ...wilson, evento: 'admin', aQuien: 'Ana' })).toBe(
      'Wilson nombró admin a Ana'
    );
  });

  it('dejó de ser admin', () => {
    expect(textoDeAviso({ ...wilson, evento: 'dejo-admin' })).toBe('Wilson dejó de ser admin');
  });

  /**
   * **La promoción automática no la hizo nadie.** Cuando se va el último admin,
   * el server promueve al miembro más antiguo: escribirlo como «Wilson nombró
   * admin a Ana» sería mentir sobre quién decidió qué.
   */
  it('la promoción automática no tiene autor', () => {
    expect(textoDeAviso({ quien: 'Wilson', esMio: false, evento: 'admin-auto', aQuien: 'Ana' })).toBe(
      'Ana quedó como admin del grupo'
    );
  });

  /**
   * En segunda persona cuando fui yo. «Vos agregaste» se lee raro y «Wilson
   * agregó a Wilson» —cuando Wilson soy yo— es directamente confuso.
   */
  describe('cuando lo hice yo', () => {
    const yo = { quien: 'Vos', esMio: true };

    it('nombre', () => {
      expect(textoDeAviso({ ...yo, evento: 'nombre', valor: 'Los originales' })).toBe(
        'Cambiaste el nombre del grupo a «Los originales»'
      );
    });

    it('foto', () => {
      expect(textoDeAviso({ ...yo, evento: 'foto' })).toBe('Cambiaste la foto del grupo');
    });

    it('sumar', () => {
      expect(textoDeAviso({ ...yo, evento: 'sumo', aQuien: 'Ana' })).toBe('Agregaste a Ana');
    });

    it('sacar', () => {
      expect(textoDeAviso({ ...yo, evento: 'saco', aQuien: 'Ana' })).toBe('Sacaste a Ana');
    });

    it('salir', () => {
      expect(textoDeAviso({ ...yo, evento: 'salio' })).toBe('Saliste del grupo');
    });

    it('nombrar admin', () => {
      expect(textoDeAviso({ ...yo, evento: 'admin', aQuien: 'Ana' })).toBe('Nombraste admin a Ana');
    });

    it('renunciar', () => {
      expect(textoDeAviso({ ...yo, evento: 'dejo-admin' })).toBe('Dejaste de ser admin');
    });
  });

  /**
   * **Un aviso sin los datos que necesita NO se inventa.** Si el evento llegó
   * incompleto —un cliente viejo, un dato perdido— es mejor no decir nada que
   * escribir «Wilson agregó a undefined» en la conversación de alguien.
   */
  it('sin el dato que necesita, no hay texto', () => {
    expect(textoDeAviso({ ...wilson, evento: 'sumo' })).toBe('');
    expect(textoDeAviso({ ...wilson, evento: 'nombre' })).toBe('');
    expect(textoDeAviso({ ...wilson, evento: 'admin' })).toBe('');
  });

  it('un evento desconocido tampoco se inventa', () => {
    expect(textoDeAviso({ ...wilson, evento: 'vino-de-una-version-nueva' })).toBe('');
  });
});
