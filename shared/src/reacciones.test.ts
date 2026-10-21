import { describe, expect, it } from 'vitest';
import { aplicarReaccion, EMOJIS_RAPIDOS, esEmojiDeReaccion, miReaccion, puedeReaccionar, resumenDeReacciones, textoDelAvisoDeReaccion } from './reacciones.js';

/** Reacciones (20/10): como WhatsApp, una por persona. */
describe('EMOJIS_RAPIDOS', () => {
  it('son los seis de la barra, en el orden del diseño', () => {
    expect(EMOJIS_RAPIDOS).toEqual(['👍', '❤️', '😂', '😮', '😢', '🙏']);
  });
});

describe('esEmojiDeReaccion', () => {
  it('acepta un emoji, también los compuestos (tono de piel, banderas, familias)', () => {
    for (const emoji of ['👍', '❤️', '👍🏽', '🇵🇪', '👨‍👩‍👧', '🙏']) expect(esEmojiDeReaccion(emoji)).toBe(true);
  });
  it('rechaza texto, varios emojis, vacío y lo que no es string', () => {
    for (const valor of ['', 'hola', 'a👍', '👍👍', '  ', '<b>', 42, null, undefined]) expect(esEmojiDeReaccion(valor)).toBe(false);
  });
});

describe('aplicarReaccion', () => {
  const en = '2026-10-20T15:00:00.000Z';
  it('suma la primera reacción', () => {
    expect(aplicarReaccion(undefined, 'ana', '👍', en)).toEqual([{ userId: 'ana', emoji: '👍', en }]);
  });
  it('una por persona: otra reemplaza a la anterior (y va al final)', () => {
    const antes = [{ userId: 'ana', emoji: '👍', en }, { userId: 'beto', emoji: '❤️', en }];
    expect(aplicarReaccion(antes, 'ana', '😂', en)).toEqual([{ userId: 'beto', emoji: '❤️', en }, { userId: 'ana', emoji: '😂', en }]);
  });
  it('null quita la mía y deja las demás', () => {
    const antes = [{ userId: 'ana', emoji: '👍', en }, { userId: 'beto', emoji: '❤️', en }];
    expect(aplicarReaccion(antes, 'ana', null, en)).toEqual([{ userId: 'beto', emoji: '❤️', en }]);
  });
  it('no muta la lista original', () => {
    const antes = [{ userId: 'ana', emoji: '👍', en }];
    aplicarReaccion(antes, 'ana', null, en);
    expect(antes).toHaveLength(1);
  });
});

describe('resumenDeReacciones', () => {
  it('agrupa por emoji, el más usado primero; empate: el que llegó antes', () => {
    const resumen = resumenDeReacciones(
      [
        { userId: 'carla', emoji: '❤️' },
        { userId: 'ana', emoji: '👍' },
        { userId: 'yo', emoji: '👍' },
      ],
      'yo'
    );
    expect(resumen).toEqual([
      { emoji: '👍', cuantos: 2, mia: true, quienes: ['ana', 'yo'] },
      { emoji: '❤️', cuantos: 1, mia: false, quienes: ['carla'] },
    ]);
  });
  it('sin reacciones, vacío', () => {
    expect(resumenDeReacciones(undefined, 'yo')).toEqual([]);
  });
});

describe('miReaccion', () => {
  it('la mía, o null', () => {
    expect(miReaccion([{ userId: 'yo', emoji: '🙏' }], 'yo')).toBe('🙏');
    expect(miReaccion([{ userId: 'ana', emoji: '🙏' }], 'yo')).toBeNull();
  });
});

describe('puedeReaccionar', () => {
  it('a un mensaje confirmado y vivo de un chat no secreto', () => {
    expect(puedeReaccionar({ seq: 3 })).toBe(true);
  });
  it('no a lo pendiente, lo borrado, los avisos ni en un chat secreto', () => {
    expect(puedeReaccionar({ seq: null })).toBe(false);
    expect(puedeReaccionar({ seq: 3, deletedAt: '2026-10-20' })).toBe(false);
    expect(puedeReaccionar({ seq: 3, kind: 'system' })).toBe(false);
    expect(puedeReaccionar({ seq: 3, cifrado: true })).toBe(false);
  });
  it('yes to the reminder that rang in the chat (21/10), not to a grey notice', () => {
    expect(puedeReaccionar({ seq: 3, kind: 'system', system: { evento: 'recordatorio-suena' } })).toBe(true);
    expect(puedeReaccionar({ seq: 3, kind: 'system', system: { evento: 'salio' } })).toBe(false);
  });
});

describe('textoDelAvisoDeReaccion', () => {
  it('dice el emoji y a qué mensaje, recortado', () => {
    expect(textoDelAvisoDeReaccion('👍', 'Perfecto, aviso al cliente')).toBe('Reaccionó 👍 a «Perfecto, aviso al cliente»');
    expect(textoDelAvisoDeReaccion('❤️', 'x'.repeat(80))).toBe(`Reaccionó ❤️ a «${'x'.repeat(40)}…»`);
  });
  it('sin texto (foto, audio), dice a tu mensaje', () => {
    expect(textoDelAvisoDeReaccion('😂', undefined)).toBe('Reaccionó 😂 a tu mensaje');
  });
});
