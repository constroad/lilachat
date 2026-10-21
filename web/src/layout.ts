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

/** The chat list's width, dragged by its handle (José, 21/10), in px. */
export const LIST_MIN_WIDTH = 280;
export const LIST_MAX_WIDTH = 560;
export const LIST_DEFAULT_WIDTH = 380;
/** The conversation never gets narrower than this. */
export const CONVERSATION_MIN_WIDTH = 420;

export function clampListWidth(width: number, windowWidth: number): number {
  if (!Number.isFinite(width)) return LIST_DEFAULT_WIDTH;
  const max = Math.max(LIST_MIN_WIDTH, Math.min(LIST_MAX_WIDTH, windowWidth - CONVERSATION_MIN_WIDTH));
  return Math.round(Math.min(max, Math.max(LIST_MIN_WIDTH, width)));
}
