/**
 * «Gana la última» para las recargas de la lista (W3a). Dos recargas que se
 * cruzan pueden volver en desorden, y la vieja pisaba el cambio optimista
 * recién hecho (la fila fijada bajaba y volvía a subir, y cerraba el menú
 * abierto). Un cambio optimista también invalida lo que estaba en vuelo.
 */
export function crearUltimaGana() {
  let actual = 0;
  return {
    empezar: (): number => (actual += 1),
    vigente: (turno: number): boolean => turno === actual,
    invalidar: (): void => {
      actual += 1;
    },
  };
}
