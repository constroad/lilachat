/** Cuánto (en dp) cuenta como «estar abajo» en la conversación. */
export const MARGEN_DEL_FINAL = 160;

export type MedidasDeScroll = { offset: number; alto: number; contenido: number };

/**
 * Si la conversación está cerca de su final, con el alto del contenido que
 * MANDA: el último que midió la lista (`onContentSizeChange`), no el que trae
 * el evento de scroll.
 *
 * Al reabrir un chat (emulador, 18/10) el último evento de scroll llegaba
 * DESPUÉS de la medición, con el alto estimado viejo (9032 dp contra 7838
 * reales): el botón «bajar» aparecía estando abajo de todo.
 */
export class PosicionEnLaLista {
  private offset = 0;
  private alto = 0;
  private contenidoMedido: number | null = null;

  alScrollear(medidas: MedidasDeScroll): boolean {
    this.offset = medidas.offset;
    this.alto = medidas.alto;
    return this.cerca(this.contenidoMedido ?? medidas.contenido);
  }

  /**
   * `true` si el nuevo tamaño deja cerca del final; `undefined` si no hay nada
   * que decir. Nunca aleja: lo que crece abajo estando abajo lo baja el
   * autoscroll de la lista, y decir «lejos» antes haría parpadear el botón.
   */
  alCambiarTamaño(contenido: number): true | undefined {
    this.contenidoMedido = contenido;
    if (this.alto === 0) return undefined;
    return this.cerca(contenido) ? true : undefined;
  }

  private cerca(contenido: number): boolean {
    return contenido - (this.offset + this.alto) < MARGEN_DEL_FINAL;
  }
}
