/**
 * La tarjeta de un enlace en el chat (José, 18/10: «como WhatsApp con el
 * SEO»). La arma el server leyendo las etiquetas `og:` de la página.
 */
export type VistaPreviaDeEnlace = {
  /** El enlace tal como se pidió (no el `og:url`, que la página puede inventar). */
  url: string;
  titulo: string;
  descripcion?: string;
  /** Absoluta y http(s). */
  imagen?: string;
  /** `og:site_name`, o el dominio sin `www.`. */
  sitio: string;
  /** Un video (YouTube, TikTok, un reel): la tarjeta lleva el botón de play sobre la miniatura (20/10). */
  video?: boolean;
};

/** Por debajo de esta proporción (ancho/alto) la imagen es un ícono, un logo o un perfil. */
const PROPORCION_MINIMA_ANCHA = 1.3;

/**
 * ¿La imagen de la tarjeta va chica al costado (un logo, una foto de perfil)
 * en vez de grande arriba? Como WhatsApp (20/10: el logo de Instagram salía
 * estirado en la web). Un video va siempre grande, con el play encima.
 */
export function esMiniaturaCompacta(medidas: { ancho: number; alto: number; video?: boolean }): boolean {
  if (medidas.video || medidas.ancho <= 0 || medidas.alto <= 0) return false;
  return medidas.ancho / medidas.alto < PROPORCION_MINIMA_ANCHA;
}
