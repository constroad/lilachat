/**
 * El log con hora.
 *
 * José, 27/08/2026, mirando Torre: «los logs solo hay de inicio de app, ni
 * siquiera muestra la hora». Lo que veía era esto, repetido veinte veces:
 *
 *     [lilachat] escuchando en :3004
 *     [lilachat] mongo conectado
 *
 * Sin marca de tiempo no se puede responder ninguna de las preguntas que uno le
 * hace a un log: ¿esto fue hoy?, ¿son dos deploys o un bucle de reinicios?,
 * ¿pasó antes o después del error que estoy buscando? Un log sin hora es una
 * lista de cosas que pasaron alguna vez.
 */
export type NivelDeLog = 'info' | 'error';

/**
 * La zona se FIJA en Lima, no se toma del sistema.
 *
 * Lección de `server-timezone-changed-with-hosting`: esta app ya se mudó de host
 * una vez y la zona del proceso cambió con la mudanza. Un log fechado en «la
 * hora del server» obliga a saber dónde corre el server para poder leerlo, y esa
 * respuesta cambia sin que nadie avise.
 */
const ZONA = 'America/Lima';

const FORMATO = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Arma la línea. PURA y exportada para su test: la hora es justo el tipo de cosa
 * que se cree obvia y sale mal (el día cambia antes que la hora).
 *
 * Un mensaje de varias líneas solo lleva la marca en la primera: prefijar cada
 * línea de un stack lo vuelve inservible para quien lo copia y lo pega.
 */
export function lineaDeRegistro(params: {
  nivel: NivelDeLog;
  mensaje: string;
  en: Date;
}): string {
  // `sv-SE` da directamente «2026-08-27 09:03:16», que es ISO sin la T ni la
  // zona: legible de un vistazo y ordenable como texto.
  const marca = FORMATO.format(params.en);
  // El nivel se rellena a 5 para que los mensajes queden alineados en columna.
  const nivel = params.nivel.toUpperCase().padEnd(5);

  const [primera, ...resto] = params.mensaje.split('\n');
  return [`${marca} ${nivel} ${primera}`, ...resto].join('\n');
}

/**
 * Lo normal va a **stdout** y los errores a **stderr**, que en la mini son dos
 * archivos distintos (`chat.log` y `chat-err.log`) y en Torre dos pestañas
 * distintas.
 *
 * Esa separación fue exactamente por qué José no encontraba los reportes de
 * crash: los buscaba en «chat · aplicación» y estaban en «chat · errores».
 * La separación está bien —es lo que deja grepear los errores— pero **no puede
 * ser el único camino**: por eso un crash además dispara un aviso a Telegram,
 * que es lo que llega sin que nadie vaya a mirar.
 */
/**
 * Las funciones reales, guardadas ANTES de sellar.
 *
 * `registro` escribe por acá y no por `console`: si usara el `console` ya
 * sellado, la línea saldría con la marca dos veces.
 */
const originales = { log: console.log, error: console.error, warn: console.warn };

export const registro = {
  info(mensaje: string): void {
    originales.log(lineaDeRegistro({ nivel: 'info', mensaje, en: new Date() }));
  },
  error(mensaje: string): void {
    originales.error(lineaDeRegistro({ nivel: 'error', mensaje, en: new Date() }));
  },
};

/**
 * Le pone la hora a TODO lo que ya escribe el server, sin tocar las 22 llamadas
 * a `console` repartidas por el código.
 *
 * Se elige esto y no un reemplazo masivo por dos motivos. El primero es el
 * riesgo: cambiar 22 líneas para no cambiar ningún comportamiento es un diff
 * grande donde solo pueden aparecer regresiones. El segundo es la cobertura —
 * y es el que decide—: **también le pone hora a lo que no escribimos nosotros**,
 * como el aviso de una dependencia o un `warning` de Node. Un log donde algunas
 * líneas tienen hora y otras no es peor que uno sin hora, porque invita a
 * ordenarlas como si fueran comparables.
 *
 * El prefijo va como PRIMER ARGUMENTO, no concatenado: así `console.error('x:',
 * error)` conserva el formateo que Node le da al objeto de error. Concatenar lo
 * convertiría en «[object Object]».
 *
 * Se llama UNA vez desde `index.ts` y es idempotente: dos llamadas no anidan dos
 * prefijos.
 */
let sellada = false;

export function sellarConsola(): void {
  if (sellada) return;
  sellada = true;

  const marca = (nivel: NivelDeLog) => lineaDeRegistro({ nivel, mensaje: '', en: new Date() }).trimEnd();

  console.log = (...args: unknown[]) => originales.log(marca('info'), ...args);
  console.warn = (...args: unknown[]) => originales.warn(marca('error'), ...args);
  console.error = (...args: unknown[]) => originales.error(marca('error'), ...args);
}
