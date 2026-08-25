/**
 * Cuántos paneles caben, y cuál se ve cuando cabe uno solo (F6).
 *
 * El diseño web es de DOS paneles —lista a la izquierda, conversación a la
 * derecha—, pero eso solo funciona con ancho. Debajo del límite se muestra uno
 * y la navegación pasa a ser «entrar y volver», como en el teléfono.
 */
export const BREAKPOINT_TWO_PANELS = 900;

export type VisiblePanel = 'both' | 'list' | 'conversation';

export function resolveVisiblePanel(params: {
  width: number;
  selectedChatId: string | null;
}): VisiblePanel {
  if (params.width >= BREAKPOINT_TWO_PANELS) return 'both';
  return params.selectedChatId ? 'conversation' : 'list';
}
