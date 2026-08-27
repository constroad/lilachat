/**
 * El gate de admisión (spec §5.1). Motor PURO.
 *
 * constroad-auth le manda el código a CUALQUIERA que lo pida — solo prueba que
 * ese correo es de quien lo pide. Quién puede entrar a Lilachat lo decide esta
 * base, y este módulo es la decisión: si el correo no está invitado, se FINGE
 * la misma respuesta y no se llama al servicio (ni SMTP gastado en extraños ni
 * confirmación de quién está en la lista).
 */

/** Coerciona a string (anti inyección de operadores) y normaliza. */
export function normalizeEmail(rawEmail: unknown): string {
  if (typeof rawEmail !== 'string') return '';
  const email = rawEmail.trim().toLowerCase();
  // Forma mínima, no validación RFC: el dueño real del buzón lo prueba el OTP.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

/**
 * A dónde mandar el código: UN destino, nunca dos.
 *
 * El primario es el TELÉFONO (constroad-auth lo manda por WhatsApp). El correo
 * de la invitación es el respaldo, y **solo se usa cuando el usuario lo pide**
 * desde la pantalla del código.
 *
 * Mandar a los dos automáticamente —que fue el primer intento— vuelve inútil el
 * botón: la persona recibe el correo sin haberlo pedido, y entonces la interfaz
 * que dice «mándamelo por correo» no decide nada. Peor: cada alta gasta dos
 * envíos y dos códigos válidos donde alcanza uno.
 */
export function resolveOtpTarget(params: {
  phone: string;
  email?: string;
  /** El usuario PIDIÓ el correo («no me llegó por WhatsApp»). */
  preferEmail?: boolean;
}): string {
  if (params.preferEmail && params.email) return params.email;
  return `51${params.phone}`;
}

/**
 * Al CANJEAR sí se prueban los dos: el server no lleva registro de por dónde
 * salió cada código, y los dos son legítimamente de esa persona. Es invisible
 * para el usuario y no cambia lo que recibe — a diferencia del envío.
 */
export function resolveVerifyTargets(params: { phone: string; email?: string }): string[] {
  const targets = [`51${params.phone}`];
  if (params.email) targets.push(params.email);
  return targets;
}

export type OtpDecision = 'forward' | 'pretend';

/**
 * **Registro ABIERTO desde el 26/08/2026, por decisión de José.**
 *
 * Antes: solo se le pedía el código a quien tuviera una admisión previa, y al
 * resto se le FINGÍA —misma respuesta, cero llamadas— para no confirmarle a un
 * extraño quién está en la lista. Lilachat y LilaStore pasaron a ser públicas,
 * así que cualquiera puede entrar y el gate perdió su razón de ser: quedaba
 * dejando afuera a la familia que uno quería adentro.
 *
 * `registroAbierto` sigue existiendo como interruptor y no se borró la rama de
 * `pretend`: si algún día se vuelve a cerrar, se cambia acá y los tests de
 * enumeración siguen valiendo.
 *
 * **Lo que se pierde:** ahora sí se llama al servicio por cualquier número, así
 * que el tope de envíos de constroad-auth es lo único que separa esto de ser un
 * grifo de SMS. Y quien entra aparece en `/api/contacts` como cualquier otro.
 */
export function decideOtpRequest(params: {
  invited: boolean;
  registroAbierto?: boolean;
}): OtpDecision {
  if (params.registroAbierto) return 'forward';
  return params.invited ? 'forward' : 'pretend';
}

/**
 * La respuesta ÚNICA del pedido de código: idéntica para invitados, extraños y
 * hasta para el servicio caído (el error queda en el log del server, no en la
 * cara del que pregunta). Cualquier variación permite enumerar la lista.
 */
export const GENERIC_OTP_RESPONSE = {
  message: 'Si tu número tiene acceso, el código te va a llegar en un momento.',
} as const;

/** El rechazo ÚNICO del canje: mismo texto para código malo y para extraño. */
export const GENERIC_VERIFY_ERROR = {
  message: 'Ese código no es correcto o ya venció. Pide uno nuevo.',
} as const;
