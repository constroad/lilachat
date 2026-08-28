import { normalizePeruPhone } from './phone.js';

/**
 * Cómo se llama la persona con la que estás hablando. Motor PURO.
 *
 * José, 27/08/2026, chateando con Wilson de verdad: «solo se ve el número de
 * teléfono, no el nombre de mi contacto».
 *
 * **El server no puede resolverlo, y es a propósito.** Lo único que sabe es el
 * nombre que esa persona se puso a sí misma —Wilson no se puso ninguno—, y la
 * agenda del teléfono nunca sube al servidor: es la decisión de modelo que se
 * tomó al copiar el de WhatsApp, cada teléfono ve solo sus propios contactos
 * guardados. Así que el cruce tiene que pasar acá, en el aparato.
 *
 * El orden importa y no es arbitrario: **gana tu agenda**. Si guardaste a
 * alguien como «Wilson albañil», eso es lo que querés leer, aunque en Lilachat
 * se haya puesto «Wilson Zamora». Es lo que hace WhatsApp y es lo correcto —
 * el nombre que le pusiste es el que reconocés de un vistazo.
 */
export function nombreDeContacto(params: {
  /** El nombre que el server mandó para el chat. */
  delServidor?: string | null;
  /** El teléfono de la otra persona, si se sabe. */
  telefono?: string | null;
  /** Teléfono normalizado → nombre guardado en el teléfono. */
  agenda: ReadonlyMap<string, string>;
}): string {
  const normalizado = normalizePeruPhone(params.telefono);
  const guardado = normalizado ? params.agenda.get(normalizado)?.trim() : undefined;
  if (guardado) return guardado;

  const delServidor = params.delServidor?.trim();

  /**
   * **Si el server mandó el propio teléfono como nombre, no es un nombre.**
   *
   * Es lo que pasa con quien no se puso nombre: el server cae a `phone`, y sin
   * esta comprobación el resultado se leería como si fuera un nombre elegido —
   * y encima taparía el formateo legible del número.
   */
  if (delServidor && normalizePeruPhone(delServidor) !== normalizado) return delServidor;
  if (delServidor && !normalizado) return delServidor;

  return normalizado || delServidor || '';
}

/**
 * El índice que consume lo de arriba, armado UNA vez desde la agenda del
 * teléfono.
 *
 * Se normaliza la CLAVE porque los dos lados vienen escritos distinto: la agenda
 * guarda «+51 960 397 018» y el server manda «960397018». Comparar en crudo no
 * encuentra nada, que es exactamente el síntoma que se está arreglando.
 */
export function indexarAgendaPorTelefono(
  contactos: readonly { nombre: string; telefono: string }[]
): Map<string, string> {
  const indice = new Map<string, string>();
  for (const contacto of contactos) {
    const clave = normalizePeruPhone(contacto.telefono);
    if (!clave) continue;
    const nombre = contacto.nombre.trim();
    // Un contacto cuyo «nombre» es su propio número no aporta nada: se descarta
    // para que no gane sobre el nombre que sí eligió la persona en Lilachat.
    if (!nombre || normalizePeruPhone(nombre) === clave) continue;
    // El PRIMERO gana: una agenda puede tener el mismo número dos veces y
    // reescribir haría que el nombre mostrado dependa del orden de lectura.
    if (!indice.has(clave)) indice.set(clave, nombre);
  }
  return indice;
}
