import { describe, expect, it } from 'vitest';
import { alternarDestino, destinosDeReenvio, MAXIMO_DE_DESTINOS, sumarEnvio, type ChatParaReenviar } from './reenvio.js';

/** Reenviar como WhatsApp (José, 20/10): frecuentes, recientes, búsqueda y hasta 5. */
const AHORA = Date.parse('2026-10-20T15:00:00.000Z');
const DIA = 24 * 3_600_000;
const chat = (id: string, extra: Partial<ChatParaReenviar> = {}): ChatParaReenviar => ({ id, nombre: id, ...extra });

describe('sumarEnvio', () => {
  it('cada envío suma uno', () => {
    const una = sumarEnvio({}, 'obra', AHORA);
    expect(sumarEnvio(una, 'obra', AHORA).obra?.puntaje).toBe(2);
  });
  it('lo viejo pesa menos: a la semana vale la mitad', () => {
    const viejo = { obra: { puntaje: 4, en: AHORA - 7 * DIA } };
    expect(sumarEnvio(viejo, 'obra', AHORA).obra?.puntaje).toBeCloseTo(3);
  });
  it('no muta lo que recibe', () => {
    const antes = { obra: { puntaje: 1, en: AHORA } };
    sumarEnvio(antes, 'obra', AHORA);
    expect(antes.obra.puntaje).toBe(1);
  });
});

describe('destinosDeReenvio', () => {
  const chats = [
    chat('ana', { ultimoEn: '2026-10-20T14:00:00.000Z' }),
    chat('obra', { ultimoEn: '2026-10-19T10:00:00.000Z', esGrupo: true }),
    chat('carlos', { ultimoEn: '2026-10-20T14:30:00.000Z' }),
    chat('secreto', { ultimoEn: '2026-10-20T14:59:00.000Z', cifrado: true }),
    chat('familia', { ultimoEn: '2026-10-18T10:00:00.000Z', esGrupo: true }),
  ];
  const frecuencias = { obra: { puntaje: 9, en: AHORA }, familia: { puntaje: 2, en: AHORA }, ana: { puntaje: 5, en: AHORA } };

  it('frecuentes: los tres con más envíos; recientes: el resto, el último primero', () => {
    const { frecuentes, recientes } = destinosDeReenvio({ chats, frecuencias, busqueda: '', ahora: AHORA });
    expect(frecuentes.map((uno) => uno.id)).toEqual(['obra', 'ana', 'familia']);
    expect(recientes.map((uno) => uno.id)).toEqual(['carlos']);
  });

  it('un chat secreto no aparece (el texto tendría que salir cifrado)', () => {
    const { frecuentes, recientes } = destinosDeReenvio({ chats, frecuencias: {}, busqueda: '', ahora: AHORA });
    expect([...frecuentes, ...recientes].some((uno) => uno.id === 'secreto')).toBe(false);
  });

  it('sin historial de envíos no hay frecuentes: todos van a recientes', () => {
    const { frecuentes, recientes } = destinosDeReenvio({ chats, frecuencias: {}, busqueda: '', ahora: AHORA });
    expect(frecuentes).toEqual([]);
    expect(recientes.map((uno) => uno.id)).toEqual(['carlos', 'ana', 'obra', 'familia']);
  });

  it('buscando: una sola lista, sin tildes ni mayúsculas', () => {
    const conTilde = [...chats, chat('María José', { ultimoEn: '2026-10-17T10:00:00.000Z' })];
    const { frecuentes, recientes } = destinosDeReenvio({ chats: conTilde, frecuencias, busqueda: 'MARIA', ahora: AHORA });
    expect(frecuentes).toEqual([]);
    expect(recientes.map((uno) => uno.id)).toEqual(['María José']);
  });
});

describe('alternarDestino', () => {
  it('suma y saca', () => {
    expect(alternarDestino([], 'ana')).toEqual({ elegidos: ['ana'], lleno: false });
    expect(alternarDestino(['ana', 'obra'], 'ana')).toEqual({ elegidos: ['obra'], lleno: false });
  });
  it('hasta 5, como WhatsApp: el sexto no entra y avisa', () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'];
    expect(MAXIMO_DE_DESTINOS).toBe(5);
    expect(alternarDestino(cinco, 'f')).toEqual({ elegidos: cinco, lleno: true });
    expect(alternarDestino(cinco, 'c').elegidos).toEqual(['a', 'b', 'd', 'e']);
  });
});
