import { describe, expect, it } from 'vitest';
import type { CallState } from './call.js';
import type { MediaState } from './callMedia.js';
import { CALL_RESTART, CALL_RESTART_ANSWER } from './callRecovery.js';
import { createIceRestarter, type RestartPeer } from './iceRestarter.js';

/**
 * José 19/11: locking the phone or switching apps cut the call. Both the APK and the
 * web run this controller, so an APK↔web call recovers in both directions.
 */
const CHAT = '6740a1b2c3d4e5f601234567';
const ACTIVE_CALLER: CallState = { fase: 'activa', desde: 1, entrante: false, conectadaEn: 2 };
const ACTIVE_CALLEE: CallState = { fase: 'activa', desde: 1, entrante: true, conectadaEn: 2 };

type Sent = { event: string; frame: Record<string, unknown> };

function fakePeer(initial = 'stable') {
  const log: string[] = [];
  let signaling = initial;
  let offers = 0;
  const peer: RestartPeer = {
    signalingState: () => signaling,
    createRestartOffer: async () => {
      offers += 1;
      signaling = 'have-local-offer';
      log.push(`offer-${offers}`);
      return `sdp-offer-${offers}`;
    },
    answerOffer: async (sdp) => {
      log.push(`answer-to-${sdp.sdp}`);
      return `sdp-answer-to-${sdp.sdp}`;
    },
    setRemoteAnswer: async (sdp) => {
      signaling = 'stable';
      log.push(`remote-${sdp.sdp}`);
    },
  };
  return { peer, log, setSignaling: (next: string) => (signaling = next) };
}

function setup(options: { state?: CallState | null; media?: MediaState; peer?: RestartPeer | null; failWith?: Error } = {}) {
  const sent: Sent[] = [];
  const reported: string[] = [];
  const measured: { op: string; ms: number }[] = [];
  let now = 1_000;
  const restarter = createIceRestarter({
    peer: () => (options.peer === undefined ? null : options.peer),
    chatId: () => CHAT,
    state: () => (options.state === undefined ? ACTIVE_CALLER : options.state),
    media: () => options.media ?? 'reconectando',
    emit: (event, frame) => sent.push({ event, frame: frame as Record<string, unknown> }),
    report: (where) => reported.push(where),
    measure: (op, ms) => measured.push({ op, ms }),
    now: () => now,
  });
  return { restarter, sent, reported, measured, advance: (ms: number) => (now += ms) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createIceRestarter: the caller', () => {
  it('a lost path sends a numbered restart offer', async () => {
    const { peer } = fakePeer();
    const { restarter, sent } = setup({ peer });

    restarter.onIce('disconnected', true);
    await settle();

    expect(sent).toEqual([{ event: CALL_RESTART, frame: { chatId: CHAT, restartId: 1, sdp: { type: 'offer', sdp: 'sdp-offer-1' } } }]);
  });

  it('asked by the other side, it restarts; a request never reaches the one who answered', async () => {
    const { peer } = fakePeer();
    const { restarter, sent } = setup({ peer });

    await restarter.onRestartFrame({ chatId: CHAT });
    await settle();

    expect(sent.map((one) => one.event)).toEqual([CALL_RESTART]);
    expect(sent[0]?.frame.restartId).toBe(1);
  });

  it('only the answer to the LAST offer is applied: a late one is dropped', async () => {
    const { peer, log } = fakePeer();
    const { restarter } = setup({ peer });
    restarter.onIce('disconnected', true);
    restarter.onIce('failed', true);
    await settle();

    await restarter.onAnswerFrame({ chatId: CHAT, restartId: 1, sdp: { type: 'answer', sdp: 'late' } });
    await restarter.onAnswerFrame({ chatId: CHAT, restartId: 2, sdp: { type: 'answer', sdp: 'current' } });

    expect(log).toEqual(['offer-1', 'offer-2', 'remote-current']);
  });

  it('the socket coming back sends the restart again while the call reconnects', async () => {
    const { peer } = fakePeer('have-local-offer');
    const { restarter, sent } = setup({ peer, media: 'reconectando' });

    restarter.onSocketBack();
    await settle();

    expect(sent.map((one) => one.event)).toEqual([CALL_RESTART]);
  });

  it('candidates found while the offer is being set go out AFTER it', async () => {
    const holder = fakePeer();
    const original = holder.peer.createRestartOffer;
    let restarter: ReturnType<typeof createIceRestarter> | null = null;
    holder.peer.createRestartOffer = async () => {
      restarter?.emitCandidate({ candidate: 'relay-new' });
      return original();
    };
    const built = setup({ peer: holder.peer });
    restarter = built.restarter;

    restarter.onIce('failed', true);
    await settle();

    expect(built.sent.map((one) => one.event)).toEqual([CALL_RESTART, 'call.ice']);
  });
});

describe('createIceRestarter: the one who answered', () => {
  it('a lost path asks the caller to restart, it never offers itself', async () => {
    const { peer, log } = fakePeer();
    const { restarter, sent } = setup({ peer, state: ACTIVE_CALLEE });

    restarter.onIce('failed', true);
    await settle();

    expect(sent).toEqual([{ event: CALL_RESTART, frame: { chatId: CHAT } }]);
    expect(log).toEqual([]);
  });

  it('a restart offer is answered with its restart id', async () => {
    const { peer } = fakePeer();
    const { restarter, sent } = setup({ peer, state: ACTIVE_CALLEE });

    await restarter.onRestartFrame({ chatId: CHAT, restartId: 4, sdp: { type: 'offer', sdp: 'o4' } });

    expect(sent).toEqual([{ event: CALL_RESTART_ANSWER, frame: { chatId: CHAT, restartId: 4, sdp: { type: 'answer', sdp: 'sdp-answer-to-o4' } } }]);
  });
});

describe('createIceRestarter: what it leaves alone', () => {
  it('frames of another chat, of a call not answered, or with no peer do nothing', async () => {
    const { peer, log } = fakePeer();
    const other = setup({ peer, state: ACTIVE_CALLEE });
    await other.restarter.onRestartFrame({ chatId: 'otro', sdp: { type: 'offer', sdp: 'x' } });
    const ringing = setup({ peer, state: { fase: 'sonando', desde: 1, entrante: true } });
    await ringing.restarter.onRestartFrame({ chatId: CHAT, sdp: { type: 'offer', sdp: 'x' } });
    const noPeer = setup({ peer: null });
    noPeer.restarter.onIce('failed', true);
    await settle();

    expect([...other.sent, ...ringing.sent, ...noPeer.sent]).toEqual([]);
    expect(log).toEqual([]);
  });

  it('a call that never connected has nothing to restart', async () => {
    const { peer } = fakePeer();
    const { restarter, sent } = setup({ peer });

    restarter.onIce('failed', false);
    await settle();

    expect(sent).toEqual([]);
  });
});

describe('createIceRestarter: errors and evidence', () => {
  it('a restart that throws is reported, not thrown', async () => {
    const { peer } = fakePeer();
    peer.createRestartOffer = async () => {
      throw new Error('closed');
    };
    const { restarter, reported } = setup({ peer });

    restarter.onIce('failed', true);
    await settle();
    await settle();

    expect(reported).toEqual(['call.restart']);
  });

  it('measures how long the call was lost, recovered or given up', async () => {
    const { peer } = fakePeer();
    const { restarter, measured, advance } = setup({ peer });
    restarter.onIce('disconnected', true);
    advance(4_000);
    restarter.onIce('connected', true);
    restarter.onIce('failed', true);
    advance(60_000);
    restarter.gaveUp();
    await settle();

    expect(measured).toEqual([{ op: 'llamada-reconectada', ms: 4_000 }, { op: 'llamada-perdida-sin-red', ms: 60_000 }]);
  });
});
