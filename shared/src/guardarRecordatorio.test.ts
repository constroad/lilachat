import { describe, expect, it } from 'vitest';
import { crearRecordatorio, editarRecordatorio, type PasosDeCreacion, type PasosDeEdicion } from './guardarRecordatorio.js';

/**
 * E2E del 19/10: la tarjeta del grupo salió sin la imagen, porque el chat se
 * publicaba al crear y la imagen llegaba después. Con imagen: crear sin
 * publicar → subir → publicar, y publicar AUNQUE la imagen falle.
 */
function pasos(sobre: Partial<PasosDeCreacion> = {}) {
  const llamadas: string[] = [];
  const base: PasosDeCreacion = {
    crear: async ({ publicar }) => {
      llamadas.push(`crear:${publicar === false ? 'sin-publicar' : 'publicando'}`);
      return { ok: true, id: 'r1' };
    },
    subirImagen: async (id) => {
      llamadas.push(`subir:${id}`);
      return { ok: true };
    },
    publicar: async (id) => {
      llamadas.push(`publicar:${id}`);
      return { ok: true };
    },
  };
  return { llamadas, pasos: { ...base, ...sobre } };
}

describe('crearRecordatorio', () => {
  it('sin imagen se publica al crear, en un solo paso', async () => {
    const { llamadas, pasos: p } = pasos();

    const resultado = await crearRecordatorio({ conImagen: false, delGrupo: true }, p);

    expect(resultado).toEqual({ ok: true });
    expect(llamadas).toEqual(['crear:publicando']);
  });

  it('con imagen en un grupo: crea sin publicar, sube y recién publica', async () => {
    const { llamadas, pasos: p } = pasos();

    await crearRecordatorio({ conImagen: true, delGrupo: true }, p);

    expect(llamadas).toEqual(['crear:sin-publicar', 'subir:r1', 'publicar:r1']);
  });

  it('si la imagen falla, publica igual y avisa que se guardó sin imagen', async () => {
    const { llamadas, pasos: p } = pasos({ subirImagen: async () => ({ ok: false, motivo: 'Muy pesada' }) });

    const resultado = await crearRecordatorio({ conImagen: true, delGrupo: true }, p);

    expect(llamadas).toEqual(['crear:sin-publicar', 'publicar:r1']);
    expect(resultado).toEqual({ ok: false, guardado: true, motivo: 'Se guardó, pero la imagen no subió: Muy pesada' });
  });

  it('si crear falla, no sube ni publica nada', async () => {
    const { llamadas, pasos: p } = pasos({ crear: async () => ({ ok: false, motivo: 'Solo los admins' }) });

    const resultado = await crearRecordatorio({ conImagen: true, delGrupo: true }, p);

    expect(llamadas).toEqual([]);
    expect(resultado).toEqual({ ok: false, guardado: false, motivo: 'Solo los admins' });
  });

  it('si publicar falla, lo dice: el recordatorio existe pero no salió en el chat', async () => {
    const { pasos: p } = pasos({ publicar: async () => ({ ok: false }) });

    const resultado = await crearRecordatorio({ conImagen: true, delGrupo: true }, p);

    expect(resultado).toEqual({ ok: false, guardado: true, motivo: 'Se guardó, pero no salió en el chat. Revisa tu conexión.' });
  });

  it('el personal con imagen no usa publicar: no tiene chat', async () => {
    const { llamadas, pasos: p } = pasos();

    await crearRecordatorio({ conImagen: true, delGrupo: false }, p);

    expect(llamadas).toEqual(['crear:publicando', 'subir:r1']);
  });
});

/** José, 19/10: «creé el recordatorio grupal y no hay cómo editarlo». */
describe('editarRecordatorio', () => {
  function pasosDeEdicion(sobre: Partial<PasosDeEdicion> = {}) {
    const llamadas: string[] = [];
    const base: PasosDeEdicion = {
      guardar: async () => {
        llamadas.push('guardar');
        return { ok: true };
      },
      subirImagen: async () => {
        llamadas.push('subir');
        return { ok: true };
      },
      quitarImagen: async () => {
        llamadas.push('quitar');
        return { ok: true };
      },
    };
    return { llamadas, pasos: { ...base, ...sobre } };
  }

  it('solo los campos: un paso', async () => {
    const { llamadas, pasos } = pasosDeEdicion();

    expect(await editarRecordatorio({ imagen: 'igual' }, pasos)).toEqual({ ok: true });
    expect(llamadas).toEqual(['guardar']);
  });

  it('con imagen nueva: guarda y la sube', async () => {
    const { llamadas, pasos } = pasosDeEdicion();

    await editarRecordatorio({ imagen: 'nueva' }, pasos);

    expect(llamadas).toEqual(['guardar', 'subir']);
  });

  it('quitando la que tenía: guarda y la quita', async () => {
    const { llamadas, pasos } = pasosDeEdicion();

    await editarRecordatorio({ imagen: 'quitar' }, pasos);

    expect(llamadas).toEqual(['guardar', 'quitar']);
  });

  it('si guardar falla, no toca la imagen', async () => {
    const { llamadas, pasos } = pasosDeEdicion({ guardar: async () => ({ ok: false, motivo: 'Esa hora ya pasó' }) });

    expect(await editarRecordatorio({ imagen: 'nueva' }, pasos)).toEqual({ ok: false, guardado: false, motivo: 'Esa hora ya pasó' });
    expect(llamadas).toEqual([]);
  });

  it('si la imagen falla, lo dice: los campos sí quedaron', async () => {
    const { pasos } = pasosDeEdicion({ subirImagen: async () => ({ ok: false, motivo: 'Muy pesada' }) });

    expect(await editarRecordatorio({ imagen: 'nueva' }, pasos)).toEqual({ ok: false, guardado: true, motivo: 'Se guardó, pero la imagen no subió: Muy pesada' });
  });
});
