/**
 * Contactos y su agrupación (diseño «New Group»).
 *
 * Un contacto es alguien de la familia con quien SE PUEDE hablar; la lista sale
 * del server, y acá vive solo cómo se ordena y cómo se compara.
 */
export type Contact = {
  id: string;
  name?: string | null;
  phone: string;
  /** Si ya existe una conversación 1:1 con esta persona. */
  directChatId?: string | null;
};

export type ContactGroup = { letter: string; contacts: Contact[] };

/** Sin tildes y en mayúscula: «Álvaro» y «Ana» van los dos bajo la A. */
const inicial = (contact: Contact): string => {
  const nombre = (contact.name ?? '').trim();
  if (!nombre) return '#';
  const letra = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(letra) ? letra : '#';
};

const comparar = (a: Contact, b: Contact): number =>
  (a.name ?? a.phone).localeCompare(b.name ?? b.phone, 'es');

export function groupContactsByLetter(contacts: Contact[]): ContactGroup[] {
  const porLetra = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const letra = inicial(contact);
    porLetra.set(letra, [...(porLetra.get(letra) ?? []), contact]);
  }

  return [...porLetra.entries()]
    // `#` al final: los sin nombre no encabezan la lista.
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, lista]) => ({ letter, contacts: [...lista].sort(comparar) }));
}

/**
 * ¿Son el mismo conjunto de participantes?
 *
 * Es lo que evita el chat 1:1 duplicado: sin esto, tocar dos veces a la misma
 * persona desde «nuevo chat» crea dos conversaciones con ella y los mensajes
 * quedan repartidos entre las dos, sin forma de juntarlas después.
 */
export function sameMembers(a: string[], b: string[]): boolean {
  const unos = new Set(a);
  const otros = new Set(b);
  if (unos.size !== otros.size) return false;
  for (const id of unos) if (!otros.has(id)) return false;
  return true;
}
