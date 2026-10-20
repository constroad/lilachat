import { describe, expect, it } from 'vitest';
import { accionesDeMensaje, planDeReenvio, accionesDeVarios, textoParaCopiar } from './accionesDeMensaje.js';

/**
 * La pulsación larga (FL9, auditoría §46.2: solo había «Eliminar», de a uno,
 * sin confirmar, y aparecía en mensajes ajenos).
 */
describe('accionesDeMensaje', () => {
  const base = { mio: true, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: true };

  it('un texto propio: todo', () => {
    expect(accionesDeMensaje(base)).toEqual({ responder: true, copiar: true, reenviar: true, editar: true, info: true, eliminarParaTodos: true, eliminarParaMi: true, fijar: null, hilo: true, destacar: 'destacar' });
  });

  it('uno ajeno: no se borra para todos, pero sí para mí', () => {
    expect(accionesDeMensaje({ ...base, mio: false })).toMatchObject({ eliminarParaTodos: false, eliminarParaMi: true });
  });

  it('una foto sin pie: no hay qué copiar, pero se reenvía', () => {
    // Auditoría (19/10): una foto se reenvía (el server comparte el archivo), como WhatsApp.
    expect(accionesDeMensaje({ ...base, conTexto: false, esMedia: true })).toMatchObject({ copiar: false, reenviar: true, responder: true });
  });

  it('una lápida: solo borrarla de mi vista', () => {
    expect(accionesDeMensaje({ ...base, eliminado: true })).toEqual({ responder: false, copiar: false, reenviar: false, editar: false, info: false, eliminarParaTodos: false, eliminarParaMi: true, fijar: null, hilo: false, destacar: null });
  });

  /** «Info» (FL9): quién lo leyó. Solo de lo propio, como WhatsApp. */
  it('la info es de los mensajes propios', () => {
    expect(accionesDeMensaje(base).info).toBe(true);
    expect(accionesDeMensaje({ ...base, mio: false }).info).toBe(false);
  });

  it('chat secreto: no se reenvía (saldría en claro a otro chat)', () => {
    expect(accionesDeMensaje({ ...base, chatSecreto: true })).toMatchObject({ reenviar: false, copiar: true });
  });
});

describe('accionesDeMensaje — editar (José, 17/10/2026)', () => {
  const base = { mio: true, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: true };

  it('se ofrece solo si el motor compartido lo permite (propio, texto, < 15 min)', () => {
    expect(accionesDeMensaje(base).editar).toBe(true);
    expect(accionesDeMensaje({ ...base, editable: false }).editar).toBe(false);
  });
});

/**
 * Varios mensajes a la vez (FL9; auditoría §46.2: se elegía de a uno), como
 * WhatsApp: responder y editar son de UNO; copiar, reenviar y eliminar valen
 * para todos si valen para cada uno.
 */
describe('accionesDeVarios', () => {
  const texto = (mio: boolean) =>
    accionesDeMensaje({ mio, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: mio });
  const foto = accionesDeMensaje({ mio: true, eliminado: false, conTexto: false, esMedia: true, chatSecreto: false, editable: false });

  it('con uno solo, las de ese mensaje', () => {
    expect(accionesDeVarios([texto(true)])).toEqual(texto(true));
  });

  it('con varios: ni responder ni editar; copiar y reenviar si todos tienen texto', () => {
    const acciones = accionesDeVarios([texto(true), texto(false)]);

    expect(acciones).toMatchObject({ responder: false, editar: false, info: false, copiar: true, reenviar: true, eliminarParaMi: true });
    expect(accionesDeVarios([texto(true), foto]).copiar).toBe(false);
  });

  it('«para todos» solo si todos son míos', () => {
    expect(accionesDeVarios([texto(true), foto]).eliminarParaTodos).toBe(true);
    expect(accionesDeVarios([texto(true), texto(false)]).eliminarParaTodos).toBe(false);
  });
});

describe('textoParaCopiar', () => {
  it('uno debajo del otro, en el orden de la conversación', () => {
    expect(textoParaCopiar([{ seq: 7, body: 'después' }, { seq: 3, body: 'antes' }])).toBe('antes\ndespués');
  });
});

describe('accionesDeMensaje — fijar (19/10)', () => {
  const base = { mio: false, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: false };
  it('con permiso ofrece fijar, o desfijar si ya está', () => {
    expect(accionesDeMensaje({ ...base, puedeFijar: true }).fijar).toBe('fijar');
    expect(accionesDeMensaje({ ...base, puedeFijar: true, fijado: true }).fijar).toBe('desfijar');
  });
  it('sin permiso, borrado o con varios elegidos, no', () => {
    expect(accionesDeMensaje(base).fijar).toBeNull();
    expect(accionesDeMensaje({ ...base, puedeFijar: true, eliminado: true }).fijar).toBeNull();
    const uno = accionesDeMensaje({ ...base, puedeFijar: true });
    expect(accionesDeVarios([uno, uno]).fijar).toBeNull();
  });
});

/** «Destacados» (José aprobó el 20/10): la estrella personal, también de varios a la vez. */
describe('accionesDeMensaje — destacar', () => {
  const base = { mio: false, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: false };
  it('destacar, o quitar si ya está destacado', () => {
    expect(accionesDeMensaje(base).destacar).toBe('destacar');
    expect(accionesDeMensaje({ ...base, destacado: true }).destacar).toBe('quitar');
  });
  it('no en lo borrado ni en un chat secreto', () => {
    expect(accionesDeMensaje({ ...base, eliminado: true }).destacar).toBeNull();
    expect(accionesDeMensaje({ ...base, chatSecreto: true }).destacar).toBeNull();
  });
  it('con varios: quitar si TODOS ya están; si no, destacar los que falten', () => {
    const destacado = accionesDeMensaje({ ...base, destacado: true });
    const suelto = accionesDeMensaje(base);
    expect(accionesDeVarios([destacado, destacado]).destacar).toBe('quitar');
    expect(accionesDeVarios([destacado, suelto]).destacar).toBe('destacar');
    expect(accionesDeVarios([suelto, accionesDeMensaje({ ...base, eliminado: true })]).destacar).toBeNull();
  });
});

/** Auditoría (19/10): reenviar fotos y archivos, no solo texto. */
describe('planDeReenvio', () => {
  it('en orden: el texto viaja como texto; la foto y el archivo, por referencia (con su pie)', () => {
    const plan = planDeReenvio([
      { chatId: 'c', seq: 5, body: 'mira esto', media: { url: 'x' } },
      { chatId: 'c', seq: 3, body: ' hola ' },
      { chatId: 'c', seq: 4 },
    ]);
    expect(plan).toEqual([
      { tipo: 'texto', texto: 'hola' },
      { tipo: 'mensaje', chatId: 'c', seq: 5 },
    ]);
  });
});

/** E3 (20/10): responder en hilo. */
describe('responder en hilo', () => {
  const base = { mio: false, eliminado: false, conTexto: true, esMedia: false, chatSecreto: false, editable: false };
  it('un mensaje vivo de un chat común abre su hilo; uno secreto o una respuesta de hilo, no', () => {
    expect(accionesDeMensaje(base).hilo).toBe(true);
    expect(accionesDeMensaje({ ...base, chatSecreto: true }).hilo).toBe(false);
    expect(accionesDeMensaje({ ...base, esRespuestaDeHilo: true }).hilo).toBe(false);
    expect(accionesDeMensaje({ ...base, eliminado: true }).hilo).toBe(false);
  });

  it('con varios elegidos, no', () => {
    expect(accionesDeVarios([accionesDeMensaje(base), accionesDeMensaje(base)]).hilo).toBe(false);
  });
});

