/**
 * ¿Hay que avisar de una actualización, y con cuánta fuerza? Motor PURO.
 *
 * José, 30/08/2026: «¿es buena idea que salte una burbuja de actualización, o
 * que al abrir la app les salga el aviso de alguna manera?».
 *
 * **Burbuja no.** Una notificación push por una actualización es la vía más
 * rápida a que alguien silencie las notificaciones de la app — y ahí se pierden
 * también los mensajes, que es lo único que de verdad importa. Un modal que
 * tapa la pantalla al abrir es peor: interrumpe justo cuando la persona venía a
 * leer algo.
 *
 * Lo que sí: **una banda discreta arriba de la lista**, que se puede descartar y
 * que NO vuelve por la misma versión. Aparece sola en la siguiente. Es el
 * volumen correcto para algo que conviene hacer pero no es urgente.
 *
 * La excepción es la versión MÍNIMA: por debajo de ella la app no funciona
 * —el server ya no le habla— así que ese aviso no se puede descartar. Ahí
 * esconderlo dejaría a alguien mirando una app rota sin saber por qué.
 */
export type AvisoDeActualizacion =
  | { tipo: 'ninguno' }
  | { tipo: 'sugerida'; version: string }
  | { tipo: 'obligatoria'; version: string };

export function decidirAvisoDeActualizacion(params: {
  /** El `versionCode` de este build; `0` si no se pudo leer. */
  actual: number;
  /** El publicado; `null` si no hubo respuesta. */
  ultima: number | null;
  /** El mínimo exigido; `0` si no hay. */
  minima: number;
  /** La versión legible de la publicada. */
  version: string;
  /** Qué versión descartó la persona, si descartó alguna. */
  descartada: string | null;
}): AvisoDeActualizacion {
  const { actual, ultima, minima, version, descartada } = params;

  // Sin datos NO se afirma nada: es la misma regla que `resultadoDelChequeo`.
  // Un «actualizá» falso manda a alguien a bajar un APK por gusto.
  if (!actual || !ultima || !version) return { tipo: 'ninguno' };

  // Por debajo del mínimo se avisa igual, aunque lo haya descartado antes.
  if (minima > 0 && actual < minima) return { tipo: 'obligatoria', version };

  // Un build más nuevo que el publicado es de desarrollo: ofrecerle actualizar
  // sería mandarlo hacia atrás.
  if (ultima <= actual) return { tipo: 'ninguno' };

  // Descartar vale para ESA versión. Que vuelva con la siguiente es lo que hace
  // que descartarlo no sea apagarlo para siempre.
  if (descartada === version) return { tipo: 'ninguno' };

  return { tipo: 'sugerida', version };
}
