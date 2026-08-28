import { normalizePeruPhone } from '@lilachat/shared';

/**
 * A quién pertenece un dispositivo al refrescar la sesión. Motor PURO.
 *
 * **El bug que arregla (28/08/2026): «se me cerró la sesión sola».**
 *
 * `POST /api/auth/session` valida el dispositivo contra constroad-auth y después
 * buscaba al usuario **re-deduciéndolo del texto de identidad** que devuelve ese
 * servicio: si parecía celular, por `phone`; si no, por `email`. Y ahí estaba la
 * grieta: la identidad es el canal por el que se canjeó el código, no la llave
 * del usuario.
 *
 * Quien entra por el respaldo de correo queda con identidad = ese correo. Si su
 * usuario no tiene EXACTAMENTE ese correo guardado —porque se creó antes de
 * tenerlo, porque el correo de respaldo cambió, o porque nunca se le puso—, la
 * búsqueda no encuentra a nadie y el server responde 401. La app trata el 401
 * como revocación y borra la credencial: **sesión cerrada en cada arranque**.
 *
 * Lo perverso es que le pega justo a quien usó el respaldo, o sea a quien ya
 * tuvo un problema con WhatsApp. El canal de emergencia produce una sesión que
 * se muere sola.
 *
 * **La corrección: el dispositivo ya sabe de quién es.** Al canjear el código se
 * guarda `{ deviceId, userId }`; eso es un dato NUESTRO y no una inferencia. El
 * servicio de auth prueba que el dispositivo y su secreto son válidos —eso sigue
 * siendo suyo—, y quién es el dueño lo resuelve nuestro registro.
 */
export type ResolucionDeUsuario =
  /** El registro del dispositivo dice de quién es. Es el camino bueno. */
  | { via: 'device'; userId: string }
  /** Dispositivo sin registro local (enrolado por una versión vieja): se deduce. */
  | { via: 'identidad'; porTelefono: string | null; porEmail: string | null };

export function resolverUsuarioDeSesion(params: {
  /** Lo que dice NUESTRO registro de dispositivos, si existe. */
  userIdDelDevice: string | null;
  /** Lo que devuelve constroad-auth: teléfono o correo, según el canal usado. */
  identidad: string;
}): ResolucionDeUsuario {
  // El registro propio manda. No es una optimización: es lo único que no
  // depende de que dos textos coincidan.
  if (params.userIdDelDevice) return { via: 'device', userId: params.userIdDelDevice };

  const telefono = normalizePeruPhone(params.identidad);
  return {
    via: 'identidad',
    porTelefono: telefono || null,
    // Si parece un celular NO se busca además por correo: un `email` con forma
    // de teléfono no existe, y buscar por los dos solo agrega una consulta.
    porEmail: telefono ? null : params.identidad.trim().toLowerCase() || null,
  };
}
