import type { AsientoDelLibro, ElementoDelRollo, Huella, Libro } from './tipos.js';

/**
 * Qué archivos del rollo hay que mirar, sin leer un solo byte.
 *
 * Calcular la huella de 7 GB cuesta minutos y batería. Solo se hace sobre lo
 * que el libro no conoce, o conoce con otros bytes u otra fecha de
 * modificación: el id sobrevive a una edición, así que mirar solo el id
 * dejaría la foto recortada —o el respaldo regenerado— sin subir para siempre.
 *
 * Lo que el libro conoce y ya no está en el rollo se devuelve aparte. Borrar
 * en el teléfono no borra en el server; la pantalla puede decir «12 borradas
 * del teléfono siguen en el respaldo».
 *
 * Genérico en `E`: cada app extiende `ElementoDelRollo` con lo suyo (Lilafotos
 * con `tipo` y `uri`) y recibe de vuelta SU tipo, sin casts.
 */

export type Conciliacion<E extends ElementoDelRollo> = {
  /** En el orden del rollo: el orden de subida lo decide `ordenarParaSubir`. */
  pendientes: E[];
  alDia: number;
  desaparecidos: AsientoDelLibro[];
};

export function conciliarRollo<E extends ElementoDelRollo>(rollo: readonly E[], libro: Libro): Conciliacion<E> {
  const pendientes: E[] = [];
  let alDia = 0;

  for (const elemento of rollo) {
    if (estaAlDia(elemento, libro.get(elemento.id))) alDia += 1;
    else pendientes.push(elemento);
  }

  const idsDelRollo = new Set(rollo.map((elemento) => elemento.id));
  const desaparecidos = [...libro.values()].filter((asiento) => !idsDelRollo.has(asiento.id));

  return { pendientes, alDia, desaparecidos };
}

/**
 * El MediaStore de Android no siempre informa el tamaño (`bytes: 0` = no se
 * sabe); ahí decide solo la fecha de modificación. Con un tamaño real, los
 * dos tienen que coincidir.
 */
function estaAlDia(elemento: ElementoDelRollo, asiento: AsientoDelLibro | undefined): boolean {
  if (asiento === undefined) return false;
  if (asiento.modificadoEn !== elemento.modificadoEn) return false;
  return elemento.bytes === 0 || asiento.bytes === elemento.bytes;
}

/**
 * El asiento congela bytes y modificación del elemento TAL COMO se hasheó. Si
 * se leyeran del rollo al anotar, una edición hecha durante la subida quedaría
 * marcada como respaldada sin estarlo.
 */
export function asientoTrasSubida(
  elemento: ElementoDelRollo,
  huella: Huella,
  subidoEn: number
): AsientoDelLibro {
  return {
    id: elemento.id,
    huella,
    bytes: elemento.bytes,
    modificadoEn: elemento.modificadoEn,
    subidoEn,
  };
}
