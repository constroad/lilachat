import { describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '../api/client';
import { NoticeOpener, RETRY_WINDOW_MS } from './noticeOpener';
import type { NoticeDestination } from './destinoDeAviso';

const CHAT = { id: '6adbdcf17a5e0cc55ab3c185', kind: 'group', workspaceId: '6adbb02ec9d066b069307eb4' } as ChatSummary;
const THREAD_REPLY: NoticeDestination = { tipo: 'chat', chatId: CHAT.id, seq: 29, hiloDe: 23, workspaceId: '6adbb02ec9d066b069307eb4' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function build(find: (destination: NoticeDestination, jwt: string) => Promise<ChatSummary | null>, jwt = 'stale') {
  const clock = { now: 1_000 };
  const open = vi.fn();
  const openAgenda = vi.fn();
  const opener = new NoticeOpener({ find, open, openAgenda, now: () => clock.now }, jwt);
  return { opener, open, openAgenda, clock };
}

/**
 * B4 E2E case 3 (25/10): tapping a notice with the app closed did nothing. A cold
 * start enters with the saved (often stale) credential and refreshes it behind;
 * the tap was taken once, looked up with the old jwt, and dropped when the jwt
 * changed. The tap now survives the refresh.
 */
describe('NoticeOpener', () => {
  it('opens the chat with the tap\'s destination when the lookup finds it', async () => {
    const { opener, open } = build(async () => CHAT);
    await opener.handle(THREAD_REPLY);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({ action: 'open', chat: CHAT, space: CHAT.workspaceId, irASeq: 23, openThread: 23, highlightReply: 29 });
  });

  it('retries with the new jwt when it changed while the lookup was in flight', async () => {
    const first = deferred<ChatSummary | null>();
    const find = vi.fn((_destination: NoticeDestination, jwt: string) => (jwt === 'stale' ? first.promise : Promise.resolve(CHAT)));
    const { opener, open } = build(find);
    const pending = opener.handle(THREAD_REPLY);
    opener.setJwt('fresh');
    first.resolve(null);
    await pending;
    expect(find).toHaveBeenCalledTimes(2);
    expect(find.mock.calls[1][1]).toBe('fresh');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed lookup and opens it when the refreshed jwt arrives afterwards', async () => {
    const find = vi.fn(async (_destination: NoticeDestination, jwt: string) => (jwt === 'fresh' ? CHAT : null));
    const { opener, open } = build(find);
    await opener.handle(THREAD_REPLY);
    expect(open).not.toHaveBeenCalled();
    opener.setJwt('fresh');
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  });

  it('drops a tap that waited longer than the retry window', async () => {
    const find = vi.fn(async (_destination: NoticeDestination, jwt: string) => (jwt === 'fresh' ? CHAT : null));
    const { opener, open, clock } = build(find);
    await opener.handle(THREAD_REPLY);
    clock.now += RETRY_WINDOW_MS + 1;
    opener.setJwt('fresh');
    await Promise.resolve();
    expect(find).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks at most once more for a chat that is not there at all', async () => {
    const find = vi.fn(async () => null);
    const { opener, open } = build(find);
    await opener.handle(THREAD_REPLY);
    opener.setJwt('fresh');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    opener.setJwt('fresher');
    await Promise.resolve();
    expect(find).toHaveBeenCalledTimes(2);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not reopen an opened tap when the jwt changes later', async () => {
    const { opener, open } = build(async () => CHAT);
    await opener.handle(THREAD_REPLY);
    opener.setJwt('fresh');
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('ignores the same jwt arriving again', async () => {
    const find = vi.fn(async () => null);
    const { opener } = build(find);
    await opener.handle(THREAD_REPLY);
    opener.setJwt('stale');
    await Promise.resolve();
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('opens the agenda without looking any chat up', async () => {
    const find = vi.fn(async () => CHAT);
    const { opener, openAgenda } = build(find);
    await opener.handle({ tipo: 'agenda' });
    expect(openAgenda).toHaveBeenCalledTimes(1);
    expect(find).not.toHaveBeenCalled();
  });

  it('does nothing once disposed, even for a lookup already in flight', async () => {
    const first = deferred<ChatSummary | null>();
    const { opener, open } = build(() => first.promise);
    const pending = opener.handle(THREAD_REPLY);
    opener.dispose();
    first.resolve(CHAT);
    await pending;
    expect(open).not.toHaveBeenCalled();
  });
});
