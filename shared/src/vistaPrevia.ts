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
};
