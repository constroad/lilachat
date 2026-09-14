/**
 * Si un archivo descargado llega o no al instalador. Motor PURO.
 *
 * **Acá se falla CERRADO, al revés que `versionGate`.** La compuerta de versión
 * deja pasar ante la duda porque bloquear de más deja 30 teléfonos sin instalar
 * nada; esto rechaza ante la duda porque dejar pasar de más instala un binario
 * que alguien pudo cambiar en el camino. Los dos motores viven al lado y toman
 * la decisión contraria a propósito.
 *
 * El `sha256` se compara **antes** de invocar al `PackageInstaller`: una vez que
 * el sistema abre el diálogo de instalación, la app ya no manda.
 */

export type InstallVerdict =
  | { install: true }
  | { install: false; reason: 'no-expected-hash' | 'bad-hash' | 'wrong-size' | 'unreadable-hash' };

const SHA256 = /^[0-9a-f]{64}$/;

/** Un sha256 es 64 hex. Se compara en minúsculas: el server los guarda así. */
function normalizeSha(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().toLowerCase();
  return SHA256.test(limpio) ? limpio : null;
}

export function decideInstall(entrada: {
  /** El que declaró el catálogo para esa release. */
  expected: unknown;
  /** El que se calculó sobre el archivo que quedó en disco. */
  actual: unknown;
  expectedSize?: unknown;
  actualSize?: unknown;
}): InstallVerdict {
  const esperado = normalizeSha(entrada.expected);
  // Sin hash esperado no hay nada contra qué verificar. **No se instala**: un
  // catálogo que no trae el hash es un catálogo del que no se puede confiar el
  // archivo, y ese es justo el caso que esta comprobación existe para atajar.
  if (esperado === null) return { install: false, reason: 'no-expected-hash' };

  const real = normalizeSha(entrada.actual);
  // Que no se haya podido calcular el hash del archivo tampoco habilita nada.
  if (real === null) return { install: false, reason: 'unreadable-hash' };

  // El tamaño se mira ANTES del hash cuando los dos vienen: una descarga cortada
  // a la mitad tiene un motivo más útil que «el hash no coincide», que manda a
  // sospechar de un ataque cuando fue el ascensor.
  const tamEsperado = entrada.expectedSize;
  const tamReal = entrada.actualSize;
  if (typeof tamEsperado === 'number' && typeof tamReal === 'number' && tamEsperado !== tamReal) {
    return { install: false, reason: 'wrong-size' };
  }

  if (esperado !== real) return { install: false, reason: 'bad-hash' };
  return { install: true };
}

/** Qué se le dice a la persona. El motivo técnico no va a la pantalla. */
export function installMessage(verdict: InstallVerdict): string | null {
  if (verdict.install) return null;
  if (verdict.reason === 'wrong-size') {
    return 'La descarga quedó incompleta. Probá de nuevo con mejor señal.';
  }
  return 'El archivo no coincide con el que publicó tu empresa. No se instaló.';
}
