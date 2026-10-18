import { describe, expect, it } from 'vitest';
import { programadosDelChat, textoDeProgramados } from './programados';

const CHAT = '6a90cf9012ab34cd56ef7890';
const OTRO = '6a90cf9012ab34cd56ef7891';

/** Ver y cancelar los programados de un chat (FL9d; auditoría §46.2). */
describe('programadosDelChat', () => {
  it('solo los de este chat, del más próximo al más lejano', () => {
    const lista = [
      { id: 'b', chatId: CHAT, body: 'después', sendAt: '2026-10-18T15:00:00.000Z' },
      { id: 'x', chatId: OTRO, body: 'otro chat', sendAt: '2026-10-18T09:00:00.000Z' },
      { id: 'a', chatId: CHAT, body: 'antes', sendAt: '2026-10-18T10:00:00.000Z' },
    ];

    expect(programadosDelChat(lista, CHAT).map((uno) => uno.id)).toEqual(['a', 'b']);
  });
});

describe('textoDeProgramados', () => {
  it('singular y plural', () => {
    expect(textoDeProgramados(1)).toBe('1 mensaje programado');
    expect(textoDeProgramados(3)).toBe('3 mensajes programados');
  });
});
