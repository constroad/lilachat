import { describe, expect, it } from 'vitest';
import { debeSonarEnLaWeb } from './sonidoDeMensaje';

/** José, 20/10: «no hay sonido cuando recibo un mensaje en la web». Las reglas de WhatsApp Web. */
describe('debeSonarEnLaWeb', () => {
  const base = { senderId: 'ana', yo: 'yo', chatId: 'c1', abierto: 'c2', visible: true, silenciado: false, kind: 'text' };
  it('suena un mensaje de otro en un chat que no estoy mirando', () => {
    expect(debeSonarEnLaWeb(base)).toBe(true);
  });
  it('suena aunque sea el chat abierto si la pestaña está oculta', () => {
    expect(debeSonarEnLaWeb({ ...base, abierto: 'c1', visible: false })).toBe(true);
  });
  it('no suena: lo mío, el chat que miro con la pestaña visible, un chat silenciado o un aviso del sistema', () => {
    expect(debeSonarEnLaWeb({ ...base, senderId: 'yo' })).toBe(false);
    expect(debeSonarEnLaWeb({ ...base, abierto: 'c1' })).toBe(false);
    expect(debeSonarEnLaWeb({ ...base, silenciado: true })).toBe(false);
    expect(debeSonarEnLaWeb({ ...base, kind: 'system' })).toBe(false);
    expect(debeSonarEnLaWeb({ ...base, soloEnElHilo: true })).toBe(false);
  });
});
