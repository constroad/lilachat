import { Router } from 'express';
import { esReporteValido, type CrashReport } from '@lilachat/shared';
import { alertarCrash } from './alertaTelegram.js';
import { registro } from './registro.js';

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
 * El reporte sale por DOS caminos, y hacen falta los dos:
 *
 * - **Al log de errores** (`chat-err.log`, pestaña «chat · errores» en Torre),
 *   con hora y con el stack completo. Es el registro, para investigar.
 * - **A Telegram**, deduplicado. Es el aviso, para enterarse.
 *
 * Tener solo el primero fue el error del 26/08/2026: la línea se escribía y
 * nadie la veía, porque un log hay que ir a mirarlo y encima había que acertar
 * la pestaña —José buscaba en «chat · aplicación», que es stdout—. Un error que
 * exige que ya sospeches de él no te avisa de nada.
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
    registro.error(
      `[crash] ${reporte.app}@${reporte.version} ${reporte.plataforma ?? '?'} ` +
        `${reporte.pantalla ?? '?'} — ${reporte.mensaje}` +
        (reporte.stack ? `\n${reporte.stack}` : '')
    );
    // El aviso NO bloquea la respuesta: la app no puede hacer nada con el
    // resultado y esperar a Telegram le sumaría segundos a un teléfono que
    // acaba de romperse.
    alertarCrash(reporte);

    res.status(204).end();
  });

  return router;
}
