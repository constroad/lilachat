import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '../api/client';
import { noticeDestination, planOpening } from './destinoDeAviso';

const CHAT_ID = '6a90cf90d2dbc98541f59dd0';
const SPACE_ID = '6a90cf90d2dbc98541f59aaa';

/**
 * Tocar una notificación lleva a lo que avisa (FL8; auditoría 17/10/2026: el
 * `chatId` viajaba en la notificación y nadie escuchaba el toque — se abría la
 * app en la lista, o donde estuviera).
 */
describe('noticeDestination', () => {
  it('un mensaje (push o aviso local) abre su chat, y el número del mensaje viaja con él', () => {
    expect(noticeDestination({ chatId: CHAT_ID, seq: '12' })).toEqual({ tipo: 'chat', chatId: CHAT_ID, seq: 12 });
  });

  it('un recordatorio o un evento abre la Agenda, aunque traiga el chat del evento', () => {
    expect(noticeDestination({ chatId: '', seq: '0', tipo: 'agenda' })).toEqual({ tipo: 'agenda' });
    expect(noticeDestination({ chatId: CHAT_ID, seq: '0', tipo: 'agenda' })).toEqual({ tipo: 'agenda' });
  });

  it('sin chat ni tipo conocido no lleva a ningún lado', () => {
    expect(noticeDestination({ chatId: '' })).toBeNull();
    expect(noticeDestination({})).toBeNull();
    expect(noticeDestination(null)).toBeNull();
    expect(noticeDestination('basura')).toBeNull();
  });

  it('un chatId que no es un id de Mongo no se usa (no se navega a cualquier cosa)', () => {
    expect(noticeDestination({ chatId: '../../ajustes' })).toBeNull();
  });

  it('un aviso de hilo trae la raíz, la respuesta y el espacio', () => {
    expect(noticeDestination({ chatId: CHAT_ID, seq: '15', hiloDe: '9', workspaceId: SPACE_ID })).toEqual({
      tipo: 'chat',
      chatId: CHAT_ID,
      seq: 15,
      hiloDe: 9,
      workspaceId: SPACE_ID,
    });
  });

  it('acepta números además de textos (el aviso local los manda como números)', () => {
    expect(noticeDestination({ chatId: CHAT_ID, seq: 15, hiloDe: 9 })).toEqual({ tipo: 'chat', chatId: CHAT_ID, seq: 15, hiloDe: 9 });
  });

  it('lo vacío del push (sin hilo, sin espacio) no cuenta', () => {
    expect(noticeDestination({ chatId: CHAT_ID, seq: '15', hiloDe: '', workspaceId: '' })).toEqual({ tipo: 'chat', chatId: CHAT_ID, seq: 15 });
  });

  it.each([['0'], ['-3'], ['1.5'], ['abc'], ['12abc'], ['1e3'], [' 7'], ['9007199254740993'], [0], [-1], [2.5], [Number.NaN], [null], [{}]])(
    'un número de mensaje o de hilo inválido (%j) se descarta, el chat sigue abriéndose',
    (invalido) => {
      expect(noticeDestination({ chatId: CHAT_ID, seq: invalido, hiloDe: invalido })).toEqual({ tipo: 'chat', chatId: CHAT_ID });
    }
  );

  it.each([['../../ajustes'], [SPACE_ID.toUpperCase()], [`${SPACE_ID}0`], [SPACE_ID.slice(1)], [42], [null]])(
    'un espacio que no es un id de Mongo (%j) se descarta',
    (invalido) => {
      expect(noticeDestination({ chatId: CHAT_ID, workspaceId: invalido })).toEqual({ tipo: 'chat', chatId: CHAT_ID });
    }
  );

  it('el tipo agenda ignora el resto aunque venga con hilo y espacio', () => {
    expect(noticeDestination({ tipo: 'agenda', chatId: CHAT_ID, seq: '4', hiloDe: '2', workspaceId: SPACE_ID })).toEqual({ tipo: 'agenda' });
  });
});

const spaceChat = { id: CHAT_ID, kind: 'group', workspaceId: SPACE_ID } as ChatSummary;
const directChat = { id: CHAT_ID, kind: 'direct' } as ChatSummary;

/** What the app does with a tap, once it knows whether the chat exists (pure: the hook does the lookup). */
describe('planOpening', () => {
  it('un mensaje de un canal del space: cambia al espacio, abre el chat y salta al mensaje', () => {
    const destination = noticeDestination({ chatId: CHAT_ID, seq: '15', workspaceId: SPACE_ID });
    expect(planOpening(destination, spaceChat)).toEqual({ action: 'open', chat: spaceChat, space: SPACE_ID, irASeq: 15 });
  });

  it('una respuesta de hilo: salta a la raíz, abre el hilo y marca la respuesta', () => {
    const destination = noticeDestination({ chatId: CHAT_ID, seq: '15', hiloDe: '9', workspaceId: SPACE_ID });
    expect(planOpening(destination, spaceChat)).toEqual({
      action: 'open',
      chat: spaceChat,
      space: SPACE_ID,
      irASeq: 9,
      openThread: 9,
      highlightReply: 15,
    });
  });

  it('un chat personal vuelve a Personal, aunque la app estuviera en un espacio', () => {
    const destination = noticeDestination({ chatId: CHAT_ID, seq: '4', hiloDe: '', workspaceId: '' });
    expect(planOpening(destination, directChat)).toEqual({ action: 'open', chat: directChat, space: null, irASeq: 4 });
  });

  it('sin número de mensaje (aviso de un build viejo) abre el chat en su final', () => {
    const destination = noticeDestination({ chatId: CHAT_ID });
    expect(planOpening(destination, directChat)).toEqual({ action: 'open', chat: directChat, space: null });
  });

  it('una raíz sin respuesta conocida abre el hilo sin marcar nada', () => {
    const destination = noticeDestination({ chatId: CHAT_ID, hiloDe: '9', workspaceId: SPACE_ID });
    expect(planOpening(destination, spaceChat)).toEqual({ action: 'open', chat: spaceChat, space: SPACE_ID, irASeq: 9, openThread: 9 });
  });

  it('si el chat no se encontró no hace nada: no se cambia de espacio a ciegas', () => {
    const destination = noticeDestination({ chatId: CHAT_ID, seq: '15', workspaceId: SPACE_ID });
    expect(planOpening(destination, null)).toEqual({ action: 'none' });
  });

  it('sin destino o con destino de agenda no abre ningún chat', () => {
    expect(planOpening(null, directChat)).toEqual({ action: 'none' });
    expect(planOpening({ tipo: 'agenda' }, directChat)).toEqual({ action: 'none' });
  });
});
