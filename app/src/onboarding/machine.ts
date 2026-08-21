/**
 * Reglas del alta (Lilachat F1). Motor PURO — sin imports de react-native:
 * corre en vitest en milisegundos; el componente solo dibuja (rn-app-loop §2).
 */

/** Coerciona y normaliza igual que el server: lo que se manda es lo que él ve. */
export function normalizeEmailInput(rawEmail: unknown): string {
  if (typeof rawEmail !== 'string') return '';
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

/** El código es de 6 dígitos; con el sexto se auto-envía (patrón Timón). */
export function isCompleteOtp(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export function shouldAutoSubmitOtp(previous: string, current: string): boolean {
  return !isCompleteOtp(previous) && isCompleteOtp(current);
}

/**
 * Qué se le dice al usuario según la respuesta del server.
 *
 * - 401: el texto YA viene genérico del server (código malo ≡ no invitado) —
 *   se muestra tal cual, no se re-redacta.
 * - 503: reintentable — la ausencia de respuesta no es un rechazo, y el botón
 *   tiene que seguir vivo.
 * - Sin red: idem 503, en palabras de quien está sin señal.
 */
export function mapVerifyFailure(status: number | 'network', serverMessage?: string): string {
  if (status === 'network') return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (status === 503) return 'No se pudo verificar. Inténtalo de nuevo en un momento.';
  return serverMessage || 'Ese código no es correcto o ya venció. Pide uno nuevo.';
}
