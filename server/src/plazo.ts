/**
 * Dos defensas contra un disco USB que se cuelga (Lilafotos spec §3: «el disco puede no
 * estar»). Una lectura colgada en Node no se cancela: ocupa un hilo del pool
 * (son 4) hasta que el kernel la suelte. Entonces: (1) no se la espera más de
 * un plazo, y (2) no se lanza otra igual mientras la anterior no terminó —o
 * al cuarto pedido se cuelga TODO el server, el health incluido.
 */
export const PLAZO_DEL_DISCO_MS = 3_000;

/** Espera a lo sumo `plazoMs`; si la promesa no llegó, devuelve `siVence`. La promesa sigue viva. */
export function conPlazo<T>(promesa: Promise<T>, plazoMs: number, siVence: T): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const vencimiento = new Promise<T>((resolver) => {
    temporizador = setTimeout(() => resolver(siVence), plazoMs);
  });
  return Promise.race([promesa, vencimiento]).finally(() => clearTimeout(temporizador));
}

/** Una operación en vuelo a la vez: mientras no terminó, cada llamada recibe la misma promesa. */
export function unaALaVez<T>(operacion: () => Promise<T>): () => Promise<T> {
  let enVuelo: Promise<T> | null = null;
  return () => {
    if (enVuelo === null) {
      enVuelo = operacion().finally(() => {
        enVuelo = null;
      });
    }
    return enVuelo;
  };
}
