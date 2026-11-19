import { describe, expect, it } from 'vitest';
import { CALL_RESTART, CALL_RESTART_ANSWER, answersCurrentRestart, callSignalStep, canOfferRestart, iceRecoveryOn, recoveryOnReconnect, restartFrameOf } from './callRecovery.js';

/**
 * José 19/11: the call was cut when the phone locked or he switched apps. Any
 * cut of the media path (the phone's network changes or sleeps) ended the call for
 * good: ICE `failed` hung up at once and nothing restarted ICE on the new network.
 */
describe('iceRecoveryOn', () => {
  it('the caller restarts ICE when an answered call loses its path', () => {
    expect(iceRecoveryOn({ ice: 'disconnected', connectedBefore: true, caller: true })).toBe('restart');
    expect(iceRecoveryOn({ ice: 'failed', connectedBefore: true, caller: true })).toBe('restart');
  });

  it('the one who answered asks the caller to restart: only one side offers, no glare', () => {
    expect(iceRecoveryOn({ ice: 'disconnected', connectedBefore: true, caller: false })).toBe('ask-restart');
    expect(iceRecoveryOn({ ice: 'failed', connectedBefore: true, caller: false })).toBe('ask-restart');
  });

  it('checking after a restart is the restart working, not a new loss', () => {
    expect(iceRecoveryOn({ ice: 'checking', connectedBefore: true, caller: true })).toBe('none');
  });

  it('nothing to recover while it never connected, or while it flows', () => {
    expect(iceRecoveryOn({ ice: 'failed', connectedBefore: false, caller: true })).toBe('none');
    expect(iceRecoveryOn({ ice: 'connected', connectedBefore: true, caller: true })).toBe('none');
    expect(iceRecoveryOn({ ice: 'closed', connectedBefore: true, caller: false })).toBe('none');
  });
});

describe('recoveryOnReconnect', () => {
  it('the socket came back while the call reconnects: the restart that may have been lost goes again', () => {
    expect(recoveryOnReconnect({ active: true, media: 'reconectando', caller: true })).toBe('restart');
    expect(recoveryOnReconnect({ active: true, media: 'reconectando', caller: false })).toBe('ask-restart');
  });

  it('a call that flows, never connected or is not answered needs nothing', () => {
    expect(recoveryOnReconnect({ active: true, media: 'conectada', caller: true })).toBe('none');
    expect(recoveryOnReconnect({ active: true, media: 'conectando', caller: true })).toBe('none');
    expect(recoveryOnReconnect({ active: false, media: 'reconectando', caller: true })).toBe('none');
  });
});

describe('canOfferRestart', () => {
  it('from stable, or over a restart offer whose answer got lost', () => {
    expect(canOfferRestart('stable')).toBe(true);
    expect(canOfferRestart('have-local-offer')).toBe(true);
  });

  it('never on a closed peer or in the middle of the other side’s offer', () => {
    expect(canOfferRestart('closed')).toBe(false);
    expect(canOfferRestart('have-remote-offer')).toBe(false);
  });
});

describe('answersCurrentRestart', () => {
  it('only the answer to the last restart offer is applied: a late one would pair the wrong ICE credentials', () => {
    expect(answersCurrentRestart({ answerId: 2, currentId: 2, signalingState: 'have-local-offer' })).toBe(true);
    expect(answersCurrentRestart({ answerId: 1, currentId: 2, signalingState: 'have-local-offer' })).toBe(false);
  });

  it('without a pending offer there is nothing to answer', () => {
    expect(answersCurrentRestart({ answerId: 2, currentId: 2, signalingState: 'stable' })).toBe(false);
    expect(answersCurrentRestart({ answerId: undefined, currentId: 2, signalingState: 'have-local-offer' })).toBe(false);
  });
});

describe('restartFrameOf', () => {
  const chatId = '6740a1b2c3d4e5f601234567';

  it('a restart offer and a plain «please restart» are both valid restart frames', () => {
    expect(restartFrameOf({ chatId, sdp: { type: 'offer', sdp: 'v=0' } }, CALL_RESTART)).toEqual({ chatId, sdp: { type: 'offer', sdp: 'v=0' } });
    expect(restartFrameOf({ chatId }, CALL_RESTART)).toEqual({ chatId });
  });

  it('the restart id travels with the offer and its answer; anything else is not an id', () => {
    expect(restartFrameOf({ chatId, sdp: { type: 'offer', sdp: 'v=0' }, restartId: 3 }, CALL_RESTART)).toEqual({ chatId, sdp: { type: 'offer', sdp: 'v=0' }, restartId: 3 });
    expect(restartFrameOf({ chatId, sdp: { type: 'answer', sdp: 'v=0' }, restartId: 3 }, CALL_RESTART_ANSWER)?.restartId).toBe(3);
    expect(restartFrameOf({ chatId, sdp: { type: 'offer', sdp: 'v=0' }, restartId: -1 }, CALL_RESTART)).toEqual({ chatId, sdp: { type: 'offer', sdp: 'v=0' } });
    expect(restartFrameOf({ chatId, sdp: { type: 'offer', sdp: 'v=0' }, restartId: '3' }, CALL_RESTART)?.restartId).toBeUndefined();
  });

  it('an answer frame needs its answer', () => {
    expect(restartFrameOf({ chatId, sdp: { type: 'answer', sdp: 'v=0' } }, CALL_RESTART_ANSWER)).toEqual({ chatId, sdp: { type: 'answer', sdp: 'v=0' } });
    expect(restartFrameOf({ chatId }, CALL_RESTART_ANSWER)).toBeNull();
  });

  it('a wrong sdp type, an empty sdp or no chat is dropped', () => {
    expect(restartFrameOf({ chatId, sdp: { type: 'answer', sdp: 'v=0' } }, CALL_RESTART)).toBeNull();
    expect(restartFrameOf({ chatId, sdp: { type: 'offer', sdp: '' } }, CALL_RESTART)).toBeNull();
    expect(restartFrameOf({ sdp: { type: 'offer', sdp: 'v=0' } }, CALL_RESTART)).toBeNull();
    expect(restartFrameOf(null, CALL_RESTART)).toBeNull();
    expect(restartFrameOf('call', CALL_RESTART_ANSWER)).toBeNull();
  });
});

describe('callSignalStep', () => {
  it('the ring, the answer, the candidates and the end keep their server steps', () => {
    expect(callSignalStep('call.offer')).toBe('ring');
    expect(callSignalStep('call.answer')).toBe('answer');
    expect(callSignalStep('call.ice')).toBe('candidate');
    expect(callSignalStep('call.answering')).toBe('answering');
    expect(callSignalStep('call.end')).toBe('end');
    expect(callSignalStep('call.reject')).toBe('end');
  });

  it('an ICE restart is only relayed: it never rings, answers or ends the call', () => {
    expect(callSignalStep(CALL_RESTART)).toBe('relay');
    expect(callSignalStep(CALL_RESTART_ANSWER)).toBe('relay');
  });

  it('an unknown event does nothing on the server', () => {
    expect(callSignalStep('call.unknown')).toBe('relay');
    expect(callSignalStep('toString')).toBe('relay');
  });
});
