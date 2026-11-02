/**
 * The stack of in-window overlays (plan 1, F1), pure. The host keeps it in
 * React state, so returning the SAME array when nothing changes is what lets
 * React skip a render.
 */
type WithId = { id: number };

/** A new layer goes on top; an existing one is replaced where it is. */
export function replaceOrAppend<T extends WithId>(layers: T[], layer: T): T[] {
  const present = layers.some((existing) => existing.id === layer.id);
  return present ? layers.map((existing) => (existing.id === layer.id ? layer : existing)) : [...layers, layer];
}

/** Without that layer; the same array when it was not there. */
export function removeLayer<T extends WithId>(layers: T[], id: number): T[] {
  return layers.some((layer) => layer.id === id) ? layers.filter((layer) => layer.id !== id) : layers;
}
