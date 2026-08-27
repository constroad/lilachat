import { armarReporte, debeAlertar, textoDeAlerta, type CrashReport } from '@lilachat/shared';
import { registro } from './registro.js';

/**
 * El empujón: que el error salga a buscarte en vez de esperarte en un archivo.
 *
 * Desde el 26/08/2026 un crash dejaba su línea en el log. No alcanzó, y el 27
 * José lo dijo con todas las letras: «estoy prácticamente a ciegas». Tenía
 * razón — **nadie abre un log por las dudas**. Un error solo existe si te
 * interrumpe.
 *
 * Se usa el MISMO bot que lila-app (`TELEGRAM_BOT_TOKEN`) y su canal de
 * **errors-tracking**: no hace falta un canal nuevo para terminar mirando en dos
 * lugares, y los fallos de las tres apps conviene leerlos juntos.
 *
 * **Nunca lanza.** Un aviso que rompe el endpoint al fallar convierte al sistema
 * de alertas en la causa de la próxima caída.
 */
/**
 * El TOKEN sí es variable de entorno: es un secreto, y con él cualquiera escribe
 * como el bot. No va al repositorio.
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

/**
 * El CANAL es una constante, no una variable de entorno (pedido de José,
 * 27/08/2026). Dos razones:
 *
 * - **No es un secreto.** Un `chat_id` sin el token del bot no sirve para nada:
 *   no se puede leer el canal ni escribir en él. Lo que hay que proteger es el
 *   token, y ese sigue afuera.
 * - **Configurable era peor.** Una variable de entorno para esto significa que a
 *   dónde van los errores depende de un archivo en la máquina, y si falta o está
 *   mal escrita el sistema queda mudo **sin dar señal** — que es exactamente el
 *   fallo que este módulo existe para evitar. Fue lo que pasó: las variables no
 *   estaban en el `.env` de lilachat y las alertas nunca salieron.
 *
 * Es **errors-tracking**, no el canal de alertas. Ahí van los fallos técnicos;
 * el de alertas es para avisos de negocio y mezclarlos hace que se silencien los
 * dos. (Antes esto quedaba bajo el nombre `TELEGRAM_ALERTS_CHAT_ID` con el id de
 * errores adentro, que era lo peor de las dos opciones: el destino correcto con
 * el nombre equivocado.)
 */
const CANAL = '-1003063986345';
const TIMEOUT_MS = 8_000;

/**
 * Huella → cuándo se avisó por última vez.
 *
 * En memoria y se pierde al reiniciar, que está bien: protege de la ráfaga de
 * una pantalla en bucle, no de un error que vuelve mañana —ese sí queremos
 * volver a verlo—. La decisión de mandar o no vive en `shared/alerta.ts`, con
 * sus tests; acá solo está el estado y la red.
 */
const vistos = new Map<string, number>();

/** Techo del mapa: un atacante que varíe el mensaje no puede hacerlo crecer sin fin. */
const MAX_HUELLAS = 500;

export function alertarCrash(reporte: CrashReport): void {
  if (!TOKEN || !CANAL) return; // sin bot configurado, el log es lo único que hay

  const { alertar, huella } = debeAlertar({ reporte, ahora: Date.now(), vistos });
  if (!alertar) return;

  if (vistos.size >= MAX_HUELLAS) vistos.clear();
  vistos.set(huella, Date.now());

  void fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CANAL, text: textoDeAlerta(reporte) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => {
      // Un 400 de Telegram (canal mal puesto, bot sin permiso) es silencioso si
      // no se mira: quedaría creyendo que las alertas funcionan.
      if (!res.ok) registro.error(`[alerta] Telegram respondió ${res.status}`);
    })
    .catch((e: unknown) => {
      registro.error(`[alerta] no se pudo avisar: ${(e as Error).message}`);
    });
}

/**
 * Lo mismo, pero para lo que se rompe en el SERVER.
 *
 * Un `uncaughtException` en la mini era hasta hoy tan invisible como el crash de
 * un teléfono: quedaba en `chat-err.log` esperando que alguien fuera a mirar.
 * Y es peor que el del teléfono — el del teléfono lo sufre una persona; este los
 * deja a todos sin chat.
 *
 * Pasa por el MISMO dedupe: un error en una ruta que se llama todo el tiempo
 * dispararía un aviso por request.
 */
export function alertarServidor(contexto: string, error: unknown): void {
  alertarCrash(
    armarReporte({
      app: 'lilachat',
      version: process.env.npm_package_version ?? 'server',
      plataforma: 'server',
      pantalla: contexto,
      error,
      enviadoEn: new Date().toISOString(),
    })
  );
}
