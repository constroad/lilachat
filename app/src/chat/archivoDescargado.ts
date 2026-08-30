/**
 * Cómo se llama el archivo que se guarda o se comparte. Motor PURO.
 *
 * Parece un detalle y no lo es: el nombre es lo que la persona ve en su galería
 * y lo que le llega a quien se lo comparte. Y las URLs de la media traen un
 * identificador de almacenamiento, no un nombre — guardar «a3f9c1e8» en la
 * galería es guardar algo que después nadie encuentra.
 */

/** La extensión que corresponde a cada tipo, para lo que sabemos manejar. */
const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

/**
 * **La extensión sale del `mime`, no de la URL.**
 *
 * Las URLs de la media no la traen, y adivinarla del final de la ruta produce
 * cosas como `foto.a3f9c1e8`. Android decide con qué app abrir un archivo por su
 * extensión: una equivocada hace que la foto guardada no se abra con nada.
 */
export function extensionDe(mime: string | undefined): string {
  if (!mime) return 'jpg';
  return EXTENSIONES[mime.toLowerCase()] ?? 'jpg';
}

/**
 * El nombre LIMPIO de un archivo para mostrar y para guardar.
 *
 * El original llega a veces URL-encodeado —«Cotizacion%20(1).pdf»— porque el
 * selector o el storage lo escaparon; mostrado así se ve como un error de la
 * app. Se decodifica, y se le quitan los caracteres que rompen una ruta de
 * archivo (`/`, `\`, saltos de línea): un nombre con una barra haría que la
 * descarga apunte a una carpeta que no existe.
 */
export function nombreLimpio(nombre: string): string {
  let limpio = nombre;
  try {
    limpio = decodeURIComponent(nombre);
  } catch {
    // Un `%` suelto que no es un escape válido: se deja como está en vez de
    // tirar. Vale más un nombre feo que una excepción.
  }
  return limpio.replace(/[/\\\n\r\t]+/g, ' ').trim() || 'archivo';
}

/**
 * El nombre completo, con la fecha adelante para que ordene solo.
 *
 * `Lilachat-2026-08-28-1144.jpg`: quien abre la galería meses después reconoce
 * de dónde salió y cuándo, sin abrirla.
 */
export function nombreDeArchivo(params: {
  cuando: Date;
  mime?: string;
  seq: number;
  /** El nombre original, si lo hay: un documento se guarda con SU nombre. */
  original?: string;
}): string {
  // Un DOCUMENTO conserva su nombre real, pero **SEGURO PARA UNA RUTA**: un
  // «Cotizacion-289-REYNALDO (1).pdf» con espacios y paréntesis rompía la
  // descarga a la cache y la URI que se le pasa al visor —el PDF abría en
  // blanco (30/08/2026)—. Se decodifica, se limpia y se cambia todo lo que no
  // sea seguro por `_`, conservando la extensión. La persona igual VE el nombre
  // bonito: eso lo da `nombreLimpio`, que se usa para mostrar, no para el disco.
  const esMedia = (params.mime ?? '').startsWith('image/') || (params.mime ?? '').startsWith('video/');
  if (params.original && !esMedia) {
    let decodificado = params.original;
    try {
      decodificado = decodeURIComponent(params.original);
    } catch {
      /* un % suelto: se usa el crudo */
    }
    const seguro = decodificado
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    // Tiene que quedar ALGO alfanumerico: un nombre de puros simbolos limpiado
    // a `_` no sirve, y ahi es mejor el nombre con fecha.
    if (/[A-Za-z0-9]/.test(seguro)) return seguro;
  }

  const p = (n: number) => String(n).padStart(2, '0');
  const f = params.cuando;
  const fecha = `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
  const hora = `${p(f.getHours())}${p(f.getMinutes())}`;
  // El `seq` desempata: dos fotos del mismo minuto se pisarían el nombre, y
  // guardar la segunda encima de la primera es perder una sin avisar.
  return `Lilachat-${fecha}-${hora}-${params.seq}.${extensionDe(params.mime)}`;
}
