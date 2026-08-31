import { describe, expect, it } from 'vitest';
import { sonarPorMensaje } from './sonarPorMensaje';

const base = { senderId: 'otro', chatId: 'chatA', yo: 'yo', chatAbierto: null };

describe('sonarPorMensaje', () => {
  it('suena para un mensaje de otra persona en cualquier chat', () => {
    expect(sonarPorMensaje(base)).toBe(true);
  });

  it('NO suena para lo que yo mismo mando', () => {
    expect(sonarPorMensaje({ ...base, senderId: 'yo' })).toBe(false);
  });

  it('NO suena para el chat que estoy mirando', () => {
    expect(sonarPorMensaje({ ...base, chatId: 'chatA', chatAbierto: 'chatA' })).toBe(false);
  });

  it('SÍ suena para OTRO chat mientras estoy dentro de uno', () => {
    expect(sonarPorMensaje({ ...base, chatId: 'chatB', chatAbierto: 'chatA' })).toBe(true);
  });

  it('lo mío sigue sin sonar aunque no sea el chat abierto', () => {
    expect(sonarPorMensaje({ ...base, senderId: 'yo', chatId: 'chatB', chatAbierto: 'chatA' })).toBe(
      false
    );
  });
});
