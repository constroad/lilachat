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

/**
 * La ficha pública de Lilachat en LilaStore (`/app/<slug>`), donde viven todas
 * las apps. Lleva la vista previa —ícono, nombre, qué es— que WhatsApp
 * convierte en tarjeta, y el botón principal baja Lilachat DIRECTO: quien
 * recibe la invitación no tiene que instalar LilaStore antes (José, 18/10).
 */
export const ENLACE_DE_DESCARGA = 'https://lilastore.constroad.com/app/lilachat';

/** La primera palabra con letras, o nada si es un teléfono o está vacío. */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const palabra = (nombre ?? '').trim().split(/\s+/).find((parte) => /\p{L}/u.test(parte));
  return palabra ?? null;
}

/**
 * El mensaje de WhatsApp (FL13, José 18/10): una frase en tuteo con el enlace
 * AL FINAL, como Pulso. Quién invita ya se ve —sale del WhatsApp de esa
 * persona—, así que no se repite en el texto.
 */
export function mensajeDeInvitacion(params: { para: string | null | undefined; enlace?: string }): string {
  const nombre = nombreDePila(params.para);
  const saludo = nombre ? `Hola ${nombre}` : 'Hola';
  return `${saludo}, te invito a Lilachat para que hablemos por ahí. Descárgala gratis aquí: ${params.enlace ?? ENLACE_DE_DESCARGA}`;
}

/** Perú: los celulares que valida `normalizePeruPhone` van con este código. */
const CODIGO_DE_PAIS = '51';

/**
 * El chat de WhatsApp de esa persona con el mensaje ya escrito. `null` si el
 * número no es un celular peruano: entonces se comparte por el menú del sistema.
 */
export function enlaceDeWhatsapp(telefono: string, mensaje: string): string | null {
  const celular = normalizePeruPhone(telefono);
  if (!celular) return null;
  return `https://wa.me/${CODIGO_DE_PAIS}${celular}?text=${encodeURIComponent(mensaje)}`;
}
