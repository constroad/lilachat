import { normalizePeruPhone } from './phone.js';

/**
 * Separar la agenda del teléfono entre «ya están» y «hay que invitar».
 *
 * **El cruce ocurre EN EL TELÉFONO.** Es la diferencia que importa: WhatsApp
 * sube la libreta entera a sus servidores para poder hacer esto. Acá el server
 * ya nos dijo quiénes son nuestros contactos registrados —gente con la que
 * podemos hablar igual— y la agenda se compara contra esa lista sin salir del
 * aparato. Ningún número que el server no conociera ya sale del dispositivo.
 */
export type ContactoRegistrado = { id: string; phone: string; name?: string | null };
export type ContactoDeAgenda = { id: string; nombre: string; telefono: string };

export function separarAgenda(params: {
  registrados: ContactoRegistrado[];
  agenda: ContactoDeAgenda[];
}): { enLilachat: ContactoRegistrado[]; paraInvitar: ContactoDeAgenda[] } {
  // Se compara NORMALIZADO: la agenda guarda «+51 999 111 222» y el server
  // «999111222». Sin esto todos los contactos caerían en «para invitar» y la
  // pantalla no serviría para nada.
  const yaEstan = new Set(
    params.registrados.map((uno) => normalizePeruPhone(uno.phone)).filter(Boolean)
  );

  const vistos = new Set<string>();
  const paraInvitar: ContactoDeAgenda[] = [];

  for (const contacto of params.agenda) {
    const numero = normalizePeruPhone(contacto.telefono);
    if (!numero || yaEstan.has(numero)) continue;
    // La agenda repite el mismo número como «casa» y como «celular»: se invita
    // una sola vez. Dos mensajes iguales a la misma persona parecen spam.
    if (vistos.has(numero)) continue;
    vistos.add(numero);
    paraInvitar.push(contacto);
  }

  paraInvitar.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { enLilachat: params.registrados, paraInvitar };
}
