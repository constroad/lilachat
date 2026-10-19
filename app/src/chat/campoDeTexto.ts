/** Lo único del texto que cambia cómo se ve la barra de escribir. PURO. */
export type FormaDelTexto = { vacio: boolean; conTexto: boolean };

/**
 * FL12 (§49 #15): el campo dejó de ser controlado y la barra solo se redibuja
 * cuando cambia esto — no por cada tecla. `vacio` muestra el clip y la cámara;
 * `conTexto` cambia el micrófono por enviar (con solo espacios no hay qué mandar).
 */
export function formaDelTexto(texto: string): FormaDelTexto {
  return { vacio: texto.length === 0, conTexto: texto.trim().length > 0 };
}
