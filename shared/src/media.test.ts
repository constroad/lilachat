import { describe, expect, it } from 'vitest';
import {
  dimensionValida,
  tamanoDeBurbuja,
  MAX_BYTES_BY_KIND,
  buildMediaPath,
  buildStorageName,
  formatBytes,
  mediaPreviewLabel,
  resolveMediaKind,
  validateMedia,
} from './media.js';

describe('resolveMediaKind', () => {
  it('clasifica por familia de mime, no por extensión', () => {
    expect(resolveMediaKind('image/heic')).toBe('image');
    expect(resolveMediaKind('video/quicktime')).toBe('video');
    expect(resolveMediaKind('application/pdf')).toBe('file');
  });

  it('un mime raro o vacío cae a archivo, no revienta', () => {
    expect(resolveMediaKind('')).toBe('file');
    expect(resolveMediaKind(undefined as unknown as string)).toBe('file');
  });
});

describe('validateMedia', () => {
  it('una foto normal pasa', () => {
    expect(validateMedia({ mimeType: 'image/jpeg', sizeBytes: 3_000_000 })).toEqual({
      ok: true,
      kind: 'image',
    });
  });

  /** El techo de imagen es alto porque la foto se guarda SIN recomprimir. */
  it('la foto grande entra: no recomprimimos como WhatsApp', () => {
    expect(validateMedia({ mimeType: 'image/jpeg', sizeBytes: 20 * 1024 * 1024 }).ok).toBe(true);
  });

  it('pasado el techo se rechaza diciendo el límite', () => {
    const result = validateMedia({ mimeType: 'image/jpeg', sizeBytes: MAX_BYTES_BY_KIND.image + 1 });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining('MB') });
  });

  it('un archivo vacío se rechaza antes de subir nada', () => {
    expect(validateMedia({ mimeType: 'image/jpeg', sizeBytes: 0 }).ok).toBe(false);
  });
});

describe('buildMediaPath', () => {
  /**
   * FUERA de `drive/`: bajo esa raíz los archivos salen en el explorador del
   * Portal, y un chat privado no se mezcla con los documentos de la empresa.
   */
  it('cuelga de apps/lilachat y NUNCA de drive', () => {
    const path = buildMediaPath('6a877438e0f771afb217d05a');

    expect(path).toBe('apps/lilachat/6a877438e0f771afb217d05a');
    expect(path.startsWith('drive')).toBe(false);
  });

  it('un chatId con rutas adentro se limpia (no se escapa del namespace)', () => {
    expect(buildMediaPath('../../etc/passwd')).toBe('apps/lilachat/etcpasswd');
  });

  it('un chatId que queda vacío es un error, no una ruta rara', () => {
    expect(() => buildMediaPath('///')).toThrow();
  });
});

describe('buildStorageName', () => {
  const at = new Date('2026-08-20T15:04:05.000Z');

  it('conserva la extensión: es lo que decide con qué app se abre', () => {
    expect(buildStorageName('foto vacaciones.JPG', 'image', at)).toMatch(/\.JPG$/);
  });

  it('limpia el nombre del usuario y descarta la ruta', () => {
    const name = buildStorageName('../../secreto.png', 'image', at);

    expect(name).not.toContain('/');
    expect(name).not.toContain('..');
  });

  it('sin extensión pone una por tipo', () => {
    expect(buildStorageName('captura', 'image', at)).toMatch(/\.jpg$/);
    expect(buildStorageName('clip', 'video', at)).toMatch(/\.mp4$/);
  });
});

describe('formatBytes y etiquetas', () => {
  it('formatea en la unidad que se entiende', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });

  it('la vista previa de la lista dice QUÉ llegó', () => {
    expect(mediaPreviewLabel('image')).toContain('Foto');
    expect(mediaPreviewLabel('video')).toContain('Video');
    expect(mediaPreviewLabel('file')).toContain('Archivo');
  });
});

/**
 * Las dimensiones de una foto o un video (FL9): la burbuja respeta su forma,
 * como WhatsApp, en vez del cuadrado de 220 recortado.
 */
describe('dimensionValida', () => {
  it('enteros positivos razonables; lo demás, nada', () => {
    expect(dimensionValida('4000')).toBe(4000);
    expect(dimensionValida(1080.6)).toBe(1081);
    expect(dimensionValida('-5')).toBeUndefined();
    expect(dimensionValida('abc')).toBeUndefined();
    expect(dimensionValida(0)).toBeUndefined();
    expect(dimensionValida(999_999)).toBeUndefined();
  });
});

describe('tamanoDeBurbuja', () => {
  it('apaisada: ancho máximo y el alto según su forma', () => {
    expect(tamanoDeBurbuja({ width: 4000, height: 3000 })).toEqual({ ancho: 240, alto: 180 });
  });

  it('vertical: alto máximo y el ancho según su forma', () => {
    expect(tamanoDeBurbuja({ width: 3000, height: 4000 })).toEqual({ ancho: 240, alto: 320 });
    expect(tamanoDeBurbuja({ width: 1000, height: 4000 })).toEqual({ ancho: 240, alto: 320 });
  });

  it('una tira muy baja no baja del mínimo; una muy angosta toma el marco vertical', () => {
    expect(tamanoDeBurbuja({ width: 4000, height: 200 })).toEqual({ ancho: 240, alto: 120 });
    expect(tamanoDeBurbuja({ width: 100, height: 4000 })).toEqual({ ancho: 240, alto: 320 });
  });

  it('sin dimensiones (mensajes viejos): el cuadrado de siempre', () => {
    expect(tamanoDeBurbuja({})).toEqual({ ancho: 220, alto: 220 });
  });

  // 25/10: a phone's portrait photo came out as a 148 dp sliver; it takes the full portrait frame and the image crops (cover).
  it('una foto vertical de teléfono no sale como una tira angosta: marco de 240×320', () => {
    expect(tamanoDeBurbuja({ width: 1080, height: 2340 })).toEqual({ ancho: 240, alto: 320 });
    expect(tamanoDeBurbuja({ width: 1080, height: 1920 })).toEqual({ ancho: 240, alto: 320 });
    expect(tamanoDeBurbuja({ width: 200, height: 4000 })).toEqual({ ancho: 240, alto: 320 });
  });

  it('lo bastante ancha para verse bien conserva su forma (límite en 200)', () => {
    expect(tamanoDeBurbuja({ width: 1000, height: 1600 })).toEqual({ ancho: 200, alto: 320 });
    expect(tamanoDeBurbuja({ width: 1000, height: 1500 })).toEqual({ ancho: 213, alto: 320 });
    expect(tamanoDeBurbuja({ width: 1000, height: 1000 })).toEqual({ ancho: 240, alto: 240 });
  });

  it('el frente del límite: un pelo más angosta que 200 ya es marco completo', () => {
    expect(tamanoDeBurbuja({ width: 1000, height: 1700 })).toEqual({ ancho: 240, alto: 320 });
  });
});
