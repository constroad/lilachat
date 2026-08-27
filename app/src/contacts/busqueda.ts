/**
 * Buscar en la agenda sin recalcular todo en cada tecla.
 *
 * El filtro corría en cada render sobre ~600 contactos, armando un string nuevo
 * y bajándolo a minúsculas por cada uno. La clave se calcula **una vez**, al
 * cargar la agenda; después buscar es un `includes` sobre texto ya listo.
 */
export type ContactoIndexado<T> = T & { busqueda: string };

/**
 * Sin tildes y en minúsculas.
 *
 * Nadie escribe la tilde en un buscador, y no encontrar a «Mamá» escribiendo
 * «mama» es la clase de detalle que hace sentir rota una app.
 */
const clave = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function indexarParaBuscar<T extends { nombre: string; telefono: string }>(
  contactos: T[]
): ContactoIndexado<T>[] {
  return contactos.map((contacto) => ({
    ...contacto,
    // El teléfono va también sin separadores: la agenda guarda «+51 999 111 222»
    // y quien busca escribe los nueve dígitos seguidos.
    busqueda: clave(
      `${contacto.nombre} ${contacto.telefono} ${contacto.telefono.replace(/\D/g, '')}`
    ),
  }));
}

export function buscarEn<T>(indexados: ContactoIndexado<T>[], consulta: string): ContactoIndexado<T>[] {
  const aguja = clave(consulta.trim());
  // La MISMA referencia si no hay nada que buscar: devolver una copia obliga a
  // la lista a redibujarse entera sin que haya cambiado nada.
  if (!aguja) return indexados;
  return indexados.filter((contacto) => contacto.busqueda.includes(aguja));
}
