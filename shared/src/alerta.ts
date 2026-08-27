/**
 * A quién y cuándo avisarle que algo se rompió. Motor PURO: sin red, sin timers.
 *
 * Existe por el 27/08/2026. Había reporte de crash desde el 26 y aun así José
 * escribió «estoy prácticamente a ciegas», y tenía razón: la línea quedaba en un
 * archivo de log que hay que ir a mirar, y **nadie mira un log por las dudas**.
 * Un sistema de observabilidad que exige que ya sospeches del problema no te
 * avisa de nada.
 *
 * Lo que falta es el EMPUJÓN: que el error salga a buscarte. Acá vive la única
 * parte con reglas de negocio de eso — cuál se manda y cuál no.
 */
import type { CrashReport } from './crashReport.js';

/**
 * Dos reportes iguales dentro de esta ventana cuentan como uno.
 *
 * Sin esto la primera pantalla que entre en bucle de render manda un aviso por
 * cada intento. El techo del endpoint es de 60 por minuto: serían 60 mensajes de
 * Telegram por minuto, y la reacción humana a eso es silenciar el canal — con lo
 * cual el siguiente error, el que sí importaba, tampoco se ve.
 */
export const VENTANA_DEDUPE_MS = 10 * 60 * 1000;

/**
 * Qué hace «iguales» a dos reportes.
 *
 * La versión entra a propósito: el MISMO error en una versión nueva es noticia
 * otra vez —significa que el arreglo no funcionó— y merece su aviso.
 * El stack NO entra: cambia entre builds y haría único a cada reporte, que es
 * exactamente la forma de que el dedupe no dedupee nada.
 */
export function huellaDeReporte(reporte: CrashReport): string {
  return [reporte.app, reporte.version, reporte.pantalla ?? '?', reporte.mensaje].join('|');
}

/**
 * ¿Se manda este aviso?
 *
 * `vistos` es el mapa de huella → cuándo se avisó por última vez. Se devuelve
 * también la huella para que quien llama no la calcule dos veces.
 */
export function debeAlertar(params: {
  reporte: CrashReport;
  ahora: number;
  vistos: ReadonlyMap<string, number>;
}): { alertar: boolean; huella: string } {
  const huella = huellaDeReporte(params.reporte);
  const ultima = params.vistos.get(huella);

  const alertar = ultima === undefined || params.ahora - ultima >= VENTANA_DEDUPE_MS;
  return { alertar, huella };
}

/** Tope del stack en el aviso: Telegram corta en 4096 y un stack largo tapa todo. */
const MAX_STACK = 600;

/**
 * El texto del aviso.
 *
 * Se escribe para leerlo en el celular, de un vistazo y sin abrir nada: qué app,
 * qué versión, en qué pantalla y qué dijo. El stack va al final y recortado —
 * quien lo necesite entero va al log, que es donde está completo.
 */
export function textoDeAlerta(reporte: CrashReport): string {
  const lineas = [
    `🔴 ${reporte.app} ${reporte.version || 'sin versión'} (${reporte.plataforma ?? '?'})`,
    `Pantalla: ${reporte.pantalla ?? '?'}`,
    '',
    reporte.mensaje,
  ];

  if (reporte.stack) {
    const corto = reporte.stack.slice(0, MAX_STACK);
    lineas.push('', corto + (reporte.stack.length > MAX_STACK ? '\n…' : ''));
  }

  return lineas.join('\n');
}
