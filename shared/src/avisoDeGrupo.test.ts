import { describe, expect, it } from 'vitest';
import { esAvisoDestacado, textoDeAviso } from './avisoDeGrupo.js';

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

/**
 * Cuando el aviso es SOBRE mí (FL9d): «QA Ana te sacó del grupo», no «QA Ana
 * sacó a 902049935» —mi propio número, que es lo que se veía—.
 */
describe('textoDeAviso — a mí', () => {
  const base = { quien: 'Ana', esMio: false, aQuien: '902049935', aMi: true };

  it('sacar, sumar y nombrar admin van en segunda persona', () => {
    expect(textoDeAviso({ ...base, evento: 'saco' })).toBe('Ana te sacó del grupo');
    expect(textoDeAviso({ ...base, evento: 'sumo' })).toBe('Ana te agregó');
    expect(textoDeAviso({ ...base, evento: 'admin' })).toBe('Ana te nombró admin');
    expect(textoDeAviso({ ...base, evento: 'admin-auto' })).toBe('Quedaste como admin del grupo');
  });

  it('sin `aMi` sigue como antes', () => {
    expect(textoDeAviso({ ...base, aMi: false, evento: 'saco' })).toBe('Ana sacó a 902049935');
  });
});

describe('textoDeAviso — fijó un mensaje (19/10)', () => {
  it('en segunda persona si lo hice yo', () => {
    expect(textoDeAviso({ quien: 'Mamá', esMio: false, evento: 'fijo' })).toBe('Mamá fijó un mensaje');
    expect(textoDeAviso({ quien: 'Yo', esMio: true, evento: 'fijo' })).toBe('Fijaste un mensaje');
  });
});

describe('textoDeAviso — descripción (20/10)', () => {
  it('dice quién cambió o borró la descripción', () => {
    expect(textoDeAviso({ evento: 'descripcion', quien: 'Ana', esMio: false })).toBe('Ana cambió la descripción del grupo');
    expect(textoDeAviso({ evento: 'descripcion', quien: 'Ana', esMio: true })).toBe('Cambiaste la descripción del grupo');
    expect(textoDeAviso({ evento: 'descripcion', quien: 'Ana', esMio: false, valor: 'borrada' })).toBe('Ana borró la descripción del grupo');
  });
});

/** José, 20/10: «cuando hay un recordatorio o un evento, ¿no debería aparecer también en el chat?». */
describe('textoDeAviso — recordatorio y evento que suenan', () => {
  it('el recordatorio dice qué es, no quién lo creó', () => {
    expect(textoDeAviso({ evento: 'recordatorio-suena', quien: 'Ana', esMio: false, valor: 'Llamar al laboratorio' })).toBe('⏰ Recordatorio: Llamar al laboratorio');
    expect(textoDeAviso({ evento: 'recordatorio-suena', quien: 'Ana', esMio: true, valor: 'Llamar al laboratorio' })).toBe('⏰ Recordatorio: Llamar al laboratorio');
  });
  it('el evento dice cuánto falta', () => {
    expect(textoDeAviso({ evento: 'evento-pronto', quien: 'Ana', esMio: false, valor: 'Vaciado de losa · empieza en 30 minutos' })).toBe('📅 Vaciado de losa · empieza en 30 minutos');
  });
  it('sin título no hay aviso', () => {
    expect(textoDeAviso({ evento: 'recordatorio-suena', quien: 'Ana', esMio: false })).toBe('');
  });
});

describe('esAvisoDestacado', () => {
  it('solo el recordatorio que suena y el evento que se acerca', () => {
    expect(esAvisoDestacado('recordatorio-suena')).toBe(true);
    expect(esAvisoDestacado('evento-pronto')).toBe(true);
    expect(esAvisoDestacado('nombre')).toBe(false);
    expect(esAvisoDestacado(undefined)).toBe(false);
  });
});
