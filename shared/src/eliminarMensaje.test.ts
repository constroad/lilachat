import { describe, expect, it } from 'vitest';
import { camposDeLapida, puedeEliminar, TEXTO_ELIMINADO } from './eliminarMensaje.js';

describe('puedeEliminar', () => {
  it('el autor puede borrar lo suyo', () => {
    expect(puedeEliminar({ yo: 'u1', autor: 'u1' })).toEqual({ permitido: true });
  });

  /**
   * **La regla que no puede vivir solo en la app.** Un cliente modificado se
   * saltea cualquier validación del teléfono; si esto no se niega en el server,
   * cualquiera puede vaciarle la conversación a otro.
   */
  it('nadie borra los mensajes de otro', () => {
    const decision = puedeEliminar({ yo: 'u2', autor: 'u1' });

    expect(decision.permitido).toBe(false);
    expect(decision.permitido === false && decision.motivo).toContain('tus propios');
  });

  it('borrar dos veces no se permite, y lo explica', () => {
    const decision = puedeEliminar({ yo: 'u1', autor: 'u1', yaEliminado: true });

    expect(decision.permitido).toBe(false);
    expect(decision.permitido === false && decision.motivo).toContain('ya estaba');
  });

  /** Un «no» sin motivo se lee como un bug de la app. */
  it('todo rechazo trae un motivo mostrable', () => {
    for (const caso of [
      { yo: 'u2', autor: 'u1' },
      { yo: 'u1', autor: 'u1', yaEliminado: true },
    ]) {
      const decision = puedeEliminar(caso);
      expect(decision.permitido === false && decision.motivo.length).toBeGreaterThan(10);
    }
  });
});

describe('camposDeLapida', () => {
  const lapida = camposDeLapida('2026-08-27T23:00:00.000Z');

  /**
   * **Se vacía de verdad.** Una bandera que conserva el contenido es una
   * mentira: el server guarda las conversaciones en claro, así que cualquiera
   * con acceso a la base seguiría leyendo lo «borrado».
   */
  it('borra el texto, el sobre cifrado y el archivo', () => {
    expect(lapida.body).toBeUndefined();
    expect(lapida.envelope).toBeUndefined();
    expect(lapida.media).toBeUndefined();
  });

  it('deja la marca de cuándo se borró', () => {
    expect(lapida.deletedAt).toBe('2026-08-27T23:00:00.000Z');
  });

  /**
   * El `seq` NO se toca: sostiene el orden y la sincronización por cursor.
   * Borrarlo dejaría huecos que los clientes leen como mensajes por descargar.
   */
  it('no toca los campos que sostienen el orden', () => {
    expect(Object.keys(lapida).sort()).toEqual(['body', 'deletedAt', 'envelope', 'media']);
  });
});

describe('TEXTO_ELIMINADO', () => {
  /**
   * Queda una LÁPIDA y no un hueco: si el mensaje desapareciera sin rastro, la
   * conversación del otro cambiaría de sentido —respuestas colgando de algo que
   * ya no está— sin que se entere.
   */
  it('dice que se eliminó, no queda vacío', () => {
    expect(TEXTO_ELIMINADO).toMatch(/elimin/i);
  });
});
