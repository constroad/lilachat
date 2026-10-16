/** Los números con nombre. Cada uno tiene un motivo; ninguno es «parecía bien». */

/**
 * Un `Worker` de WorkManager tiene diez minutos. El lote es lo que cabe con
 * margen en una corrida; el resto queda para la siguiente, que el sistema
 * agenda cuando quiere. 200 MB por wifi doméstico son ~1–2 minutos.
 */
export const LOTE_MAX_ELEMENTOS = 50;
export const LOTE_MAX_BYTES = 200 * 1024 * 1024;

/**
 * A partir de cuántas horas esperando, lo pendiente más viejo se marca en la
 * pantalla. Dos noches enchufado y con wifi es tiempo de sobra: si algo sigue
 * sin subir, el respaldo dejó de andar y hay que decirlo.
 */
export const ESPERA_MAXIMA_HORAS = 48;

/** Forzar la subida sin cable por debajo de esto deja el teléfono muerto a mitad de un archivo grande. */
export const BATERIA_MINIMA_SIN_CABLE_PCT = 15;
