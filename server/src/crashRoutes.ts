import { Router } from 'express';
import { esReporteValido, type CrashReport } from '@lilachat/shared';

/**
 * Donde las apps RN cuentan que algo se rompió.
 *
 * Existe por el 26/08/2026: un botón de Lilachat no hacía nada y **no había
 * forma de enterarse** — ni en el teléfono, ni acá, ni en Torre. Un fallo que
 * solo ve quien lo sufre se arregla el día que a esa persona se le ocurre
 * contarlo, y mientras tanto le pasa a todos los demás en silencio.
 *
 * **Sin autenticar, a propósito.** Una app que revienta al arrancar no llegó a
 * tener sesión, y ese es justamente el caso que más importa ver. A cambio:
 *
 * - el `app` se valida contra una lista cerrada (`esReporteValido`);
 * - el cuerpo tiene tope de tamaño;
 * - hay un límite de cuántos se aceptan por minuto, porque un endpoint abierto
 *   que escribe en el log es una forma cómoda de llenarnos el disco.
 *
 * Se escribe en **stdout**, que es lo que Torre recoge: un reporte que va a una
 * base que nadie mira no resuelve nada.
 */
const MAX_POR_MINUTO = 60;

export function buildCrashRouter(): Router {
  const router = Router();

  // Contador simple en memoria. Se reinicia con el proceso y eso está bien: lo
  // que protege es de una ráfaga, no de un atacante paciente.
  let ventana = { desde: Date.now(), cuenta: 0 };

  router.post('/', (req, res) => {
    const ahora = Date.now();
    if (ahora - ventana.desde > 60_000) ventana = { desde: ahora, cuenta: 0 };
    ventana.cuenta += 1;

    // Se contesta 204 igual: la app no puede hacer nada con un error acá, y
    // reintentar un reporte descartado solo empeora la ráfaga.
    if (ventana.cuenta > MAX_POR_MINUTO) return res.status(204).end();

    if (!esReporteValido(req.body)) return res.status(204).end();

    const reporte = req.body as CrashReport;
    // Una sola línea y con prefijo: así se filtra en Torre con un grep.
    console.error(
      `[crash] ${reporte.app}@${reporte.version} ${reporte.plataforma ?? '?'} ` +
        `${reporte.pantalla ?? '?'} — ${reporte.mensaje}` +
        (reporte.stack ? `\n${reporte.stack}` : '')
    );

    res.status(204).end();
  });

  return router;
}
