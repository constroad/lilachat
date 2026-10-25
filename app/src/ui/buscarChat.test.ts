import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '../api/client';

const listChats = vi.fn();
const spaceChats = vi.fn();
const chatsInMemory = vi.fn();
const readSavedChats = vi.fn();

vi.mock('../api/client', () => ({ listChats: (...args: unknown[]) => listChats(...args) }));
vi.mock('../spaces/spacesApi', () => ({ spaceChats: (...args: unknown[]) => spaceChats(...args), findSpaceChat: vi.fn() }));
vi.mock('../chat/chatsGuardados', () => ({ chatsEnMemoria: () => chatsInMemory(), leerChatsGuardados: () => readSavedChats() }));

import { lookupNoticeChat } from './buscarChat';

const CHAT_ID = '6adbdcf17a5e0cc55ab3c185';
const SPACE_ID = '6adbb02ec9d066b069307eb4';
const chat = { id: CHAT_ID, kind: 'group', workspaceId: SPACE_ID } as ChatSummary;
const other = { id: '6adbdcf17a5e0cc55ab3c186', kind: 'group' } as ChatSummary;

/**
 * B4 E2E (25/10): the lookup used to say `null` for «not there» and for «the request
 * failed», so a flaky answer dropped the tap. They are different outcomes now.
 */
describe('lookupNoticeChat', () => {
  beforeEach(() => {
    listChats.mockReset();
    spaceChats.mockReset();
    chatsInMemory.mockReset().mockReturnValue(null);
    readSavedChats.mockReset().mockResolvedValue(null);
  });

  it('takes a chat of the space from the server list', async () => {
    spaceChats.mockResolvedValue({ ok: true, data: { chats: [other, chat] } });
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'found', chat });
    expect(spaceChats).toHaveBeenCalledWith('jwt', SPACE_ID);
  });

  it('uses the chats already in memory without asking the server', async () => {
    chatsInMemory.mockReturnValue([chat]);
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'found', chat });
    expect(spaceChats).not.toHaveBeenCalled();
  });

  it('opens a space chat from the list saved on the phone without asking the server', async () => {
    readSavedChats.mockResolvedValue([other, chat]);
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'found', chat });
    expect(spaceChats).not.toHaveBeenCalled();
  });

  it('asks the server when the saved list lacks the space chat', async () => {
    readSavedChats.mockResolvedValue([other]);
    spaceChats.mockResolvedValue({ ok: true, data: { chats: [chat] } });
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'found', chat });
  });

  it('says «missing» when the server answered and the chat is not in the space', async () => {
    spaceChats.mockResolvedValue({ ok: true, data: { chats: [other] } });
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'missing' });
  });

  it.each([[403], [404]])('says «missing» when the server refuses with %i (not a member, no such space)', async (status) => {
    spaceChats.mockResolvedValue({ ok: false, status });
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'missing' });
  });

  it.each([[undefined], [401], [500], [502], [504]])('says «failed» when the request did not give an answer about the chat (status %s)', async (status) => {
    spaceChats.mockResolvedValue({ ok: false, status });
    expect(await lookupNoticeChat({ chatId: CHAT_ID, workspaceId: SPACE_ID }, 'jwt')).toEqual({ kind: 'failed' });
  });

  it('for a personal chat reads the saved list first and then the server', async () => {
    readSavedChats.mockResolvedValue([other]);
    listChats.mockResolvedValue({ ok: true, data: { chats: [chat] } });
    expect(await lookupNoticeChat({ chatId: CHAT_ID }, 'jwt')).toEqual({ kind: 'found', chat });
    expect(listChats).toHaveBeenCalledWith('jwt');
  });

  it('for a personal chat says «failed» when the server list fails and the saved one lacks it', async () => {
    readSavedChats.mockResolvedValue([other]);
    listChats.mockResolvedValue({ ok: false });
    expect(await lookupNoticeChat({ chatId: CHAT_ID }, 'jwt')).toEqual({ kind: 'failed' });
  });
});
