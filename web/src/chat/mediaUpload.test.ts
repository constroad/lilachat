import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerRespuesta, subirArchivo } from './mediaUpload';

describe('leerRespuesta', () => {
  it('201 con el mensaje confirmado', () => {
    const r = leerRespuesta(201, JSON.stringify({ message: { seq: 7, clientKey: 'k', chatId: 'c', senderId: 'yo', kind: 'image', at: 'x' } }));
    expect(r).toMatchObject({ ok: true, mensaje: { seq: 7 } });
  });

  it('200 sin mensaje (server viejo): ok igual', () => {
    expect(leerRespuesta(200, '{}')).toEqual({ ok: true, mensaje: undefined });
  });

  it('503 se reintenta; 413 y 502 no; el motivo del server viaja', () => {
    expect(leerRespuesta(503, '{"message":"Ahora no"}')).toEqual({ ok: false, message: 'Ahora no', reintentable: true });
    expect(leerRespuesta(413, '{"message":"Pesa más de 25 MB"}')).toEqual({ ok: false, message: 'Pesa más de 25 MB', reintentable: false });
    expect(leerRespuesta(502, 'no json')).toEqual({ ok: false, message: 'No se pudo subir el archivo.', reintentable: false });
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Un XHR de mentira: guarda lo que se mandó y contesta 201. */
function xhrFalso(enviados: FormData[], cabeceras: Record<string, string>) {
  return class {
    upload = { onprogress: null as null | ((evento: { lengthComputable: boolean; loaded: number; total: number }) => void) };
    status = 0;
    responseText = '';
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    open() {}
    setRequestHeader(nombre: string, valor: string) {
      cabeceras[nombre] = valor;
    }
    send(cuerpo: FormData) {
      enviados.push(cuerpo);
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
      this.status = 201;
      this.responseText = '{}';
      this.onload?.();
    }
  };
}

/** Lo que manda la web tiene que ser lo que el server lee (`server/src/mediaRoutes.ts`). */
describe('subirArchivo', () => {
  it('manda la clave de la cola, pie, medidas, duración y la onda separada por comas, y avisa el progreso', async () => {
    const enviados: FormData[] = [];
    const cabeceras: Record<string, string> = {};
    vi.stubGlobal('XMLHttpRequest', xhrFalso(enviados, cabeceras));
    const progreso: number[] = [];

    const resultado = await subirArchivo({
      jwt: 'j',
      mime: 'audio/webm',
      chatId: 'c1',
      clientKey: 'clave-1',
      archivo: new File(['abc'], 'nota.webm', { type: 'audio/webm' }),
      nombre: 'nota.webm',
      caption: ' hola ',
      width: 800,
      height: 600,
      durationMs: 4200,
      onda: [10, 50, 90],
      onProgreso: (razon) => progreso.push(razon),
    });

    expect(resultado).toEqual({ ok: true, mensaje: undefined });
    const datos = enviados[0]!;
    expect(datos.get('clientKey')).toBe('clave-1');
    expect(datos.get('caption')).toBe(' hola ');
    expect([datos.get('width'), datos.get('height'), datos.get('durationMs')]).toEqual(['800', '600', '4200']);
    expect(datos.get('onda')).toBe('10,50,90');
    expect(cabeceras.Authorization).toBe('Bearer j');
    expect(progreso).toEqual([0.5]);
  });

  it('un archivo vacío no sale: lo corta la misma validación del server', async () => {
    const enviados: FormData[] = [];
    vi.stubGlobal('XMLHttpRequest', xhrFalso(enviados, {}));

    const resultado = await subirArchivo({ jwt: 'j', mime: 'text/plain', chatId: 'c1', clientKey: 'k', archivo: new File([], 'vacio.txt', { type: 'text/plain' }), nombre: 'vacio.txt', onProgreso: () => undefined });

    expect(resultado).toMatchObject({ ok: false, reintentable: false });
    expect(enviados).toHaveLength(0);
  });
});
