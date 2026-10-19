import { afterEach, describe, expect, it, vi } from 'vitest';
import { subirArchivo } from './mediaUpload';

afterEach(() => vi.unstubAllGlobals());

/** Lo que manda la web tiene que ser lo que el server lee (`server/src/mediaRoutes.ts`). */
describe('subirArchivo', () => {
  it('manda pie, medidas, duración y la onda separada por comas', async () => {
    let enviado: FormData | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => ((enviado = init.body as FormData), new Response('{}', { status: 201 }))));

    const resultado = await subirArchivo({
      jwt: 'j',
      chatId: 'c1',
      file: new File(['abc'], 'nota.webm', { type: 'audio/webm' }),
      caption: ' hola ',
      width: 800,
      height: 600,
      durationMs: 4200,
      onda: [10, 50, 90],
    });

    expect(resultado).toEqual({ ok: true });
    const datos = enviado as unknown as FormData;
    expect(datos.get('caption')).toBe(' hola ');
    expect([datos.get('width'), datos.get('height'), datos.get('durationMs')]).toEqual(['800', '600', '4200']);
    expect(datos.get('onda')).toBe('10,50,90');
  });

  it('un archivo vacío no sale: lo corta la misma validación del server', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const resultado = await subirArchivo({ jwt: 'j', chatId: 'c1', file: new File([], 'vacio.txt', { type: 'text/plain' }) });

    expect(resultado).toMatchObject({ ok: false, reintentable: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
