import type { ContactoDeAgenda } from '@lilachat/shared';

/**
 * De lo que devuelve `expo-contacts` a la lista que dibuja la app. PURO.
 *
 * Estaba metido dentro del hook, sin test, y es justo el tipo de código donde
 * los datos reales rompen: una entrada de agenda puede no tener nombre, puede
 * tener tres teléfonos, y puede no tener ninguno. Un contacto por número —no por
 * persona— porque lo que se invita es un número.
 */
export function aplanarAgenda(
  data: readonly { id?: string; name?: string; phoneNumbers?: readonly { number?: string }[] }[]
): ContactoDeAgenda[] {
  return data.flatMap((contacto) =>
    (contacto.phoneNumbers ?? [])
      .filter((numero) => Boolean(numero.number?.trim()))
      .map((numero, indice) => ({
        // El índice va en el id porque una persona con dos números daría dos
        // filas con la misma clave, y React las trata como una sola.
        id: `${contacto.id ?? contacto.name ?? 'x'}-${indice}`,
        // Sin nombre se muestra el número: «undefined» en la lista de invitar
        // es peor que un número, que al menos se reconoce.
        nombre: contacto.name?.trim() || (numero.number as string).trim(),
        telefono: (numero.number as string).trim(),
      }))
  );
}
