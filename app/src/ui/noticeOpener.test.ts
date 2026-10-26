import { describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '../api/client';
import { NAVIGATION_WAIT_MS, NoticeOpener, perfOfNoticeEvent, RETRY_DELAYS_MS, RETRY_WINDOW_MS, type NoticeEvent, type NoticeLookup } from './noticeOpener';
import type { NoticeDestination } from './destinoDeAviso';

const CHAT = { id: '6adbdcf17a5e0cc55ab3c185', kind: 'group', workspaceId: '6adbb02ec9d066b069307eb4' } as ChatSummary;
const FOUND: NoticeLookup = { kind: 'found', chat: CHAT };
const FAILED: NoticeLookup = { kind: 'failed' };
const MISSING: NoticeLookup = { kind: 'missing' };
const THREAD_REPLY: NoticeDestination = { tipo: 'chat', chatId: CHAT.id, seq: 29, hiloDe: 23, workspaceId: '6adbb02ec9d066b069307eb4' };
const LOOSE_MESSAGE: NoticeDestination = { tipo: 'chat', chatId: CHAT.id, seq: 33, workspaceId: '6adbb02ec9d066b069307eb4' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/** `find` answers from a script, one entry per call; the last one repeats. */
function scripted(answers: NoticeLookup[]) {
  let call = 0;
  return vi.fn(async (_destination: NoticeDestination, _jwt: string): Promise<NoticeLookup> => answers[Math.min(call++, answers.length - 1)]);
}

function build(find: (destination: NoticeDestination, jwt: string) => Promise<NoticeLookup>, jwt = 'stale') {
  const clock = { now: 1_000 };
  const open = vi.fn((_plan: Record<string, unknown>) => true);
  const openAgenda = vi.fn();
  const events: NoticeEvent[] = [];
  const slept: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    slept.push(ms);
    clock.now += ms;
  });
  const opener = new NoticeOpener({ find, open, openAgenda, now: () => clock.now, sleep, report: (event) => events.push(event) }, jwt);
  return { opener, open, openAgenda, clock, slept, sleep, events };
}

/**
 * B4 E2E (25/10): tapping a notice did nothing whenever the single lookup of its chat
 * failed or timed out (the host answered one request in three), and once the app was
 * closed (a cold start refreshes the jwt behind the first screen). The tap used to be
 * taken once and dropped. It now keeps asking, with waits, until the server answers.
 */
describe('NoticeOpener', () => {
  it('opens the chat with the tap\'s destination when the lookup finds it', async () => {
    const { opener, open } = build(scripted([FOUND]));
    await opener.handle(THREAD_REPLY);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({ action: 'open', chat: CHAT, space: CHAT.workspaceId, irASeq: 23, openThread: 23, highlightReply: 29 });
  });

  it('opens a loose message at that message, with no thread', async () => {
    const { opener, open } = build(scripted([FOUND]));
    await opener.handle(LOOSE_MESSAGE);
    expect(open.mock.calls[0][0]).toMatchObject({ irASeq: 33, space: CHAT.workspaceId });
    expect(open.mock.calls[0][0].openThread).toBeUndefined();
  });

  it('asks again, waiting between tries, when the lookup fails, and opens as soon as it answers', async () => {
    const find = scripted([FAILED, FAILED, FOUND]);
    const { opener, open, slept } = build(find);
    await opener.handle(LOOSE_MESSAGE);
    expect(find).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last wait when the server never answers', async () => {
    const find = scripted([FAILED]);
    const { opener, open, slept } = build(find);
    await opener.handle(LOOSE_MESSAGE);
    expect(find).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(slept).toEqual([...RETRY_DELAYS_MS]);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not ask again when the server answered and the chat is not there', async () => {
    const find = scripted([MISSING]);
    const { opener, open, sleep } = build(find);
    await opener.handle(LOOSE_MESSAGE);
    expect(find).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('retries at once with the new jwt when it changed while the lookup was in flight', async () => {
    const first = deferred<NoticeLookup>();
    const find = vi.fn((_destination: NoticeDestination, jwt: string) => (jwt === 'stale' ? first.promise : Promise.resolve(FOUND)));
    const { opener, open, sleep } = build(find);
    const pending = opener.handle(THREAD_REPLY);
    opener.setJwt('fresh');
    first.resolve(FAILED);
    await pending;
    expect(find.mock.calls.map((call) => call[1])).toEqual(['stale', 'fresh']);
    expect(sleep).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('also retries a «not there» answer given to the old jwt, once, with the new one', async () => {
    const first = deferred<NoticeLookup>();
    const find = vi.fn((_destination: NoticeDestination, jwt: string) => (jwt === 'stale' ? first.promise : Promise.resolve(FOUND)));
    const { opener, open } = build(find);
    const pending = opener.handle(THREAD_REPLY);
    opener.setJwt('fresh');
    first.resolve(MISSING);
    await pending;
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('wakes a wait early when the jwt changes during it', async () => {
    const wake = deferred<void>();
    const clock = { now: 1_000 };
    const open = vi.fn(() => true);
    const find = vi.fn(async (_destination: NoticeDestination, jwt: string): Promise<NoticeLookup> => (jwt === 'fresh' ? FOUND : FAILED));
    const opener = new NoticeOpener({ find, open, openAgenda: vi.fn(), now: () => clock.now, sleep: () => wake.promise, report: () => undefined }, 'stale');
    const pending = opener.handle(THREAD_REPLY);
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    opener.setJwt('fresh');
    await pending;
    expect(find).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('stops asking once the window passed, even with waits left', async () => {
    const find = scripted([FAILED]);
    const { open, clock } = build(find);
    const slowFind = vi.fn(async (...args: Parameters<typeof find>) => {
      clock.now += RETRY_WINDOW_MS + 1;
      return find(...args);
    });
    const slow = new NoticeOpener({ find: slowFind, open, openAgenda: vi.fn(), now: () => clock.now, sleep: async () => undefined, report: () => undefined }, 'stale');
    await slow.handle(LOOSE_MESSAGE);
    expect(slowFind).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores the same jwt arriving again', async () => {
    const first = deferred<NoticeLookup>();
    const find = vi.fn(() => first.promise);
    const { opener } = build(find);
    const pending = opener.handle(THREAD_REPLY);
    opener.setJwt('stale');
    first.resolve(MISSING);
    await pending;
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('keeps trying to open while the navigation is not ready, without looking the chat up again', async () => {
    const find = scripted([FOUND]);
    const { opener, open, slept } = build(find);
    open.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true);
    await opener.handle(THREAD_REPLY);
    expect(find).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([NAVIGATION_WAIT_MS, NAVIGATION_WAIT_MS]);
  });

  it('gives up opening once the window passed with the navigation still not ready', async () => {
    const { opener, open, events } = build(scripted([FOUND]));
    open.mockReturnValue(false);
    await opener.handle(LOOSE_MESSAGE);
    expect(open.mock.calls.length).toBeGreaterThan(1);
    expect(events[events.length - 1]).toMatchObject({ kind: 'navigation-not-ready' });
  });

  it('reports each lookup, how it ended and how long the tap took', async () => {
    const { opener, events } = build(scripted([FAILED, FOUND]));
    await opener.handle(LOOSE_MESSAGE);
    expect(events).toEqual([
      { kind: 'lookup', attempt: 1, result: 'failed', ms: 0 },
      { kind: 'lookup', attempt: 2, result: 'found', ms: RETRY_DELAYS_MS[0] },
      { kind: 'opened', ms: RETRY_DELAYS_MS[0] },
    ]);
  });

  it('reports that it gave up when the server never answered', async () => {
    const { opener, events } = build(scripted([FAILED]));
    await opener.handle(LOOSE_MESSAGE);
    expect(events[events.length - 1]).toMatchObject({ kind: 'gave-up' });
  });

  it('reports a «missing» answer and stops', async () => {
    const { opener, events } = build(scripted([MISSING]));
    await opener.handle(LOOSE_MESSAGE);
    expect(events).toEqual([{ kind: 'lookup', attempt: 1, result: 'missing', ms: 0 }]);
  });

  it('opens the agenda without looking any chat up', async () => {
    const find = scripted([FOUND]);
    const { opener, openAgenda } = build(find);
    await opener.handle({ tipo: 'agenda' });
    expect(openAgenda).toHaveBeenCalledTimes(1);
    expect(find).not.toHaveBeenCalled();
  });

  it('reports that a tap in flight was cancelled when the opener is disposed (the screen was torn down under it)', async () => {
    const first = deferred<NoticeLookup>();
    const { opener, events } = build(() => first.promise);
    const pending = opener.handle(THREAD_REPLY);
    opener.dispose();
    first.resolve(FOUND);
    await pending;
    expect(events).toEqual([{ kind: 'cancelled', ms: 0 }]);
  });

  it('reports nothing when it is disposed with no tap in flight', () => {
    const { opener, events } = build(scripted([FOUND]));
    opener.dispose();
    expect(events).toEqual([]);
  });

  it('does nothing once disposed, even for a lookup already in flight or a wait pending', async () => {
    const first = deferred<NoticeLookup>();
    const { opener, open, sleep } = build(() => first.promise);
    const pending = opener.handle(THREAD_REPLY);
    opener.dispose();
    first.resolve(FOUND);
    await pending;
    expect(open).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('perfOfNoticeEvent', () => {
  it('codes the result of a lookup and keeps the attempt', () => {
    expect(perfOfNoticeEvent({ kind: 'lookup', attempt: 2, result: 'failed', ms: 2100 })).toEqual({ op: 'aviso-busqueda', ms: 2100, extra: { intento: 2, resultado: 2 } });
    expect(perfOfNoticeEvent({ kind: 'lookup', attempt: 1, result: 'found', ms: 40 })).toEqual({ op: 'aviso-busqueda', ms: 40, extra: { intento: 1, resultado: 0 } });
    expect(perfOfNoticeEvent({ kind: 'lookup', attempt: 1, result: 'missing', ms: 40 }).extra).toEqual({ intento: 1, resultado: 1 });
  });

  it('names the three endings', () => {
    expect(perfOfNoticeEvent({ kind: 'opened', ms: 900 })).toEqual({ op: 'aviso-abierto', ms: 900 });
    expect(perfOfNoticeEvent({ kind: 'navigation-not-ready', ms: 45000 })).toEqual({ op: 'aviso-sin-navegacion', ms: 45000 });
    expect(perfOfNoticeEvent({ kind: 'gave-up', ms: 17000 })).toEqual({ op: 'aviso-sin-respuesta', ms: 17000 });
    expect(perfOfNoticeEvent({ kind: 'cancelled', ms: 800 })).toEqual({ op: 'aviso-cancelado', ms: 800 });
  });
});
