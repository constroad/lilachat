import { describe, expect, it } from 'vitest';
import { BREAKPOINT_TWO_PANELS, clampListWidth, CONVERSATION_MIN_WIDTH, LIST_DEFAULT_WIDTH, LIST_MAX_WIDTH, LIST_MIN_WIDTH, resolveVisiblePanel } from './layout';

/**
 * Los dos paneles del diseño web, y qué pasa cuando no caben.
 *
 * En una ventana angosta —un celular, o el navegador a media pantalla— dos
 * paneles de 25/75 dejan una lista ilegible y una conversación estrecha. Ahí se
 * muestra UNO solo, y cuál depende de si hay conversación abierta.
 */
describe('resolveVisiblePanel', () => {
  it('en escritorio muestra los dos, con o sin chat abierto', () => {
    expect(resolveVisiblePanel({ width: 1280, selectedChatId: null })).toBe('both');
    expect(resolveVisiblePanel({ width: 1280, selectedChatId: 'c1' })).toBe('both');
  });

  it('angosto y sin chat abierto: la lista', () => {
    expect(resolveVisiblePanel({ width: 420, selectedChatId: null })).toBe('list');
  });

  it('angosto con un chat abierto: la conversación', () => {
    expect(resolveVisiblePanel({ width: 420, selectedChatId: 'c1' })).toBe('conversation');
  });

  /**
   * El límite se prueba en su valor exacto: un `>` en vez de `>=` deja la
   * ventana justo en el breakpoint con los dos paneles apretados, y es el error
   * que nadie ve porque casi nadie mide exactamente ahí.
   */
  it('el límite entra en dos paneles', () => {
    expect(resolveVisiblePanel({ width: BREAKPOINT_TWO_PANELS, selectedChatId: null })).toBe('both');
    expect(resolveVisiblePanel({ width: BREAKPOINT_TWO_PANELS - 1, selectedChatId: null })).toBe(
      'list'
    );
  });
});

/** José, 21/10: the chat list is dragged wider or narrower, and folds away. */
describe('clampListWidth', () => {
  it('stays between its minimum and maximum', () => {
    expect(clampListWidth(100, 1600)).toBe(LIST_MIN_WIDTH);
    expect(clampListWidth(900, 1600)).toBe(LIST_MAX_WIDTH);
    expect(clampListWidth(420, 1600)).toBe(420);
  });
  it('always leaves room for the conversation', () => {
    expect(clampListWidth(560, 900)).toBe(900 - CONVERSATION_MIN_WIDTH);
  });
  it('a broken saved value falls back to the default', () => {
    expect(clampListWidth(Number.NaN, 1600)).toBe(LIST_DEFAULT_WIDTH);
  });
});
