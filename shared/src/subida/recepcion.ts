import { esHuella } from './huella.js';
import type { Huella } from './tipos.js';

/**
 * El lado del server de la deduplicación (Lilafotos spec §6).
 *
 * Dos momentos: ANTES de mandar bytes, el teléfono pregunta qué huellas
 * faltan y no gasta datos en lo que ya está. Y CUANDO llegan bytes, el server
 * los hashea y decide sobre lo que llegó, no sobre lo que se declaró.
 */

export type ConsultaDeHuellas = {
  faltan: Huella[];
  /** Lo malformado no se busca ni se sube; se devuelve para que el cliente lo vea. */
  invalidas: string[];
};

export function huellasQueFaltan(
  consultadas: readonly string[],
  conocidas: ReadonlySet<Huella>
): ConsultaDeHuellas {
  const faltan: Huella[] = [];
  const invalidas: string[] = [];
  const vistas = new Set<Huella>();

  for (const consultada of consultadas) {
    if (!esHuella(consultada)) {
      invalidas.push(consultada);
    } else if (!conocidas.has(consultada) && !vistas.has(consultada)) {
      vistas.add(consultada);
      faltan.push(consultada);
    }
  }

  return { faltan, invalidas };
}

export type DecisionDeRecepcion = 'guardar' | 'ya_existe' | 'huella_no_coincide';

/**
 * La verificación va antes que la deduplicación. Si lo que llegó no es lo
 * declarado —una edición durante la subida, o bytes corruptos— guardar con la
 * huella declarada marcaría como respaldado algo que no lo está.
 *
 * `yaExiste` es sobre la huella CALCULADA: lo que el server tiene de verdad.
 */
export function decidirRecepcion(entrada: {
  huellaDeclarada: Huella;
  huellaCalculada: Huella;
  yaExiste: boolean;
}): DecisionDeRecepcion {
  if (entrada.huellaDeclarada !== entrada.huellaCalculada) return 'huella_no_coincide';
  return entrada.yaExiste ? 'ya_existe' : 'guardar';
}
