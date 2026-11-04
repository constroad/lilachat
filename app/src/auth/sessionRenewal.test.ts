import { describe, expect, it, vi } from 'vitest';
import { createSessionRenewer, rejectsSession, RENEW_AFTER_MS, RENEW_RETRY_MS, renewalDue, type RenewalResult } from './sessionRenewal';

const HOUR_MS = 60 * 60 * 1000;

/** A clock and timers the test moves by hand. */
function harness(results: (RenewalResult<string> | null | Error)[] = [{ ok: true, session: 'jwt-new' }]) {
  let clock = 1_000_000;
  const timers: { at: number; run: () => void }[] = [];
  const refresh = vi.fn(async () => {
    const next = results.length > 1 ? results.shift() : results[0];
    if (next instanceof Error) throw next;
    return next ?? null;
  });
  const onRenewed = vi.fn();
  const onRevoked = vi.fn();
  const renewer = createSessionRenewer<string>({
    refresh,
    onRenewed,
    onRevoked,
    now: () => clock,
    setTimer: (run, ms) => {
      const timer = { at: clock + ms, run };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timers.splice(timers.indexOf(timer as (typeof timers)[number]), 1);
    },
  });
  const advance = async (ms: number) => {
    clock += ms;
    for (const timer of timers.filter((one) => one.at <= clock)) {
      timers.splice(timers.indexOf(timer), 1);
      timer.run();
    }
    await flush();
  };
  return { renewer, refresh, onRenewed, onRevoked, advance, pendingTimers: () => timers.length };
}

const flush = async () => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

describe('renewalDue', () => {
  it('a session renewed half its life ago is due; a fresher one is not', () => {
    // Arrange
    const renewedAt = 5_000;
    // Act / Assert
    expect(renewalDue(renewedAt, renewedAt + RENEW_AFTER_MS)).toBe(true);
    expect(renewalDue(renewedAt, renewedAt + RENEW_AFTER_MS - 1)).toBe(false);
  });

  it('a session never renewed by this process is due: the boot refresh may have failed with no signal', () => {
    // Arrange / Act / Assert
    expect(renewalDue(null, 5_000)).toBe(true);
  });
});

describe('rejectsSession', () => {
  it('only «unauthorized» is the session: a lost network or an old build is not', () => {
    // Arrange / Act / Assert
    expect(rejectsSession('unauthorized')).toBe(true);
    expect(rejectsSession('update_required')).toBe(false);
    expect(rejectsSession('websocket error')).toBe(false);
    expect(rejectsSession('timeout')).toBe(false);
  });
});

/**
 * 04/11/2026: the JWT lasts 24 h and was renewed only when the process started.
 * A process alive 27 h had its reconnection refused, socket.io does not retry a
 * refused handshake, and the app sat in «Conectando…» with messages on a clock.
 */
describe('createSessionRenewer', () => {
  it('back in the foreground with a recent session: no request', async () => {
    // Arrange
    const { renewer, refresh } = harness();
    renewer.bootFinished(true);
    // Act
    renewer.renewIfDue();
    await flush();
    // Assert
    expect(refresh).not.toHaveBeenCalled();
  });

  it('back in the foreground after half the session: renews before it expires', async () => {
    // Arrange
    const { renewer, refresh, onRenewed, advance } = harness();
    renewer.bootFinished(true);
    await advance(RENEW_AFTER_MS);
    // Act
    renewer.renewIfDue();
    await flush();
    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onRenewed).toHaveBeenCalledWith('jwt-new');
  });

  it('a refused socket renews at once, even with a session that looks recent', async () => {
    // Arrange
    const { renewer, refresh, onRenewed, advance } = harness();
    renewer.bootFinished(true);
    await advance(HOUR_MS);
    // Act
    renewer.renewRejected();
    await flush();
    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onRenewed).toHaveBeenCalledWith('jwt-new');
  });

  it('two triggers at once make one request', async () => {
    // Arrange
    const { renewer, refresh } = harness();
    // Act
    renewer.renewRejected();
    renewer.renewIfDue();
    renewer.renewRejected();
    await flush();
    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('with no signal it tries again by itself, and a success stops it', async () => {
    // Arrange
    const { renewer, refresh, onRenewed, advance, pendingTimers } = harness([{ ok: false, revoked: false }, { ok: true, session: 'jwt-new' }]);
    // Act
    renewer.renewRejected();
    await flush();
    await advance(RENEW_RETRY_MS);
    // Assert
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onRenewed).toHaveBeenCalledTimes(1);
    expect(pendingTimers()).toBe(0);
  });

  it('a request that throws counts as no signal: it tries again', async () => {
    // Arrange
    const { renewer, refresh, advance } = harness([new Error('network'), { ok: true, session: 'jwt-new' }]);
    // Act
    renewer.renewRejected();
    await flush();
    await advance(RENEW_RETRY_MS);
    // Assert
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('a server that keeps refusing the new token does not make a tight loop', async () => {
    // Arrange: every renewal works, and the socket is refused again right after
    const { renewer, refresh, advance } = harness();
    renewer.renewRejected();
    await flush();
    // Act
    renewer.renewRejected();
    await flush();
    const atOnce = refresh.mock.calls.length;
    await advance(RENEW_RETRY_MS);
    // Assert
    expect(atOnce).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('a revoked device leaves and does not insist', async () => {
    // Arrange
    const { renewer, onRevoked, onRenewed, pendingTimers } = harness([{ ok: false, revoked: true }]);
    // Act
    renewer.renewRejected();
    await flush();
    // Assert
    expect(onRevoked).toHaveBeenCalledTimes(1);
    expect(onRenewed).not.toHaveBeenCalled();
    expect(pendingTimers()).toBe(0);
  });

  it('with no session there is nothing to renew or to retry', async () => {
    // Arrange
    const { renewer, onRenewed, onRevoked, pendingTimers } = harness([null]);
    // Act
    renewer.renewRejected();
    await flush();
    // Assert
    expect(onRenewed).not.toHaveBeenCalled();
    expect(onRevoked).not.toHaveBeenCalled();
    expect(pendingTimers()).toBe(0);
  });

  it('leaving the foreground stops the retries, and coming back picks up the refused socket', async () => {
    // Arrange
    const { renewer, refresh, advance, pendingTimers } = harness([{ ok: false, revoked: false }, { ok: true, session: 'jwt-new' }]);
    renewer.bootFinished(true);
    renewer.renewRejected();
    await flush();
    // Act
    renewer.pause();
    await advance(RENEW_RETRY_MS);
    const whileAway = refresh.mock.calls.length;
    renewer.renewIfDue();
    await flush();
    // Assert
    expect(whileAway).toBe(1);
    expect(pendingTimers()).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('the boot refresh in course: a refusal waits for it instead of asking twice', async () => {
    // Arrange: the app enters with the stored token, already expired
    const { renewer, refresh, advance, pendingTimers } = harness();
    renewer.bootStarted();
    // Act
    renewer.renewRejected();
    await flush();
    const whileBooting = refresh.mock.calls.length;
    renewer.bootFinished(true);
    await advance(RENEW_RETRY_MS);
    // Assert
    expect(whileBooting).toBe(0);
    expect(refresh).not.toHaveBeenCalled();
    expect(pendingTimers()).toBe(0);
  });

  it('a boot refresh that fails hands the refusal over: the socket is not left waiting', async () => {
    // Arrange
    const { renewer, refresh, onRenewed } = harness();
    renewer.bootStarted();
    renewer.renewRejected();
    // Act
    renewer.bootFinished(false);
    await flush();
    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onRenewed).toHaveBeenCalledWith('jwt-new');
  });

  it('a boot refresh that fails with nothing refused waits for the next return', async () => {
    // Arrange
    const { renewer, refresh } = harness();
    renewer.bootStarted();
    // Act
    renewer.bootFinished(false);
    await flush();
    const atBoot = refresh.mock.calls.length;
    renewer.renewIfDue();
    await flush();
    // Assert
    expect(atBoot).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signing out while the request is in the air drops its answer: the session does not come back', async () => {
    // Arrange
    const { renewer, onRenewed, pendingTimers } = harness();
    renewer.renewRejected();
    // Act
    renewer.forget();
    await flush();
    // Assert
    expect(onRenewed).not.toHaveBeenCalled();
    expect(pendingTimers()).toBe(0);
  });

  it('signing out cancels the retry that was waiting', async () => {
    // Arrange
    const { renewer, refresh, advance } = harness([{ ok: false, revoked: false }]);
    renewer.renewRejected();
    await flush();
    // Act
    renewer.forget();
    await advance(RENEW_RETRY_MS);
    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
