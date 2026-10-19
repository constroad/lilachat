/**
 * Un límite simple por clave (la IP) y ventana fija, en memoria. Alcanza para
 * los pedidos SIN sesión (pedir un QR): el server es un solo proceso, y si se
 * reinicia el contador vuelve a cero, que para un límite anti-abuso está bien.
 */
export function crearLimiteDeIntentos(opciones: { maximo: number; ventanaMs: number; ahora?: () => number }) {
  const ahora = opciones.ahora ?? Date.now;
  const ventanas = new Map<string, { desde: number; usados: number }>();

  const olvidarViejas = () => {
    for (const [clave, ventana] of ventanas) if (ahora() - ventana.desde > opciones.ventanaMs) ventanas.delete(clave);
  };

  return {
    permitir(clave: string): boolean {
      olvidarViejas();
      const ventana = ventanas.get(clave) ?? { desde: ahora(), usados: 0 };
      ventana.usados += 1;
      ventanas.set(clave, ventana);
      return ventana.usados <= opciones.maximo;
    },
    claves: (): number => ventanas.size,
  };
}
