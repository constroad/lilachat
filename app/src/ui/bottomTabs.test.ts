import { describe, expect, it } from 'vitest';
import { tabAfterModeChange, tabsFor } from './bottomTabs';

/** José, 21/10: in a company space the bar still showed the personal one (design `e-07-lista-espacio`). */
describe('bottom tabs', () => {
  it('personal: Chats, Pendientes, Encuestas, Ajustes', () => {
    expect(tabsFor(false)).toEqual(['chats', 'agenda', 'encuestas', 'ajustes']);
  });

  it('in a company space: Chats, Directorio, Menciones, Ajustes', () => {
    expect(tabsFor(true)).toEqual(['chats', 'directory', 'mentions', 'ajustes']);
  });

  it('a tab the new bar does not have goes back to Chats', () => {
    expect(tabAfterModeChange('agenda', true)).toBe('chats');
    expect(tabAfterModeChange('encuestas', true)).toBe('chats');
    expect(tabAfterModeChange('directory', false)).toBe('chats');
  });

  it('a tab both bars have stays', () => {
    expect(tabAfterModeChange('ajustes', true)).toBe('ajustes');
    expect(tabAfterModeChange('chats', false)).toBe('chats');
  });
});
