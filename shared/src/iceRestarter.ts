import type { CallState } from './call.js';
import type { MediaState } from './callMedia.js';
import {
  CALL_RESTART,
  CALL_RESTART_ANSWER,
  answersCurrentRestart,
  canOfferRestart,
  iceRecoveryOn,
  recoveryOnReconnect,
  restartFrameOf,
  type IceRecovery,
  type RestartFrame,
  type RestartSdp,
} from './callRecovery.js';
import { crearColaSerial } from './colaSerial.js';

/**
 * The ICE restart of an answered call, the same on the APK and the web (José 19/11:
 * the call was cut when the phone locked or he switched apps). The platform gives
 * its peer, its socket and its clock; the rules are `callRecovery.ts`.
 *
 * Candidates found while a restart offer or answer is being set wait until that
 * frame goes out: sent before it, the other side would try them against the old
 * ICE credentials and drop them.
 */
export type RestartPeer = {
  signalingState: () => string;
  /** Creates an offer with ICE restart, sets it as local and returns its SDP. */
  createRestartOffer: () => Promise<string>;
  /** Sets the other side's restart offer, answers it and returns the answer's SDP. */
  answerOffer: (sdp: RestartSdp) => Promise<string>;
  setRemoteAnswer: (sdp: RestartSdp) => Promise<void>;
};

export type IceRestarterDeps = {
  peer: () => RestartPeer | null;
  chatId: () => string | null;
  state: () => CallState | null;
  media: () => MediaState;
  emit: (event: string, frame: object) => void;
  report: (where: string, error: unknown) => void;
  /** The diagnostic line: how long the call was lost and how many restarts it took. */
  measure?: (op: string, ms: number, extra: Record<string, number>) => void;
  now?: () => number;
};

const isCaller = (state: CallState | null): boolean => state?.entrante === false;
const isActive = (state: CallState | null): boolean => state?.fase === 'activa';
const RECOVERED_ICE: ReadonlySet<string> = new Set(['connected', 'completed']);

/** Candidates found while a restart description is being set wait for its frame. */
function createCandidateGate(deps: Pick<IceRestarterDeps, 'emit' | 'chatId'>) {
  let held: object[] | null = null;
  const emitCandidate = (candidate: object): void => {
    if (held) held.push(candidate);
    else deps.emit('call.ice', { chatId: deps.chatId(), candidate });
  };
  const holdingCandidates = async (step: () => Promise<void>): Promise<void> => {
    held = [];
    try {
      await step();
    } finally {
      const waiting = held ?? [];
      held = null;
      waiting.forEach(emitCandidate);
    }
  };
  return { emitCandidate, holdingCandidates };
}

type Context = {
  deps: IceRestarterDeps;
  gate: ReturnType<typeof createCandidateGate>;
  inOrder: ReturnType<typeof crearColaSerial>;
  now: () => number;
  /** The last restart offer's number; its answer must echo it. */
  restartId: number;
  lostAt: number | null;
};

async function offerRestart(ctx: Context): Promise<void> {
  const peer = ctx.deps.peer();
  if (!peer || !canOfferRestart(peer.signalingState())) return;
  ctx.restartId += 1;
  const id = ctx.restartId;
  await ctx.gate.holdingCandidates(async () => {
    const sdp = await peer.createRestartOffer();
    ctx.deps.emit(CALL_RESTART, { chatId: ctx.deps.chatId(), restartId: id, sdp: { type: 'offer', sdp } });
  });
}

function recover(ctx: Context, action: IceRecovery): void {
  if (action === 'none' || !ctx.deps.peer()) return;
  ctx.lostAt ??= ctx.now();
  if (action === 'ask-restart') return ctx.deps.emit(CALL_RESTART, { chatId: ctx.deps.chatId() });
  void ctx.inOrder(() => offerRestart(ctx)).catch((error: unknown) => ctx.deps.report('call.restart', error));
}

const ofThisCall = (deps: IceRestarterDeps, frame: RestartFrame | null): frame is RestartFrame =>
  frame !== null && frame.chatId === deps.chatId() && isActive(deps.state());

/** `call.restart`: the caller restarts when asked; the one who answered answers the offer. */
async function handleRestart(ctx: Context, frame: RestartFrame | null): Promise<void> {
  const { deps } = ctx;
  if (!ofThisCall(deps, frame)) return;
  const caller = isCaller(deps.state());
  if (!frame.sdp) return caller ? recover(ctx, 'restart') : undefined;
  const peer = deps.peer();
  if (caller || !peer || peer.signalingState() !== 'stable') return;
  const offer = frame.sdp;
  await ctx.gate.holdingCandidates(async () => {
    const sdp = await peer.answerOffer(offer);
    deps.emit(CALL_RESTART_ANSWER, { chatId: frame.chatId, restartId: frame.restartId, sdp: { type: 'answer', sdp } });
  });
}

/** `call.restart.answer`: only the answer to the last restart offer. */
async function handleAnswer(ctx: Context, frame: RestartFrame | null): Promise<void> {
  const peer = ctx.deps.peer();
  if (!ofThisCall(ctx.deps, frame) || !frame.sdp || !peer) return;
  if (!answersCurrentRestart({ answerId: frame.restartId, currentId: ctx.restartId, signalingState: peer.signalingState() })) return;
  await peer.setRemoteAnswer(frame.sdp);
}

function measureLoss(ctx: Context, op: string): void {
  if (ctx.lostAt !== null) ctx.deps.measure?.(op, ctx.now() - ctx.lostAt, { reinicios: ctx.restartId });
  ctx.lostAt = null;
}

export function createIceRestarter(deps: IceRestarterDeps) {
  const ctx: Context = { deps, gate: createCandidateGate(deps), inOrder: crearColaSerial(), now: deps.now ?? Date.now, restartId: 0, lostAt: null };
  const guarded = (where: string, task: () => Promise<void>): Promise<void> => ctx.inOrder(task).catch((error: unknown) => deps.report(where, error));
  return {
    emitCandidate: ctx.gate.emitCandidate,
    /** Every ICE state of the call's peer. */
    onIce: (ice: string, connectedBefore: boolean): void => {
      if (RECOVERED_ICE.has(ice)) measureLoss(ctx, 'llamada-reconectada');
      recover(ctx, iceRecoveryOn({ ice, connectedBefore, caller: isCaller(deps.state()) }));
    },
    /** The socket connected again: a restart sent meanwhile may have been lost. */
    onSocketBack: (): void => recover(ctx, recoveryOnReconnect({ active: isActive(deps.state()), media: deps.media(), caller: isCaller(deps.state()) })),
    onRestartFrame: (frame: unknown): Promise<void> => guarded('call.restart.offer', () => handleRestart(ctx, restartFrameOf(frame, CALL_RESTART))),
    onAnswerFrame: (frame: unknown): Promise<void> => guarded('call.restart.answer', () => handleAnswer(ctx, restartFrameOf(frame, CALL_RESTART_ANSWER))),
    /** The call gave up; the next call starts counting from zero. */
    gaveUp: (): void => {
      measureLoss(ctx, 'llamada-perdida-sin-red');
      ctx.restartId = 0;
    },
  };
}

export type IceRestarter = ReturnType<typeof createIceRestarter>;
