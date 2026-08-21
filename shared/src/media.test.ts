import { describe, expect, it } from 'vitest';
import {
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
