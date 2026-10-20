import { describe, expect, it } from 'vitest';
import type { OutboxItem } from '@lilachat/shared';
import { juntarConPendientes } from './enPantalla';
import type { ChatMessage } from '../chat/types';

const confirmado = (seq: number, clientKey = `k${seq}`): ChatMessage => ({
  chatId: 'c1',
  seq,
  senderId: 'u1',
  clientKey,
  kind: 'text',
  body: `m${seq}`,
  at: '2026-10-19T15:00:00.000Z',
});

const enCola = (clientKey: string, extra: Partial<OutboxItem> = {}): OutboxItem => ({
  clientKey,
  chatId: 'c1',
  kind: 'text',
  body: 'pendiente',
  queuedAt: '2026-10-19T15:01:00.000Z',
  attempts: 0,
  ...extra,
});

describe('juntarConPendientes', () => {
  it('lo de la cola va después de lo confirmado, en el orden en que se escribió', () => {
    const lista = juntarConPendientes(
      [confirmado(1), confirmado(2)],
      [enCola('b', { queuedAt: '2026-10-19T15:02:00.000Z' }), enCola('a')],
      'u1'
    );

    expect(lista.map((m) => m.clientKey)).toEqual(['k1', 'k2', 'a', 'b']);
    expect(lista[2]?.estado).toBe('enviando');
    expect(lista[2]?.senderId).toBe('u1');
  });

  it('el fallido se marca con su motivo', () => {
    const [fallido] = juntarConPendientes([], [enCola('a', { fallo: 'Ya no eres miembro' })], 'u1');

    expect(fallido?.estado).toBe('fallido');
    expect(fallido?.motivoDelFallo).toBe('Ya no eres miembro');
  });

  it('si ya se confirmó (eco antes de vaciar la cola), no sale dos veces', () => {
    const lista = juntarConPendientes([confirmado(1, 'a')], [enCola('a')], 'u1');

    expect(lista).toHaveLength(1);
    expect(lista[0]?.estado).toBeUndefined();
  });

  it('una respuesta de hilo en la cola conserva su raíz: sale en el panel y no en el chat (E3)', () => {
    const [soloHilo, tambienAlChat] = juntarConPendientes([], [enCola('a', { hiloDe: 3 }), enCola('b', { hiloDe: 3, enElChat: true, queuedAt: '2026-10-19T15:02:00.000Z' })], 'u1');

    expect(soloHilo?.hiloDe).toBe(3);
    expect(soloHilo?.enElChat).toBeUndefined();
    expect(tambienAlChat?.hiloDe).toBe(3);
    expect(tambienAlChat?.enElChat).toBe(true);
  });
});
