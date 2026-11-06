import { describe, expect, it, vi } from 'vitest';
import { DRIVE_UPLOAD_FAILED, driveFileRefusal, driveUploadingLine, driveUploadOf, driveUploadRequest, uploadToDrive, type DriveUpload, type DriveUploadDeps } from './driveUpload';
import { FORMS_LEVEL } from './appForms';
import { validateCommandResponse } from './botCommands';

const wire = { url: 'https://constroad.com/api/public/service-drive-upload/abc', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-06T22:00:00.000Z', maxBytes: 52428800, maxSeconds: 60, mimeTypes: ['image/jpeg', 'video/mp4'] };
const photo = { mime: 'image/jpeg', sizeBytes: 1000 };

describe('driveUploadOf', () => {
  it('keeps what Portal opened, and only that', () => {
    expect(driveUploadOf({ ...wire, secret: 'x' })).toEqual(wire);
  });

  it('refuses an address that is not https, is not ours or hides a user', () => {
    expect(driveUploadOf({ ...wire, url: 'http://constroad.com/x' })).toBeNull();
    expect(driveUploadOf({ ...wire, url: 'https://evil.example.com/x' })).toBeNull();
    expect(driveUploadOf({ ...wire, url: 'https://constroad.com.evil.example/x' })).toBeNull();
    expect(driveUploadOf({ ...wire, url: 'https://constroad.com@evil.example/x' })).toBeNull();
  });

  it('takes a subdomain of ours', () => {
    expect(driveUploadOf({ ...wire, url: 'https://www.constroad.com/x' })?.url).toBe('https://www.constroad.com/x');
  });

  it('refuses a broken ticket', () => {
    expect(driveUploadOf({ ...wire, method: 'PUT' })).toBeNull();
    expect(driveUploadOf({ ...wire, fileField: '' })).toBeNull();
    expect(driveUploadOf({ ...wire, maxBytes: 0 })).toBeNull();
    expect(driveUploadOf({ ...wire, expiresAt: 'mañana' })).toBeNull();
    expect(driveUploadOf({ ...wire, fields: { a: 1 } })).toBeNull();
    expect(driveUploadOf({ ...wire, mimeTypes: ['application/pdf'] })).toBeNull();
    expect(driveUploadOf(null)).toBeNull();
  });
});

describe('validateCommandResponse with an upload', () => {
  it('passes it beside the text', () => {
    const checked = validateCommandResponse({ response_type: 'ephemeral', text: 'Ya puedes enviar el archivo.', shareable: false, upload: wire });
    expect(checked).toMatchObject({ ok: true, response: { text: 'Ya puedes enviar el archivo.', upload: wire } });
  });

  it('an answer whose upload is broken is refused, not delivered without it', () => {
    expect(validateCommandResponse({ text: 'Listo', upload: { ...wire, url: 'https://evil.example.com/x' } }).ok).toBe(false);
  });

  it('a normal answer carries none', () => {
    const checked = validateCommandResponse({ text: 'Listo' });
    expect(checked.ok && 'upload' in checked.response).toBe(false);
  });
});

describe('driveFileRefusal', () => {
  const upload = driveUploadOf(wire)!;

  it('lets through what fits', () => {
    expect(driveFileRefusal(upload, photo)).toBeNull();
    expect(driveFileRefusal(upload, { mime: 'video/mp4', sizeBytes: 1000, seconds: 60 })).toBeNull();
  });

  it('says why a file does not go', () => {
    expect(driveFileRefusal(upload, { mime: 'application/pdf' })).toBe('Solo se admiten fotos y videos.');
    expect(driveFileRefusal(upload, { mime: 'image/jpeg', sizeBytes: 52428801 })).toBe('El archivo pesa más de 50 MB.');
    expect(driveFileRefusal(upload, { mime: 'video/mp4', seconds: 61 })).toBe('El video dura más de 60 segundos.');
  });

  it('what the phone does not know is left to Portal', () => {
    expect(driveFileRefusal(upload, { mime: 'video/mp4' })).toBeNull();
  });
});

describe('driveUploadingLine', () => {
  it('says how far it went, once it started', () => {
    expect(driveUploadingLine(0)).toBe('Subiendo…');
    expect(driveUploadingLine(0.4)).toBe('Subiendo… 40 %');
  });
});

describe('driveUploadRequest', () => {
  it('says what this app can draw', () => {
    expect(driveUploadRequest()).toEqual({ kind: 'drive_upload', forms: FORMS_LEVEL });
  });
});

describe('uploadToDrive', () => {
  const opened = (commandId: string) => ({ ok: true as const, data: { commandId, appId: 'a', appName: 'Portal', outcome: 'form' as const } });
  const answered = (commandId: string, upload: unknown = wire) => ({ ok: true as const, outcome: { commandId, appId: 'a', appName: 'Portal', outcome: 'ephemeral' as const, response: { responseType: 'ephemeral' as const, text: 'Ya', ...(upload ? { upload: upload as DriveUpload } : {}) } } });
  const depsWith = (send: DriveUploadDeps<string>['send'], overrides: Partial<DriveUploadDeps<string>> = {}) => {
    let runs = 0;
    const deps: DriveUploadDeps<string> = {
      open: vi.fn(async () => opened(`run-${(runs += 1)}`)),
      submit: vi.fn(async (commandId: string) => answered(commandId)),
      notice: vi.fn(async () => null),
      send,
      ...overrides,
    };
    return deps;
  };
  const file = { source: 'file://a.jpg', facts: photo };

  it('opens the ticket, sends the file with its key and is done', async () => {
    // Arrange
    const send = vi.fn(async () => ({ status: 201 }));
    const deps = depsWith(send);
    // Act
    const result = await uploadToDrive(deps, file, 'key-1');
    // Assert
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith(wire, 'file://a.jpg', 'key-1');
  });

  it('the same file already there is a success', async () => {
    expect(await uploadToDrive(depsWith(async () => ({ status: 200 })), file, 'key-1')).toEqual({ ok: true });
  });

  it('a ticket that expired is asked again with a new run, and the same key', async () => {
    // Arrange
    const send = vi.fn<DriveUploadDeps<string>['send']>().mockResolvedValueOnce({ status: 410 }).mockResolvedValueOnce({ status: 201 });
    const deps = depsWith(send);
    // Act
    const result = await uploadToDrive(deps, file, 'key-1');
    // Assert
    expect(result).toEqual({ ok: true });
    expect(deps.submit).toHaveBeenNthCalledWith(1, 'run-1');
    expect(deps.submit).toHaveBeenNthCalledWith(2, 'run-2');
    expect(send.mock.calls.map((call) => call[2])).toEqual(['key-1', 'key-1']);
  });

  it('a second expired ticket stops, and says so', async () => {
    const send = vi.fn(async () => ({ status: 410 }));
    expect(await uploadToDrive(depsWith(send), file, 'key-1')).toEqual({ ok: false, message: 'La subida venció. Vuelve a intentarlo.' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reads a slow ticket from the late answer', async () => {
    // Arrange
    const send = vi.fn(async () => ({ status: 201 }));
    const deps = depsWith(send, {
      submit: async (commandId) => ({ ok: true, outcome: { commandId, appId: 'a', appName: 'Portal', outcome: 'pending' } }),
      notice: async (commandId) => ({ commandId, appId: 'a', appName: 'Portal', response: { responseType: 'ephemeral', upload: wire as DriveUpload } }),
    });
    // Act and assert
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a file that does not fit never leaves the phone', async () => {
    // Arrange
    const send = vi.fn(async () => ({ status: 201 }));
    // Act
    const result = await uploadToDrive(depsWith(send), { source: 'x', facts: { mime: 'application/pdf' } }, 'key-1');
    // Assert
    expect(result).toEqual({ ok: false, message: 'Solo se admiten fotos y videos.' });
    expect(send).not.toHaveBeenCalled();
  });

  it('what Portal refuses on the form reaches the person', async () => {
    const deps = depsWith(vi.fn(), { submit: async () => ({ ok: false, errors: { _: 'Esta empresa no tiene ese servicio.' } }) });
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: false, message: 'Esta empresa no tiene ese servicio.' });
  });

  it('with no ticket in the answer nothing is sent', async () => {
    const send = vi.fn(async () => ({ status: 201 }));
    const deps = depsWith(send, { submit: async (commandId) => answered(commandId, null) });
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: false, message: DRIVE_UPLOAD_FAILED });
    expect(send).not.toHaveBeenCalled();
  });

  it('each refusal of the upload says its reason, and a lost signal says that', async () => {
    const failing = (status?: number) => uploadToDrive(depsWith(async () => (status ? { status } : {})), file, 'key-1');
    expect(await failing(413)).toEqual({ ok: false, message: 'El archivo pesa demasiado.' });
    expect(await failing(415)).toEqual({ ok: false, message: 'Solo se admiten fotos y videos.' });
    expect(await failing(409)).toEqual({ ok: false, message: 'Ese archivo ya se está subiendo.' });
    expect(await failing(500)).toEqual({ ok: false, message: DRIVE_UPLOAD_FAILED });
    expect(await failing()).toEqual({ ok: false, message: DRIVE_UPLOAD_FAILED });
  });

  it('any other refusal is told in Portal\'s words', async () => {
    const deps = depsWith(async () => ({ status: 404, message: 'Ese servicio ya no existe.' }));
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: false, message: 'Ese servicio ya no existe.' });
  });

  it('what stopped the phone from sending is told too', async () => {
    const deps = depsWith(async () => ({ message: 'La subida tardó demasiado. Inténtalo de nuevo.' }));
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: false, message: 'La subida tardó demasiado. Inténtalo de nuevo.' });
  });

  it('with no signal to open the ticket it fails the same way', async () => {
    const deps = depsWith(vi.fn(), { open: async () => ({ ok: false }) });
    expect(await uploadToDrive(deps, file, 'key-1')).toEqual({ ok: false, message: DRIVE_UPLOAD_FAILED });
  });
});
