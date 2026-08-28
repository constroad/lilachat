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
 * El nombre completo, con la fecha adelante para que ordene solo.
 *
 * `Lilachat-2026-08-28-1144.jpg`: quien abre la galería meses después reconoce
 * de dónde salió y cuándo, sin abrirla.
 */
export function nombreDeArchivo(params: { cuando: Date; mime?: string; seq: number }): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const f = params.cuando;
  const fecha = `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
  const hora = `${p(f.getHours())}${p(f.getMinutes())}`;
  // El `seq` desempata: dos fotos del mismo minuto se pisarían el nombre, y
  // guardar la segunda encima de la primera es perder una sin avisar.
  return `Lilachat-${fecha}-${hora}-${params.seq}.${extensionDe(params.mime)}`;
}
