import { normalizePeruPhone } from './phone.js';

/**
 * Validar a quién se invita.
 *
 * **Invitar tiene que ADMITIR**, no solo compartir un enlace. El server no manda
 * el código a un número sin admisión previa —y contesta 200 igual, para no
 * revelar quién existe—, así que un «Invitar» que solo comparte el APK deja a la
 * persona instalando una app en la que nunca va a poder entrar. Le pasó a Wilson
 * el 26/08/2026.
 */
export type InvitacionValidada =
  | { ok: true; phone: string }
  | { ok: false; motivo: string };

export function validarInvitacion(params: {
  telefono: string;
  /** Mi propio número, normalizado. */
  yoSoy: string;
}): InvitacionValidada {
  const phone = normalizePeruPhone(params.telefono);
  // `normalizePeruPhone` ya exige celular (empieza en 9, nueve dígitos): un fijo
  // no puede recibir WhatsApp, así que admitirlo crearía una fila inútil.
  if (!phone) return { ok: false, motivo: 'Ese número no es un celular válido.' };

  if (phone === normalizePeruPhone(params.yoSoy)) {
    return { ok: false, motivo: 'Ese número es el tuyo: ya estás adentro.' };
  }

  return { ok: true, phone };
}
