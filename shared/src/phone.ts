/**
 * El número de teléfono, que es la IDENTIDAD en Lilachat. Motor PURO.
 *
 * Las reglas son las mismas que aplica `constroad-auth` (`normalizarTelefono`),
 * a propósito: si el cliente aceptara un formato que el servicio rechaza, el
 * usuario vería «te mandamos el código» y no llegaría nada.
 *
 * Hoy solo Perú (celular de 9 dígitos que empieza en 9). El diseño dibuja un
 * selector de país; mientras el servicio no acepte otros, se muestra el prefijo
 * FIJO en vez de un selector que promete lo que no puede cumplir.
 */
export const COUNTRY_PREFIX = '+51';

/**
 * Devuelve el número local de 9 dígitos, o `''` si no es válido.
 *
 * Los ceros de marcación internacional se sacan ANTES de buscar el código de
 * país: al revés, `0051 9…` nunca se reconoce y quien marca como desde un fijo
 * queda afuera sin motivo visible. (El motor original de Portal tenía ese orden
 * invertido y el bug vivió hasta que un test lo destapó.)
 */
export function normalizePeruPhone(input: unknown): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  const withoutLeadingZeros = digits.replace(/^0+/, '');
  const local =
    withoutLeadingZeros.startsWith('51') && withoutLeadingZeros.length === 11
      ? withoutLeadingZeros.slice(2)
      : withoutLeadingZeros;
  return /^9\d{8}$/.test(local) ? local : '';
}

/** Lo que se manda al servicio: con código de país, sin `+`. */
export function toInternationalPhone(input: unknown): string {
  const local = normalizePeruPhone(input);
  return local ? `51${local}` : '';
}

/** Como se lee en pantalla: `987 654 321`. */
export function formatPhoneDisplay(input: unknown): string {
  const local = normalizePeruPhone(input);
  if (!local) return String(input ?? '');
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
