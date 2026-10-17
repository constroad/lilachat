/**
 * Qué pestañas quedan montadas (FL3, «al cambiar de pestaña sale un skeleton»,
 * José 17/10/2026). Cada pestaña se monta la PRIMERA vez que se visita y
 * después solo se oculta: remontarla rearmaba la lista de cero y mostraba el
 * esqueleto mientras leía el disco. WhatsApp no recarga al cambiar de pestaña.
 */
export function visitadasCon<T extends string>(visitadas: ReadonlySet<T>, activa: T): ReadonlySet<T> {
  if (visitadas.has(activa)) return visitadas;
  return new Set([...visitadas, activa]);
}
