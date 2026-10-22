import type { SessionResult } from '../../modules/instalador-apk/src';

/** What the update band does after Android answered the session (`modules/instalador-apk`). */
export type InstallOutcome = { ok: true } | { ok: false; message: string };

const FAILURE_TEXT: Record<string, string> = {
  storage: 'No hay espacio para instalar la actualización. Libera espacio y vuelve a intentar.',
  conflict: 'Android no pudo instalar esta versión encima de la que tienes. Prueba desde LilaStore.',
  incompatible: 'Android no pudo instalar esta versión encima de la que tienes. Prueba desde LilaStore.',
  invalid: 'El archivo de la actualización no es válido. Vuelve a intentar.',
  blocked: 'Android bloqueó la instalación. Prueba desde LilaStore.',
};

const FALLBACK_TEXT = 'No se pudo instalar la actualización. Prueba desde LilaStore.';

/**
 * The first update from inside the app: Lilachat is not yet allowed to install
 * apps. A session would be aborted on the way back from Settings (seen on the
 * emulator, 22/10); the system installer resumes, so that one goes there.
 */
export const needsSystemInstaller = (result: SessionResult): boolean => result.status === 'not-allowed';

/** Installed or cancelled: nothing to say (an install replaces the app anyway). A failure says what to do. */
export function sessionOutcome(result: SessionResult): InstallOutcome {
  if (result.status !== 'failed') return { ok: true };
  return { ok: false, message: FAILURE_TEXT[result.code] ?? FALLBACK_TEXT };
}
