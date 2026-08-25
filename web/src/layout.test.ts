import { describe, expect, it } from 'vitest';
import { BREAKPOINT_TWO_PANELS, resolveVisiblePanel } from './layout';

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
