/** Cuánto (en dp) cuenta como «estar abajo» en la conversación. */
export const MARGEN_DEL_FINAL = 160;

export type MedidasDeScroll = { offset: number; alto: number; contenido: number };

/**
 * Si la conversación está PEGADA a su final, como en WhatsApp: abre abajo y
 * se queda abajo hasta que la PERSONA la arrastra hacia arriba.
 *
 * - El alto del contenido que manda es el último que midió la lista
 *   (`onContentSizeChange`), no el que trae el evento de scroll. Al reabrir un
 *   chat (emulador, 18/10) el último evento llegaba DESPUÉS de la medición, con
 *   el alto estimado viejo, y el botón «bajar» aparecía estando abajo.
 * - Solo un arrastre despega (19/10). Los eventos de scroll que produce la
 *   propia lista al acomodarse traían posiciones viejas (8 dp con 916 de
 *   contenido): leídos como «lejos», nadie seguía al final y el chat abría con
 *   las tarjetas con imagen a medio ver, una de cada tres veces.
 */
export class PosicionEnLaLista {
  private offset = 0;
  private alto = 0;
  private contenidoMedido: number | null = null;
  private pegado = true;
  private tocando = false;

  /** Devuelve si está pegada al final: es lo que esconde el botón «bajar». */
  alScrollear(medidas: MedidasDeScroll): boolean {
    this.offset = medidas.offset;
    this.alto = medidas.alto;
    const cerca = this.cerca(this.contenidoMedido ?? medidas.contenido);
    // Un scroll que no viene del dedo puede PEGAR (llegó abajo), nunca despegar.
    if (this.tocando || cerca) this.pegado = cerca;
    return this.pegado;
  }

  /** El dedo empieza a mover la lista (arrastre o el envión que le sigue). */
  alEmpezarArrastre(): void {
    this.tocando = true;
  }

  /** Terminó el arrastre o el envión: donde quedó decide si sigue pegada. */
  alTerminarArrastre(medidas: MedidasDeScroll): boolean {
    this.tocando = false;
    this.offset = medidas.offset;
    this.alto = medidas.alto;
    this.pegado = this.cerca(this.contenidoMedido ?? medidas.contenido);
    return this.pegado;
  }

  /**
   * `seguir` si está pegada y lo de abajo creció (hay que bajar: el autoscroll
   * de la lista no sigue a una FILA que crece, como la tarjeta que carga su
   * imagen); `cerca` si el nuevo tamaño la deja abajo; `undefined` si no hay
   * nada que decir. Nunca dice «lejos»: haría parpadear el botón.
   */
  alCambiarTamaño(contenido: number): 'cerca' | 'seguir' | undefined {
    const anterior = this.contenidoMedido;
    this.contenidoMedido = contenido;
    if (anterior === null) return undefined;
    if (this.pegado && !this.tocando && contenido > anterior) return 'seguir';
    if (this.alto > 0 && this.cerca(contenido)) {
      this.pegado = true;
      return 'cerca';
    }
    return undefined;
  }

  private cerca(contenido: number): boolean {
    return contenido - (this.offset + this.alto) < MARGEN_DEL_FINAL;
  }
}
