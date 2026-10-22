import { describe, expect, it } from 'vitest';
import { needsSystemInstaller, sessionOutcome } from './installSession';

describe('sessionOutcome', () => {
  it('installed or cancelled leave nothing to say: the band goes back to normal', () => {
    // Arrange / Act
    const installed = sessionOutcome({ status: 'installed' });
    const cancelled = sessionOutcome({ status: 'cancelled' });
    // Assert
    expect(installed).toEqual({ ok: true });
    expect(cancelled).toEqual({ ok: true });
  });

  it('no room on the phone says so, not a generic failure', () => {
    expect(sessionOutcome({ status: 'failed', code: 'storage' })).toEqual({ ok: false, message: 'No hay espacio para instalar la actualización. Libera espacio y vuelve a intentar.' });
  });

  it('a version that does not fit over the installed one points to LilaStore', () => {
    const conflict = sessionOutcome({ status: 'failed', code: 'conflict', message: 'INSTALL_FAILED_UPDATE_INCOMPATIBLE' });
    expect(conflict).toEqual({ ok: false, message: 'Android no pudo instalar esta versión encima de la que tienes. Prueba desde LilaStore.' });
    expect(sessionOutcome({ status: 'failed', code: 'incompatible' })).toEqual(conflict);
  });

  it('a broken file asks to try again', () => {
    expect(sessionOutcome({ status: 'failed', code: 'invalid' })).toEqual({ ok: false, message: 'El archivo de la actualización no es válido. Vuelve a intentar.' });
  });

  it('a code it does not know still gives a way out', () => {
    expect(sessionOutcome({ status: 'failed', code: 'something-new' })).toEqual({ ok: false, message: 'No se pudo instalar la actualización. Prueba desde LilaStore.' });
  });
});

describe('needsSystemInstaller', () => {
  it('an app not yet allowed to install goes to the system installer, which resumes after Settings', () => {
    expect(needsSystemInstaller({ status: 'not-allowed' })).toBe(true);
  });

  it('any answer of the session itself stays with the session', () => {
    expect(needsSystemInstaller({ status: 'cancelled' })).toBe(false);
    expect(needsSystemInstaller({ status: 'failed', code: 'storage' })).toBe(false);
  });
});
