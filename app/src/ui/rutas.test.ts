import { describe, expect, it } from 'vitest';
import { chatAbiertoDe, chatQueSeVe, listCovered } from './rutas';

describe('chatAbiertoDe', () => {
  it('en la lista no hay chat abierto', () => {
    expect(chatAbiertoDe({ index: 0, routes: [{ name: 'Inicio' }] })).toBeNull();
  });

  it('con un chat arriba devuelve su id', () => {
    const estado = { index: 1, routes: [{ name: 'Inicio' }, { name: 'Chat', params: { chat: { id: 'c1' } } }] };
    expect(chatAbiertoDe(estado)).toBe('c1');
  });

  /** Al volver, el chat sigue en `routes` un instante pero ya no está arriba. */
  it('solo cuenta la pantalla de ARRIBA', () => {
    const estado = { index: 0, routes: [{ name: 'Inicio' }, { name: 'Chat', params: { chat: { id: 'c1' } } }] };
    expect(chatAbiertoDe(estado)).toBeNull();
  });

  it('sin estado (navegador recién montado): nada', () => {
    expect(chatAbiertoDe(undefined)).toBeNull();
  });
});

/**
 * Con dos paneles (FL10, tablet) el chat vive al lado de la lista y no en el
 * stack. «Abierto» es el que se VE: en otra pestaña, el panel no se ve y sus
 * mensajes no cuentan como leídos.
 */
describe('chatQueSeVe', () => {
  it('el del stack, si hay uno', () => {
    expect(chatQueSeVe({ deLaPila: 'c1', enPanel: 'c2', pestana: 'agenda' })).toBe('c1');
  });

  it('el del panel, solo con la pestaña Chats a la vista', () => {
    expect(chatQueSeVe({ deLaPila: null, enPanel: 'c2', pestana: 'chats' })).toBe('c2');
    expect(chatQueSeVe({ deLaPila: null, enPanel: 'c2', pestana: 'agenda' })).toBeNull();
  });

  it('ninguno', () => {
    expect(chatQueSeVe({ deLaPila: null, enPanel: null, pestana: 'chats' })).toBeNull();
  });
});

/** What keeps the list from redrawing under the chat that is opening (plan 1, F4). */
describe('listCovered', () => {
  it('on a phone, a chat on top covers the list', () => {
    // Arrange / Act / Assert
    expect(listCovered({ chatOpen: true, focused: false, twoPanes: false })).toBe(true);
  });

  it('losing the focus already covers it: the open chat is reported after the navigation commits', () => {
    // Arrange / Act / Assert
    expect(listCovered({ chatOpen: false, focused: false, twoPanes: false })).toBe(true);
  });

  it('coming back, the chat reported until now still covers it: one redraw, not two', () => {
    // Arrange / Act / Assert
    expect(listCovered({ chatOpen: true, focused: true, twoPanes: false })).toBe(true);
  });

  it('with nothing on top, the list is seen', () => {
    // Arrange / Act / Assert
    expect(listCovered({ chatOpen: false, focused: true, twoPanes: false })).toBe(false);
  });

  it('with two panes the chat is beside the list, and the list marks it', () => {
    // Arrange / Act / Assert
    expect(listCovered({ chatOpen: true, focused: true, twoPanes: true })).toBe(false);
  });
});
