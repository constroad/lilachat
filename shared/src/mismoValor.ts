/**
 * ¿Dos valores JSON son iguales? PURO (FL12, §49 #6).
 *
 * Un mensaje llega por el socket, el sync y el saneo, cada vez como objeto
 * nuevo. Comparar el CONTENIDO deja conservar la referencia vieja, que es lo
 * que permite que `memo` frene el redibujo de una burbuja que no cambió.
 * Solo valores JSON (lo que viaja y se guarda): sin fechas, mapas ni ciclos.
 */
export function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((valor, indice) => mismoValor(valor, b[indice]));
  }
  const unos = a as Record<string, unknown>;
  const otros = b as Record<string, unknown>;
  const claves = Object.keys(unos).filter((clave) => unos[clave] !== undefined);
  const clavesOtro = Object.keys(otros).filter((clave) => otros[clave] !== undefined);
  return claves.length === clavesOtro.length && claves.every((clave) => mismoValor(unos[clave], otros[clave]));
}
